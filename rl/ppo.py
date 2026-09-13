"""Masked PPO for SemunCraft, in PyTorch.

A compact trainer for checking that an agent learns in the environment: it plays
White against the built-in AI (or on campaign levels) and prints how often it
wins as training goes on. Nothing is saved unless you pass --save.

    python rl/ppo.py --levels 0 --minutes 5
    python rl/ppo.py --difficulty easy --minutes 20
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
        x = self.body(F.relu(self.stem(obs)))
        board = obs[:, ON_BOARD:ON_BOARD + 1]
        pooled = (x * board).sum((2, 3)) / board.sum((2, 3)).clamp(min=1.0)
        # (batch, 82, grid, grid) -> (batch, grid*grid*82) so that index = cell * 82 + slot, as in the encoding
        logits = self.cell_logits(x).permute(0, 2, 3, 1).reshape(obs.shape[0], -1)
        return torch.cat([logits, self.skip_logit(pooled)], 1), self.value_head(pooled).squeeze(1)


def masked_dist(logits, masks):
    return torch.distributions.Categorical(logits=logits.masked_fill(~masks, -1e9))


def rate(outcomes, value):
    return sum(1 for o in outcomes if o == value) / len(outcomes) if outcomes else 0.0


def train(args, env, device):
    net = PolicyValueNet(env.channels, args.width, args.blocks).to(device)
    opt = torch.optim.Adam(net.parameters(), lr=args.lr, eps=1e-5)
    n, t_max, shape, num_actions = env.num_envs, args.steps, env.observation_shape, env.num_actions
    obs_buf = torch.zeros((t_max, n) + shape, device=device)
    mask_buf = torch.zeros((t_max, n, num_actions), dtype=torch.bool, device=device)
    act_buf = torch.zeros((t_max, n), dtype=torch.long, device=device)
    logp_buf, val_buf, rew_buf, done_buf = (torch.zeros((t_max, n), device=device) for _ in range(4))

    obs = torch.as_tensor(env.reset(), device=device)
    masks = torch.as_tensor(env.action_masks(), device=device)
    done = torch.zeros(n, device=device)
    outcomes, lengths = [], collections.deque(maxlen=200)
    print("device %s | %d envs x %d steps per update | %s parameters"
          % (device, n, t_max, format(sum(p.numel() for p in net.parameters()), ",")))
    start, steps, update = time.time(), 0, 0
    while time.time() - start < args.minutes * 60:
        update += 1
        # collect experience
        for t in range(t_max):
            with torch.no_grad():
                logits, value = net(obs)
                dist = masked_dist(logits, masks)
                action = dist.sample()
            obs_buf[t], mask_buf[t], act_buf[t] = obs, masks, action
            logp_buf[t], val_buf[t], done_buf[t] = dist.log_prob(action), value, done
            next_obs, reward, next_done, infos = env.step(action.cpu().numpy())
            rew_buf[t] = torch.as_tensor(reward, device=device)
            for i in np.flatnonzero(next_done):
                outcomes.append(infos[i]["outcome"])
                lengths.append(infos[i]["episode"]["l"])
            obs = torch.as_tensor(next_obs, device=device)
            masks = torch.as_tensor(env.action_masks(), device=device)
            done = torch.as_tensor(next_done, dtype=torch.float32, device=device)
        steps += n * t_max

        # generalized advantage estimation
        with torch.no_grad():
            next_value = net(obs)[1]
            adv = torch.zeros_like(rew_buf)
            last = torch.zeros(n, device=device)
            for t in reversed(range(t_max)):
                nonterminal = 1.0 - (done if t == t_max - 1 else done_buf[t + 1])
                following = next_value if t == t_max - 1 else val_buf[t + 1]
                delta = rew_buf[t] + args.gamma * following * nonterminal - val_buf[t]
                last = delta + args.gamma * args.lam * nonterminal * last
                adv[t] = last
            ret = adv + val_buf

        # clipped policy update
        b_obs, b_mask = obs_buf.reshape((-1,) + shape), mask_buf.reshape(-1, num_actions)
        b_act, b_logp, b_adv, b_ret = act_buf.reshape(-1), logp_buf.reshape(-1), adv.reshape(-1), ret.reshape(-1)
        for _ in range(args.epochs):
            order = torch.randperm(n * t_max, device=device)
            for k in range(0, n * t_max, args.minibatch):
                idx = order[k:k + args.minibatch]
                logits, value = net(b_obs[idx])
                dist = masked_dist(logits, b_mask[idx])
                ratio = (dist.log_prob(b_act[idx]) - b_logp[idx]).exp()
                a = b_adv[idx]
                a = (a - a.mean()) / (a.std() + 1e-8)
                policy_loss = torch.max(-a * ratio, -a * ratio.clamp(1 - args.clip, 1 + args.clip)).mean()
                value_loss = 0.5 * (value - b_ret[idx]).pow(2).mean()
                entropy = dist.entropy().mean()
                loss = policy_loss + 0.5 * value_loss - args.entropy * entropy
                opt.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(net.parameters(), 0.5)
                opt.step()

        if update % 10 == 0:
            recent = outcomes[-200:]
            print("update %4d | %8d steps | %5.0f steps/s | %5d games | last 200: win %.2f loss %.2f draw %.2f"
                  " | moves/game %.1f | entropy %.2f"
                  % (update, steps, steps / (time.time() - start), len(outcomes), rate(recent, 1),
                     rate(recent, -1), rate(recent, 0), np.mean(lengths) if lengths else 0, entropy.item()), flush=True)

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
