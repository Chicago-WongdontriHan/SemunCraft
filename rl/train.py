"""Curriculum and self-play training for SemunCraft.

Training moves through four stages, promoted once the agent wins often enough:
  easy      White against the Easy AI (the old built-in one, js/ai.js as E.botTurn)
  hard      White against the Hard AI (a random strategy each game), still with some Easy games
  scripted  either color against the scripted AI (rl/scripted.js: it Scrys, gives orders, builds
            the whole unit tree), still with some Hard games
  league    self-play in the single-player turn order, plus some games against the scripted and
            built-in AIs: the agent plays either color against its current network, recent snapshots
            or a hall of fame of older ones, so it also learns to play Black, the side the game's AI plays

Every game is played with normal sight (aiSight in js/engine.js): each side attacks only what it can
see, though it reads where the enemy stands. The network sees and acts in the latest rl/encoding.js
version (--encoding); a checkpoint keeps playing the version it was trained on.

Output goes to --out (default: a new folder under %LOCALAPPDATA%/semuncraft-rl/runs,
outside Google Drive): log.csv (training), eval.csv (evaluation games), snapshots/ and
latest.pt. Stop at any time and continue with --resume.

    python rl/train.py --minutes 60
    python rl/train.py --resume <run>/latest.pt --out <new run> --minutes 480 --lr-end 5e-5 \\
        --entropy-end 0.002 --league-easy 0.05 --league-hard 0.15 --pool 20 --hall-every 1000
"""
import argparse
import collections
import csv
import datetime
import json
import os
import sys
import time

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ppo import ENCODINGS, LATEST_ENCODING, PolicyValueNet, Rollout, Runner, autocast, ppo_update  # noqa: E402
from semuncraft_env import SemunCraftVecEnv  # noqa: E402

# share of training games against each kind of opponent, per stage (main() adds the league mix)
MIX = {
    "easy": {"easy": 1.0},
    "hard": {"easy": 0.25, "hard": 0.75},
    "scripted": {"hard": 0.25, "scripted": 0.75},
}
NEXT_STAGE = {"easy": "hard", "hard": "scripted", "scripted": "league"}
LOG_FIELDS = ["minutes", "update", "steps", "steps_per_s", "stage", "shaping", "lr", "entropy_coef", "games",
              "win_easy", "win_hard", "win_scripted", "win_self_w", "win_self_b", "draws", "moves_per_game", "entropy",
              "value_loss", "approx_kl", "clip_frac"]
EVAL_FIELDS = ["minutes", "update", "steps", "stage", "suite", "group", "games", "win", "loss", "draw"]
EVAL_SEED = 12345  # every evaluation replays the same maps


def rate(outcomes, value=1):
    outcomes = list(outcomes)
    return sum(1 for o in outcomes if o == value) / len(outcomes) if outcomes else float("nan")


def game_kind(info):
    """'easy', 'hard', 'scripted', 'self_w' or 'self_b' for a finished game."""
    scenario = info["scenario"]
    if scenario["opponent"] == "bot":
        return scenario["difficulty"]
    if scenario["opponent"] == "scripted":
        return "scripted"
    return "self_" + info["agent"]


def env_config(kind, args, shaping):
    config = {"mode": "classic", "maxTurns": args.max_turns, "shaping": shaping, "gamma": args.gamma, "aiSight": True}
    if kind == "self":
        config.update(opponent="external", agentColor="random")
    elif kind == "scripted":
        config.update(opponent="scripted", agentColor="random")
    else:
        config.update(opponent="bot", difficulty=kind)
    return config


def split(num_envs, mix):
    """The kind of opponent for each env index, in proportion to mix."""
    kinds, total = [], 0.0
    for kind, share in mix.items():
        total += share
        kinds += [kind] * (round(total * num_envs) - len(kinds))
    return kinds


def make_net(args, layout, device):
    net = PolicyValueNet(layout["channels"], args.width, args.blocks, layout["slots"], layout["on_board"]).to(device)
    return net.to(memory_format=torch.channels_last) if args.channels_last and device.type == "cuda" else net


def sample_actions(net, obs, masks, device, amp=False, temperature=1.0):
    """Actions from the policy over the legal ones: sampled, or the most likely one when temperature is 0."""
    with torch.no_grad():
        with autocast(device, amp):
            logits, _ = net(torch.as_tensor(obs, device=device))
        logits = logits.float().masked_fill(~torch.as_tensor(masks, device=device), -1e9)
        if temperature <= 0:
            return logits.argmax(1).cpu().numpy()
        return torch.distributions.Categorical(logits=logits / temperature).sample().cpu().numpy()


def opponent_fn(networks, fallback, device, amp):
    """Opponent callback for SemunCraftVecEnv: env i's opponent plays networks[i], or fallback when that is None."""
    def opponent(obs, masks, ids):
        actions = np.zeros(len(ids), np.int64)
        groups = {}
        for j, i in enumerate(ids):
            net = networks[i] or fallback
            groups.setdefault(id(net), (net, []))[1].append(j)
        for net, js in groups.values():
            actions[js] = sample_actions(net, obs[js], masks[js], device, amp)
        return actions
    return opponent


class League:
    """Self-play opponents: recent snapshots of the network and a hall of fame of older ones. Only a few
    are in play at a time (refresh() picks them), so each step runs a handful of opponent networks."""

    def __init__(self, args, layout, device):
        self.args, self.layout, self.device = args, layout, device
        self.recent, self.hall = [], []  # (path, network), oldest first
        self.active_recent, self.active_hall = [], []

    def load(self, path):
        net = make_net(self.args, self.layout, self.device)
        net.load_state_dict(torch.load(path, map_location=self.device, weights_only=True))
        return net.eval()

    def add_recent(self, path):
        self.recent.append((path, self.load(path)))
        del self.recent[:-self.args.pool]

    def add_hall(self, path):
        self.hall.append((path, self.load(path)))

    def refresh(self, rng):
        """Chooses the snapshots that new self-play games use until the next refresh."""
        if self.recent:
            chosen = rng.choice(len(self.recent), size=min(self.args.active_opponents, len(self.recent)), replace=False)
            self.active_recent = [self.recent[i][1] for i in chosen]
        self.active_hall = [self.hall[rng.integers(len(self.hall))][1]] if self.hall else []

    def pick(self, rng):
        """An opponent network for a new game, or None for the current one."""
        r = rng.random()
        if not self.active_recent or r < self.args.latest_prob:
            return None
        if self.active_hall and r < self.args.latest_prob + self.args.hall_prob:
            return self.active_hall[0]
        return self.active_recent[rng.integers(len(self.active_recent))]


class CsvLog:
    def __init__(self, path, fields):
        new = not os.path.exists(path)
        self.file = open(path, "a", newline="")
        self.writer = csv.DictWriter(self.file, fieldnames=fields, extrasaction="ignore")
        if new:
            self.writer.writeheader()

    def write(self, row):
        self.writer.writerow({k: round(v, 6) if isinstance(v, float) else v for k, v in row.items()})
        self.file.flush()


def play_evaluation(net, args, device, config, opponent_net=None, temperature=1.0):
    """One game in each of --eval-games envs, from fixed seeds; returns the finished games' infos."""
    n = args.eval_games
    opponent = opponent_fn([opponent_net] * n, net, device, args.amp)
    with SemunCraftVecEnv(n, config, num_workers=args.eval_workers, seed=EVAL_SEED, opponent=opponent) as env:
        obs, masks = env.reset(), env.action_masks()
        results = [None] * n
        while any(r is None for r in results):
            obs, _, dones, infos = env.step(sample_actions(net, obs, masks, device, args.amp, temperature))
            masks = env.action_masks()
            for i in np.flatnonzero(dones):
                if results[i] is None:
                    results[i] = infos[i]
    return results


class Trainer:
    def __init__(self, args, device, checkpoint=None):
        self.args, self.device = args, device
        c = checkpoint or {}
        self.update, self.steps, self.games = c.get("update", 0), c.get("steps", 0), c.get("games", 0)
        self.stage, self.stage_start = c.get("stage", "easy"), c.get("stage_start", 0)
        self.shaping = c.get("shaping", args.shaping)
        self.entropy_coef = args.entropy
        torch.manual_seed(args.seed + self.update)
        self.rng = np.random.default_rng(args.seed + self.update)
        self.kinds = split(args.envs, MIX[self.stage])
        self.env = SemunCraftVecEnv(args.envs, [env_config(k, args, self.shaping) for k in self.kinds],
                                    num_workers=args.workers, seed=args.seed + self.update, encoding=args.encoding)
        self.layout = {"channels": self.env.channels, "slots": self.env.slots, "on_board": self.env.on_board}
        if self.layout != ENCODINGS[args.encoding]:
            raise SystemExit("rl/encoding.js version %d is %s, rl/ppo.py expects %s"
                             % (args.encoding, self.layout, ENCODINGS[args.encoding]))
        self.net = make_net(args, self.layout, device)
        self.opt = torch.optim.Adam(self.net.parameters(), lr=args.lr, eps=1e-5)
        self.league = League(args, self.layout, device)
        self.anchor = None     # (path, network) saved when the league stage began
        self.previous = None   # network at the previous evaluation
        self.run_start = None  # network when this run started
        if checkpoint:
            self.net.load_state_dict(c["net"])
            self.opt.load_state_dict(c["opt"])
            for path in c.get("league", []):
                if os.path.exists(path):
                    self.league.add_recent(path)
            for path in c.get("hall", []):
                if os.path.exists(path):
                    self.league.add_hall(path)
            if c.get("anchor") and os.path.exists(c["anchor"]):
                self.anchor = (c["anchor"], self.league.load(c["anchor"]))
        self.opponents = [None] * args.envs  # per env: the network its current self-play game is against
        self.env.opponent = opponent_fn(self.opponents, self.net, device, args.amp)
        self.env.on_new_game = self.new_game
        self.recent = collections.defaultdict(lambda: collections.deque(maxlen=args.window))
        self.lengths = collections.deque(maxlen=500)
        self.log = CsvLog(os.path.join(args.out, "log.csv"), LOG_FIELDS)
        self.eval_log = CsvLog(os.path.join(args.out, "eval.csv"), EVAL_FIELDS)

    def new_game(self, i):
        self.opponents[i] = self.league.pick(self.rng) if self.kinds[i] == "self" else None

    def game_end(self, i, info):
        self.games += 1
        self.recent[game_kind(info)].append(info["outcome"])
        self.lengths.append(info["episode"]["l"])

    def run(self):
        args = self.args
        with open(os.path.join(args.out, "args_%06d.json" % self.update), "w") as f:
            json.dump(vars(args), f, indent=2)
        start_path = os.path.join(args.out, "snapshots", "run_start_%06d.pt" % self.update)
        torch.save(self.net.state_dict(), start_path)
        self.run_start = self.league.load(start_path)
        print("run folder %s\ndevice %s | %d envs on %d workers | %s parameters | stage %s from update %d | amp %s"
              % (args.out, self.device, args.envs, args.workers, format(sum(p.numel() for p in self.net.parameters()), ","),
                 self.stage, self.update, args.amp), flush=True)
        self.league.refresh(self.rng)
        rollout, runner = Rollout(args.steps, self.env, self.device), Runner(self.env, self.device, amp=args.amp)
        start, eval_seconds, start_steps = time.time(), 0.0, self.steps
        try:
            while time.time() - start < args.minutes * 60:
                self.update += 1
                self.schedule(start)
                if self.update % args.refresh_opponents == 0:
                    self.league.refresh(self.rng)
                runner.collect(self.net, rollout, self.game_end)
                self.steps += args.envs * args.steps
                stats = ppo_update(self.net, self.opt, rollout, gamma=args.gamma, lam=args.lam, clip=args.clip,
                                   epochs=args.epochs, minibatch=args.minibatch, entropy_coef=self.entropy_coef,
                                   amp=args.amp)
                self.advance_stage()
                self.schedule_shaping()
                if self.update % args.snapshot_every == 0:
                    self.snapshot()
                if self.update % args.log_every == 0:
                    speed = (self.steps - start_steps) / max(1e-9, time.time() - start - eval_seconds)
                    self.write_log(stats, speed, start)
                if self.update % args.eval_every == 0:
                    t = time.time()
                    self.evaluate(start)
                    eval_seconds += time.time() - t
        finally:
            self.save(os.path.join(args.out, "latest.pt"))
            torch.save(self.net.state_dict(), os.path.join(args.out, "final.pt"))
            self.env.close()
        print("stopped at update %d: %.2fM steps, %d games, stage %s. Run folder: %s"
              % (self.update, self.steps / 1e6, self.games, self.stage, args.out), flush=True)

    def schedule(self, start):
        """Learning rate and entropy bonus move linearly to their end values over --minutes."""
        args = self.args
        progress = min(1.0, (time.time() - start) / (args.minutes * 60))
        for group in self.opt.param_groups:
            group["lr"] = args.lr + (args.lr_end - args.lr) * progress
        self.entropy_coef = args.entropy + (args.entropy_end - args.entropy) * progress

    def advance_stage(self):
        args, stage = self.args, self.stage
        if stage not in NEXT_STAGE:
            return
        elapsed = self.update - self.stage_start
        results = self.recent[stage]
        threshold = {"easy": args.promote_easy, "hard": args.promote_hard, "scripted": args.promote_scripted}[stage]
        won = len(results) >= args.window and rate(results) >= threshold and elapsed >= args.min_stage_updates
        if not won and elapsed < args.max_stage_updates:
            return
        self.stage, self.stage_start = NEXT_STAGE[stage], self.update
        self.kinds[:] = split(args.envs, MIX[self.stage])
        for kind in sorted(set(self.kinds)):
            self.env.configure(env_config(kind, args, self.shaping), [i for i, k in enumerate(self.kinds) if k == kind])
        if self.stage == "league":
            path = os.path.join(args.out, "snapshots", "league_start.pt")
            torch.save(self.net.state_dict(), path)
            self.anchor = (path, self.league.load(path))
        print("update %d: promoted to %s (%s win rate %.2f over the last %d games%s)"
              % (self.update, self.stage, stage, rate(results), len(results), "" if won else "; stage time limit"),
              flush=True)

    def schedule_shaping(self):
        args, target = self.args, self.args.shaping
        if self.stage == "league":
            target *= max(0.0, 1.0 - (self.update - self.stage_start) / max(1, args.shaping_anneal))
        if abs(target - self.shaping) >= 0.01 or (target == 0.0 and self.shaping != 0.0):
            self.shaping = round(target, 4)
            self.env.configure({"shaping": self.shaping})

    def snapshot(self):
        path = os.path.join(self.args.out, "snapshots", "update_%06d.pt" % self.update)
        torch.save(self.net.state_dict(), path)
        self.league.add_recent(path)
        if self.args.hall_every and self.update % self.args.hall_every == 0:
            self.league.add_hall(path)
        self.save(os.path.join(self.args.out, "latest.pt"))

    def save(self, path):
        state = {"net": self.net.state_dict(), "opt": self.opt.state_dict(), "update": self.update,
                 "steps": self.steps, "games": self.games, "stage": self.stage, "stage_start": self.stage_start,
                 "shaping": self.shaping, "league": [p for p, _ in self.league.recent],
                 "hall": [p for p, _ in self.league.hall],
                 "anchor": self.anchor[0] if self.anchor else None, "encoding": self.args.encoding,
                 "args": vars(self.args)}
        torch.save(state, path + ".tmp")
        os.replace(path + ".tmp", path)

    def write_log(self, stats, speed, start):
        r = self.recent
        row = {"minutes": (time.time() - start) / 60, "update": self.update, "steps": self.steps,
               "steps_per_s": round(speed), "stage": self.stage, "shaping": self.shaping,
               "lr": self.opt.param_groups[0]["lr"], "entropy_coef": self.entropy_coef, "games": self.games,
               "win_easy": rate(r["easy"]), "win_hard": rate(r["hard"]), "win_scripted": rate(r["scripted"]),
               "win_self_w": rate(r["self_w"]), "win_self_b": rate(r["self_b"]),
               "draws": rate([o for d in r.values() for o in d], 0),
               "moves_per_game": float(np.mean(self.lengths)) if self.lengths else float("nan")}
        row.update({k: stats[k] for k in ("entropy", "value_loss", "approx_kl", "clip_frac")})
        self.log.write(row)
        show = lambda x: "  - " if x != x else "%.2f" % x
        print("upd %5d | %6.2fM steps | %5d/s | %-8s | lr %.1e | win easy %s hard %s scripted %s self W %s B %s"
              " | draws %s | moves %5.1f | entropy %.2f kl %.3f"
              % (self.update, self.steps / 1e6, speed, self.stage, row["lr"], show(row["win_easy"]),
                 show(row["win_hard"]), show(row["win_scripted"]), show(row["win_self_w"]), show(row["win_self_b"]),
                 show(row["draws"]),
                 row["moves_per_game"], stats["entropy"], stats["approx_kl"]), flush=True)

    def evaluate(self, start):
        args = self.args
        by_color = lambda info: "as White" if info["agent"] == "w" else "as Black"
        suites = [("easy", env_config("easy", args, 0.0), None, 1.0, lambda info: None),
                  ("hard", env_config("hard", args, 0.0), None, 1.0, lambda info: info["scenario"]["strategy"]),
                  ("scripted", env_config("scripted", args, 0.0), None, 1.0, by_color)]
        if self.stage == "league":
            self_play = env_config("self", args, 0.0)
            if self.anchor:
                suites.append(("vs league start", self_play, self.anchor[1], 1.0, by_color))
            suites.append(("vs run start", self_play, self.run_start, 1.0, by_color))
            suites.append(("vs run start, greedy", self_play, self.run_start, 0.0, by_color))
            if self.previous is not None:
                suites.append(("vs previous eval", self_play, self.previous, 1.0, by_color))
        parts = []
        for name, config, opponent, temperature, group in suites:
            results = play_evaluation(self.net, args, self.device, config, opponent, temperature)
            groups = collections.defaultdict(list)
            for info in results:
                groups["all"].append(info["outcome"])
                if group(info) is not None:
                    groups[group(info)].append(info["outcome"])
            for key, outcomes in groups.items():
                self.eval_log.write({"minutes": (time.time() - start) / 60, "update": self.update, "steps": self.steps,
                                     "stage": self.stage, "suite": name, "group": key, "games": len(outcomes),
                                     "win": rate(outcomes, 1), "loss": rate(outcomes, -1), "draw": rate(outcomes, 0)})
            detail = ", ".join("%s %.2f" % (k, rate(v)) for k, v in sorted(groups.items()) if k != "all")
            parts.append("%s %.2f%s" % (name, rate(groups["all"]), " (%s)" % detail if detail else ""))
        print("eval @ update %d, win rates: %s" % (self.update, " | ".join(parts)), flush=True)
        if self.stage == "league":
            self.previous = make_net(args, self.layout, self.device)
            self.previous.load_state_dict(self.net.state_dict())
            self.previous.eval()


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--minutes", type=float, default=60, help="wall-clock time for this run")
    p.add_argument("--out", help="run folder (default: a new folder under %%LOCALAPPDATA%%/semuncraft-rl/runs)")
    p.add_argument("--resume", help="checkpoint to continue from, e.g. <run folder>/latest.pt")
    p.add_argument("--envs", type=int, default=192)
    p.add_argument("--workers", type=int, default=min(16, os.cpu_count() or 1))
    p.add_argument("--steps", type=int, default=64, help="steps per env between updates")
    p.add_argument("--epochs", type=int, default=4)
    p.add_argument("--minibatch", type=int, default=2048)
    p.add_argument("--lr", type=float, default=2.5e-4)
    p.add_argument("--lr-end", type=float, help="learning rate at the end of --minutes (default: constant)")
    p.add_argument("--gamma", type=float, default=0.99)
    p.add_argument("--lam", type=float, default=0.95)
    p.add_argument("--clip", type=float, default=0.2)
    p.add_argument("--entropy", type=float, default=0.01)
    p.add_argument("--entropy-end", type=float, help="entropy bonus at the end of --minutes (default: constant)")
    p.add_argument("--width", type=int, default=96)
    p.add_argument("--blocks", type=int, default=6)
    p.add_argument("--amp", action=argparse.BooleanOptionalAction, default=True, help="bfloat16 mixed precision on CUDA")
    p.add_argument("--channels-last", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--max-turns", type=int, default=300)
    p.add_argument("--shaping", type=float, default=0.5, help="shaping weight; fades to 0 during the league stage")
    p.add_argument("--shaping-anneal", type=int, default=400, help="league updates over which shaping fades out")
    p.add_argument("--window", type=int, default=400, help="recent games per opponent kind for promotion and logs")
    p.add_argument("--promote-easy", type=float, default=0.9, help="win rate against Easy needed to move on")
    p.add_argument("--promote-hard", type=float, default=0.75, help="win rate against Hard needed to move on")
    p.add_argument("--promote-scripted", type=float, default=0.6, help="win rate against the scripted AI needed to move on")
    p.add_argument("--min-stage-updates", type=int, default=30)
    p.add_argument("--max-stage-updates", type=int, default=400, help="move on anyway after this many updates")
    p.add_argument("--league-easy", type=float, default=0.05, help="share of league games against the Easy AI")
    p.add_argument("--league-hard", type=float, default=0.15, help="share of league games against the Hard AI")
    p.add_argument("--league-scripted", type=float, default=0.3,
                   help="share of league games against the scripted AI (the rest is self-play)")
    p.add_argument("--snapshot-every", type=int, default=50)
    p.add_argument("--pool", type=int, default=10, help="recent snapshots kept as self-play opponents")
    p.add_argument("--latest-prob", type=float, default=0.5, help="share of self-play games against the current network")
    p.add_argument("--hall-every", type=int, default=0, help="snapshots at multiples of this update join a permanent hall of fame (0 = off)")
    p.add_argument("--hall-prob", type=float, default=0.2, help="share of self-play games against the hall of fame")
    p.add_argument("--active-opponents", type=int, default=4, help="recent snapshots in play at a time")
    p.add_argument("--refresh-opponents", type=int, default=10, help="updates between picking new snapshots to play")
    p.add_argument("--eval-every", type=int, default=200)
    p.add_argument("--eval-games", type=int, default=100)
    p.add_argument("--eval-workers", type=int, default=8)
    p.add_argument("--log-every", type=int, default=10)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--encoding", type=int, default=LATEST_ENCODING, choices=sorted(ENCODINGS),
                   help="rl/encoding.js version for a new run (a resumed run keeps its own)")
    return p.parse_args()


def main():
    args = parse_args()
    args.lr_end = args.lr if args.lr_end is None else args.lr_end
    args.entropy_end = args.entropy if args.entropy_end is None else args.entropy_end
    others = args.league_easy + args.league_hard + args.league_scripted
    if others > 1:
        raise SystemExit("--league-easy, --league-hard and --league-scripted add up to more than 1")
    MIX["league"] = {"easy": args.league_easy, "hard": args.league_hard, "scripted": args.league_scripted,
                     "self": 1.0 - others}
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cudnn.benchmark = True
    checkpoint = torch.load(args.resume, map_location=device, weights_only=True) if args.resume else None
    if checkpoint:
        # the network's shape is fixed by the checkpoint, and so is the encoding it sees and acts in (the
        # runs before encoding 2 saved none)
        args.width, args.blocks = checkpoint["args"]["width"], checkpoint["args"]["blocks"]
        args.encoding = checkpoint.get("encoding", 1)
        if args.encoding != LATEST_ENCODING:
            print("note: this checkpoint plays encoding %d; the latest is %d, and only a new run trains on it"
                  % (args.encoding, LATEST_ENCODING), flush=True)
        args.out = args.out or os.path.dirname(os.path.abspath(args.resume))
    if not args.out:
        root = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        args.out = os.path.join(root, "semuncraft-rl", "runs", datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S"))
    os.makedirs(os.path.join(args.out, "snapshots"), exist_ok=True)
    Trainer(args, device, checkpoint).run()


if __name__ == "__main__":
    main()
