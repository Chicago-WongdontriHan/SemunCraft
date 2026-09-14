"""Masked PPO for SemunCraft, in PyTorch.

The policy/value network and PPO pieces used by rl/train.py, plus a quick
command-line check that an agent learns: it plays White against the built-in
AI (or on campaign levels) and prints its win rate as training goes on.
Nothing is saved unless you pass --save.

    python rl/ppo.py --levels 0 --minutes 5
    python rl/ppo.py --difficulty easy --shaping 0.5 --minutes 10
"""
import argparse
import collections
import os
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from semuncraft_env import SemunCraftVecEnv  # noqa: E402

SLOTS = 82     # actions per board cell: 81 offsets and "spawn here" (rl/encoding.js)
ON_BOARD = 19  # observation channel marking real board cells


class ResBlock(nn.Module):
    def __init__(self, width):
        super().__init__()
        self.conv1 = nn.Conv2d(width, width, 3, padding=1)
        self.conv2 = nn.Conv2d(width, width, 3, padding=1)

    def forward(self, x):
        return F.relu(x + self.conv2(F.relu(self.conv1(x))))


class PolicyValueNet(nn.Module):
    """Convolutional network with 82 action logits per cell, a skip logit and a value."""

    def __init__(self, channels, width=64, blocks=4):
        super().__init__()
        self.stem = nn.Conv2d(channels, width, 3, padding=1)
        self.body = nn.Sequential(*[ResBlock(width) for _ in range(blocks)])
        self.cell_logits = nn.Conv2d(width, SLOTS, 1)
        self.skip_logit = nn.Linear(width, 1)
        self.value_head = nn.Sequential(nn.Linear(width, width), nn.ReLU(), nn.Linear(width, 1))

    def forward(self, obs):
        if self.stem.weight.is_contiguous(memory_format=torch.channels_last):
            obs = obs.contiguous(memory_format=torch.channels_last)
        x = self.body(F.relu(self.stem(obs)))
        board = obs[:, ON_BOARD:ON_BOARD + 1]
        pooled = (x * board).sum((2, 3)) / board.sum((2, 3)).clamp(min=1.0)
        # (batch, 82, grid, grid) -> (batch, grid*grid*82) so that index = cell * 82 + slot, as in the encoding
        logits = self.cell_logits(x).permute(0, 2, 3, 1).reshape(obs.shape[0], -1)
        return torch.cat([logits, self.skip_logit(pooled)], 1), self.value_head(pooled).squeeze(1)


def autocast(device, enabled):
    """bfloat16 mixed precision on CUDA when enabled; no effect on the CPU."""
    return torch.autocast(device_type=device.type, dtype=torch.bfloat16, enabled=bool(enabled) and device.type == "cuda")


def masked_dist(logits, masks):
    """Distribution over all actions with the illegal ones masked out."""
    return torch.distributions.Categorical(logits=logits.masked_fill(~masks, -1e9))


def legal_dist(logits, legal, counts):
    """The same distribution restricted to each row's legal actions: legal is (batch, k) action indices
    whose first counts[i] entries are valid, and the distribution's outcomes are positions in that list."""
    valid = torch.arange(legal.shape[1], device=legal.device)[None, :] < counts[:, None]
    return torch.distributions.Categorical(logits=logits.gather(1, legal).masked_fill(~valid, -1e9))


class Rollout:
    """Buffers for `steps` steps of every env, on the training device."""

    def __init__(self, steps, env, device):
        n, shape = env.num_envs, env.observation_shape
        self.steps = steps
        self.obs = torch.zeros((steps, n) + shape, device=device)
        self.legal = [None] * steps  # per step: (n, most legal actions) action indices, padded with 0
        self.counts = torch.zeros((steps, n), dtype=torch.long, device=device)
        self.picks = torch.zeros((steps, n), dtype=torch.long, device=device)  # chosen position in legal
        self.logp, self.values, self.rewards, self.dones = (torch.zeros((steps, n), device=device) for _ in range(4))
        self.next_value = self.next_done = None


class Runner:
    """Plays the current policy in a vector env and fills rollouts."""

    def __init__(self, env, device, amp=False):
        self.env, self.device, self.amp = env, device, amp
        self.obs = torch.as_tensor(env.reset(), device=device)
        self.done = torch.zeros(env.num_envs, device=device)

    def collect(self, net, rollout, on_game_end=None):
        """Fills `rollout`; on_game_end(env_index, info) is called for every finished game."""
        env, device = self.env, self.device
        for t in range(rollout.steps):
            legal, counts = (torch.as_tensor(x, device=device) for x in env.legal_actions())
            with torch.no_grad():
                with autocast(device, self.amp):
                    logits, value = net(self.obs)
                dist = legal_dist(logits.float(), legal, counts)
                pick = dist.sample()
                action = legal.gather(1, pick[:, None]).squeeze(1)
            rollout.obs[t], rollout.legal[t], rollout.counts[t], rollout.picks[t] = self.obs, legal, counts, pick
            rollout.logp[t], rollout.values[t], rollout.dones[t] = dist.log_prob(pick), value.float(), self.done
            obs, reward, done, infos = env.step(action.cpu().numpy())
            rollout.rewards[t] = torch.as_tensor(reward, device=device)
            if on_game_end is not None:
                for i in np.flatnonzero(done):
                    on_game_end(i, infos[i])
            self.obs = torch.as_tensor(obs, device=device)
            self.done = torch.as_tensor(done, dtype=torch.float32, device=device)
        with torch.no_grad(), autocast(device, self.amp):
            rollout.next_value = net(self.obs)[1].float()
        rollout.next_done = self.done


def ppo_update(net, opt, rollout, gamma=0.99, lam=0.95, clip=0.2, epochs=4, minibatch=1024,
               entropy_coef=0.01, value_coef=0.5, max_grad_norm=0.5, amp=False):
    """One clipped PPO update from a filled rollout; returns averaged training statistics."""
    device = rollout.obs.device
    with torch.no_grad():
        advantages = torch.zeros_like(rollout.rewards)
        last = torch.zeros_like(rollout.next_value)
        for t in reversed(range(rollout.steps)):
            if t == rollout.steps - 1:
                nonterminal, following = 1.0 - rollout.next_done, rollout.next_value
            else:
                nonterminal, following = 1.0 - rollout.dones[t + 1], rollout.values[t + 1]
            delta = rollout.rewards[t] + gamma * following * nonterminal - rollout.values[t]
            last = delta + gamma * lam * nonterminal * last
            advantages[t] = last
        returns = advantages + rollout.values
    obs = rollout.obs.reshape((-1,) + tuple(rollout.obs.shape[2:]))
    width = max(legal.shape[1] for legal in rollout.legal)
    legal = torch.cat([F.pad(step, (0, width - step.shape[1])) for step in rollout.legal])  # rows in obs order
    counts, picks, old_logp, advantages, returns = (
        x.reshape(-1) for x in (rollout.counts, rollout.picks, rollout.logp, advantages, returns))
    stats = collections.defaultdict(list)
    for _ in range(epochs):
        order = torch.randperm(picks.shape[0], device=picks.device)
        for k in range(0, picks.shape[0], minibatch):
            idx = order[k:k + minibatch]
            if len(idx) < 2:
                continue
            with autocast(device, amp):
                logits, value = net(obs[idx])
            logits, value, c = logits.float(), value.float(), counts[idx]
            dist = legal_dist(logits, legal[idx, :int(c.max())], c)
            log_ratio = dist.log_prob(picks[idx]) - old_logp[idx]
            ratio = log_ratio.exp()
            adv = advantages[idx]
            adv = (adv - adv.mean()) / (adv.std() + 1e-8)
            policy_loss = torch.max(-adv * ratio, -adv * ratio.clamp(1 - clip, 1 + clip)).mean()
            value_loss = 0.5 * (value - returns[idx]).pow(2).mean()
            entropy = dist.entropy().mean()
            opt.zero_grad()
            (policy_loss + value_coef * value_loss - entropy_coef * entropy).backward()
            nn.utils.clip_grad_norm_(net.parameters(), max_grad_norm)
            opt.step()
            with torch.no_grad():
                stats["policy_loss"].append(policy_loss.item())
                stats["value_loss"].append(value_loss.item())
                stats["entropy"].append(entropy.item())
                stats["approx_kl"].append(((ratio - 1) - log_ratio).mean().item())
                stats["clip_frac"].append(((ratio - 1).abs() > clip).float().mean().item())
    return {k: float(np.mean(v)) for k, v in stats.items()}


def rate(outcomes, value):
    return sum(1 for o in outcomes if o == value) / len(outcomes) if outcomes else 0.0


def train(args, env, device):
    net = PolicyValueNet(env.channels, args.width, args.blocks).to(device)
    if args.channels_last and device.type == "cuda":
        net = net.to(memory_format=torch.channels_last)
    opt = torch.optim.Adam(net.parameters(), lr=args.lr, eps=1e-5)
    rollout, runner = Rollout(args.steps, env, device), Runner(env, device, amp=args.amp)
    outcomes, lengths = [], collections.deque(maxlen=200)

    def game_end(i, info):
        outcomes.append(info["outcome"])
        lengths.append(info["episode"]["l"])

    print("device %s | %d envs x %d steps per update | %s parameters"
          % (device, env.num_envs, args.steps, format(sum(p.numel() for p in net.parameters()), ",")))
    start, steps, update = time.time(), 0, 0
    while time.time() - start < args.minutes * 60:
        update += 1
        runner.collect(net, rollout, game_end)
        steps += env.num_envs * args.steps
        stats = ppo_update(net, opt, rollout, args.gamma, args.lam, args.clip, args.epochs, args.minibatch,
                           args.entropy, amp=args.amp)
        if update % 10 == 0:
            recent = outcomes[-200:]
            print("update %4d | %8d steps | %5.0f steps/s | %5d games | last 200: win %.2f loss %.2f draw %.2f"
                  " | moves/game %.1f | entropy %.2f"
                  % (update, steps, steps / (time.time() - start), len(outcomes), rate(recent, 1),
                     rate(recent, -1), rate(recent, 0), np.mean(lengths) if lengths else 0, stats["entropy"]), flush=True)

    first, last = outcomes[:200], outcomes[-200:]
    print("\n%d games in %.1f minutes. Win rate: first %d games %.2f, last %d games %.2f"
          % (len(outcomes), (time.time() - start) / 60, len(first), rate(first, 1), len(last), rate(last, 1)))
    return net


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--levels", type=int, nargs="*", help="campaign level indices (0 = Pawn School); default: standard game")
    p.add_argument("--difficulty", default="easy", choices=["easy", "hard", "random"], help="built-in AI in the standard game")
    p.add_argument("--minutes", type=float, default=5)
    p.add_argument("--envs", type=int, default=64)
    p.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 1))
    p.add_argument("--steps", type=int, default=64, help="steps per env between updates")
    p.add_argument("--epochs", type=int, default=4)
    p.add_argument("--minibatch", type=int, default=1024)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--gamma", type=float, default=0.99)
    p.add_argument("--lam", type=float, default=0.95)
    p.add_argument("--clip", type=float, default=0.2)
    p.add_argument("--entropy", type=float, default=0.01)
    p.add_argument("--shaping", type=float, default=0.0)
    p.add_argument("--max-turns", type=int, default=300)
    p.add_argument("--width", type=int, default=64)
    p.add_argument("--blocks", type=int, default=4)
    p.add_argument("--amp", action=argparse.BooleanOptionalAction, default=True, help="bfloat16 mixed precision on CUDA")
    p.add_argument("--channels-last", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--save", help="file to write the trained weights to")
    args = p.parse_args()

    torch.manual_seed(args.seed)
    torch.backends.cudnn.benchmark = True
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    config = {"mode": "classic", "difficulty": args.difficulty, "maxTurns": args.max_turns,
              "shaping": args.shaping, "gamma": args.gamma}
    if args.levels:
        config["levels"] = args.levels
    with SemunCraftVecEnv(args.envs, config, num_workers=args.workers, seed=args.seed) as env:
        net = train(args, env, device)
    if args.save:
        torch.save(net.state_dict(), args.save)
        print("saved", args.save)


if __name__ == "__main__":
    main()
