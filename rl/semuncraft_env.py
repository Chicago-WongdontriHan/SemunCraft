"""Vectorized SemunCraft environments for reinforcement learning.

Each environment is a game simulated by js/engine.js inside a Node.js worker
process (rl/worker.js); this module starts the workers and steps them in
lock-step. Only NumPy is required.

    from semuncraft_env import SemunCraftVecEnv, sample_legal
    with SemunCraftVecEnv(num_envs=16, config={"mode": "classic"}) as env:
        obs = env.reset()                    # (16, 54, 11, 11) float32 in [0, 1]
        masks = env.action_masks()           # (16, 19240) bool, True = legal
        obs, rewards, dones, infos = env.step(sample_legal(masks, rng))

The agent always sees the board from its own side (rotated 180 degrees when it
plays Black). SemunCraft_Explained.md describes the channels, the action layout,
rewards and the config options.
"""
import base64
import collections
import glob
import json
import os
import re
import shutil
import subprocess
import threading

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKER = os.path.join(ROOT, "rl", "worker.js")

# the rl/encoding.js versions: observation channels, action slots per board cell, and the channel that
# marks real board cells (the last channel, in both, is "moves first each round"). A network plays only
# in the version it was trained on. tests/encoding.test.js and rl/test_env.py check these against
# rl/encoding.js.
ENCODINGS = {
    1: {"channels": 32, "slots": 82, "on_board": 19},   # the networks trained through 2026-09-14
    2: {"channels": 54, "slots": 159, "on_board": 42},  # the current rules
}
LATEST_ENCODING = 2


def find_node():
    """Node.js executable: $SEMUNCRAFT_NODE, node on PATH, or a portable install in %LOCALAPPDATA%/Programs."""
    path = os.environ.get("SEMUNCRAFT_NODE") or shutil.which("node")
    if path:
        return path
    pattern = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "node-v*-win-x64", "node.exe")
    version = lambda p: tuple(int(x) for x in re.findall(r"\d+", os.path.basename(os.path.dirname(p))))
    found = sorted(glob.glob(pattern), key=version)
    if not found:
        raise FileNotFoundError("Node.js not found: install it or set SEMUNCRAFT_NODE")
    return found[-1]


def sample_legal(masks, rng):
    """One uniformly random legal action per row of a boolean mask."""
    scores = rng.random(masks.shape, dtype=np.float32)
    scores[~masks] = -1.0
    return scores.argmax(axis=1)


class _Worker:
    """One Node worker process and its line-based JSON protocol."""

    def __init__(self, node, grid, configs, encoding=None):
        self.proc = subprocess.Popen(
            [node, WORKER], cwd=ROOT,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.stderr = collections.deque(maxlen=40)
        threading.Thread(target=self._drain_stderr, daemon=True).start()
        try:
            msg = {"cmd": "init", "grid": grid, "envs": configs}
            if encoding is not None:
                msg["encoding"] = encoding
            self.info = self.call(msg)
        except BaseException:
            self.proc.kill()
            raise

    def _drain_stderr(self):
        for line in self.proc.stderr:
            self.stderr.append(line.decode("utf-8", "replace").rstrip())

    def _dead(self):
        return RuntimeError("SemunCraft worker exited\n" + "\n".join(self.stderr))

    def send(self, msg):
        try:
            self.proc.stdin.write((json.dumps(msg) + "\n").encode())
            self.proc.stdin.flush()
        except OSError:
            raise self._dead()

    def receive(self):
        line = self.proc.stdout.readline()
        if not line:
            raise self._dead()
        reply = json.loads(line)
        if "error" in reply:
            raise RuntimeError("SemunCraft worker: " + reply["error"] + "\n" + reply.get("stack", ""))
        return reply

    def call(self, msg):
        self.send(msg)
        return self.receive()

    def close(self):
        if self.proc.poll() is None:
            try:
                self.call({"cmd": "close"})
                self.proc.stdin.close()
                self.proc.wait(timeout=5)
            except (OSError, RuntimeError, subprocess.TimeoutExpired):
                self.proc.kill()


class SemunCraftVecEnv:
    """num_envs SemunCraft games spread over num_workers Node processes.

    config: a dict for every env, or a list with one dict per env. Keys (see
        rl/worker.js): mode ("classic" or "pvp" turn order), opponent ("bot",
        "scripted", "random", "external" or "auto"), agentColor, difficulty, theme,
        levels, fog, aiSight (on by default: every player attacks only what it
        sees), maxTurns, shaping, gamma.
    opponent: for envs with opponent "external", a function
        (obs, masks, env_ids) -> actions choosing the opponent's moves; the
        default picks random legal moves.
    on_new_game: optional function(env_index), called whenever an env starts a
        game and before any opponent move in it (for example to pick that
        game's opponent).
    encoding: the rl/encoding.js version to observe and act in (default: the
        latest). A network plays only in the version it was trained on;
        env.encoding, env.channels, env.slots and env.on_board describe it.
    Finished games restart automatically; infos[i] then describes the finished
    game, including its "terminal_observation".
    """

    def __init__(self, num_envs=8, config=None, num_workers=None, seed=0, grid=11, opponent=None,
                 on_new_game=None, node=None, encoding=None):
        if isinstance(config, (list, tuple)):
            configs = [dict(c) for c in config]
            if len(configs) != num_envs:
                raise ValueError("config needs one dict per env")
        else:
            configs = [dict(config or {}) for _ in range(num_envs)]
        seeds = np.random.SeedSequence(seed).generate_state(num_envs)
        for c, s in zip(configs, seeds):
            c.setdefault("seed", int(s))
        self.num_envs = num_envs
        self.opponent = opponent
        self.on_new_game = on_new_game
        self._rng = np.random.default_rng(seed)
        self._workers = []
        self._slots = []  # env index -> (worker index, index inside that worker)
        num_workers = max(1, min(num_workers or os.cpu_count() or 1, num_envs))
        bounds = np.linspace(0, num_envs, num_workers + 1).round().astype(int)
        node = node or find_node()
        try:
            for w in range(num_workers):
                lo, hi = bounds[w], bounds[w + 1]
                self._workers.append(_Worker(node, grid, configs[lo:hi], encoding))
                self._slots += [(w, k) for k in range(hi - lo)]
        except BaseException:
            self.close()
            raise
        info = self._workers[0].info
        self.grid, self.channels, self.num_actions = info["grid"], info["channels"], info["actions"]
        self.encoding, self.slots, self.on_board = info["encoding"], info["slots"], info["onBoard"]
        self.observation_shape = (self.channels, self.grid, self.grid)
        self._obs = np.zeros((num_envs,) + self.observation_shape, np.uint8)
        self._masks = np.zeros((num_envs, self.num_actions), bool)
        self._legal = [[] for _ in range(num_envs)]

    # ── public API ──────────────────────────────────────────────────────────
    def reset(self):
        envs = list(range(self.num_envs))
        results = self._call("reset", envs)
        if self.on_new_game is not None:
            for i in envs:
                self.on_new_game(i)
        self._resolve(envs, results)
        return self.observations()

    def step(self, actions):
        actions = np.asarray(actions).reshape(self.num_envs)
        envs = list(range(self.num_envs))
        rewards, dones, infos = self._resolve(envs, self._call("step", envs, actions))
        return self.observations(), rewards, dones, infos

    def observations(self):
        return self._obs.astype(np.float32) / 255.0

    def action_masks(self):
        return self._masks.copy()

    def legal_actions(self, pad=0):
        """Legal action indices of every env: (indices, counts), where indices is (num_envs, most legal
        actions) int64 and row i's first counts[i] entries are valid; the rest are `pad`."""
        counts = np.array([len(legal) for legal in self._legal], np.int64)
        indices = np.full((self.num_envs, counts.max()), pad, np.int64)
        for i, legal in enumerate(self._legal):
            indices[i, :len(legal)] = legal
        return indices, counts

    def configure(self, config, envs=None):
        """Updates config keys for the given envs (default: all) from each env's next game."""
        groups = collections.defaultdict(list)
        for i in (range(self.num_envs) if envs is None else envs):
            w, k = self._slots[i]
            groups[w].append(k)
        for w, ks in groups.items():
            self._workers[w].call({"cmd": "configure", "envs": ks, "config": config})

    def close(self):
        for worker in self._workers:
            worker.close()
        self._workers = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # ── internals ───────────────────────────────────────────────────────────
    def _call(self, cmd, envs, actions=None):
        """Sends each worker one request for its envs, then collects results in the order of envs."""
        groups = collections.defaultdict(list)
        for j, i in enumerate(envs):
            w, k = self._slots[i]
            groups[w].append((j, k))
        for w, items in groups.items():
            msg = {"cmd": cmd, "envs": [k for _, k in items]}
            if actions is not None:
                msg["actions"] = [int(actions[j]) for j, _ in items]
            self._workers[w].send(msg)
        results = [None] * len(envs)
        for w, items in groups.items():
            for (j, _), res in zip(items, self._workers[w].receive()["results"]):
                results[j] = res
        return results

    def _store(self, i, res):
        self._obs[i] = np.frombuffer(base64.b64decode(res["obs"]), np.uint8).reshape(self.observation_shape)
        self._masks[i] = False
        self._masks[i, res["legal"]] = True
        self._legal[i] = res["legal"]

    def _resolve(self, envs, results):
        """Stores results and plays external opponents' moves until every env waits on the agent."""
        rewards = np.zeros(len(envs), np.float32)
        dones = np.zeros(len(envs), bool)
        infos = [{} for _ in envs]
        positions = range(len(envs))
        while True:
            waiting = []
            for pos, res in zip(positions, results):
                rewards[pos] += res["reward"]
                if res["done"]:
                    dones[pos] = True
                    infos[pos] = self._finished(res["info"])
                    if self.on_new_game is not None:
                        self.on_new_game(envs[pos])
                self._store(envs[pos], res)
                if res["seat"] == "opponent":
                    waiting.append(pos)
            if not waiting:
                return rewards, dones, infos
            ids = [envs[pos] for pos in waiting]
            masks = self._masks[ids]
            if self.opponent is None:
                actions = sample_legal(masks, self._rng)
            else:
                obs = self._obs[ids].astype(np.float32) / 255.0
                actions = np.asarray(self.opponent(obs, masks, np.asarray(ids))).reshape(len(ids))
            results = self._call("step", ids, actions)
            positions = waiting

    def _finished(self, info):
        info = dict(info)
        terminal = np.frombuffer(base64.b64decode(info.pop("terminal_obs")), np.uint8)
        info["terminal_observation"] = terminal.reshape(self.observation_shape).astype(np.float32) / 255.0
        return info
