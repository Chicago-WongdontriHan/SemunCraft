"""Tests and benchmarks for rl/semuncraft_env.py. Run: python rl/test_env.py"""
import collections
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from semuncraft_env import SemunCraftVecEnv, sample_legal  # noqa: E402

failures = 0


def check(ok, message):
    global failures
    if not ok:
        failures += 1
        if failures <= 10:
            print("  FAIL " + message)


def section(name, fn):
    before, t0 = failures, time.time()
    extra = fn()
    status = "ok  " if failures == before else "FAIL"
    print("%s %s (%d ms)%s" % (status, name, (time.time() - t0) * 1000, " - " + extra if extra else ""))


def classic_vs_bot():
    rng = np.random.default_rng(0)
    with SemunCraftVecEnv(16, {"mode": "classic"}, num_workers=4, seed=1) as env:
        obs = env.reset()
        check(obs.shape == (16, 31, 11, 11) and obs.dtype == np.float32, "observation shape %s" % (obs.shape,))
        check(env.num_actions == 11 * 11 * 82 + 1, "action count %d" % env.num_actions)
        winners, games = collections.Counter(), 0
        for _ in range(2000):
            masks = env.action_masks()
            check(masks.any(axis=1).all(), "an env has no legal action")
            obs, rewards, dones, infos = env.step(sample_legal(masks, rng))
            check(np.isin(rewards, (-1.0, 0.0, 1.0)).all(), "unexpected rewards %s" % rewards)
            for i in np.flatnonzero(dones):
                info = infos[i]
                check(info["outcome"] == rewards[i], "reward %s but outcome %s" % (rewards[i], info["outcome"]))
                check(info["agent"] == "w", "agent played %s in classic mode" % info["agent"])
                check(info["terminal_observation"].shape == env.observation_shape, "terminal observation shape")
                winners[info["winner"]] += 1
                games += 1
        check(games > 0, "no game finished")
        return "%d games, winners %s (random White vs the built-in AI)" % (games, dict(winners))


def same_seed_same_games():
    traces = []
    for workers in (2, 3):
        rng = np.random.default_rng(5)
        with SemunCraftVecEnv(8, {"mode": "pvp", "opponent": "random"}, num_workers=workers, seed=9) as env:
            trace = [env.reset()]
            for _ in range(300):
                obs, rewards, dones, _ = env.step(sample_legal(env.action_masks(), rng))
                trace += [obs, rewards, dones]
        traces.append(trace)
    check(all(np.array_equal(a, b) for a, b in zip(*traces)), "same seeds gave different games on 2 and 3 workers")


def external_opponent():
    rng = np.random.default_rng(3)
    asked = [0]

    def opponent(obs, masks):
        asked[0] += len(masks)
        check(obs.shape[1:] == (31, 11, 11) and masks.any(axis=1).all(), "bad opponent input")
        return sample_legal(masks, rng)

    config = {"mode": "pvp", "opponent": "external", "agentColor": "random"}
    with SemunCraftVecEnv(8, config, num_workers=2, seed=4, opponent=opponent) as env:
        env.reset()
        colors, outcomes = collections.Counter(), collections.Counter()
        for _ in range(1500):
            _, rewards, dones, infos = env.step(sample_legal(env.action_masks(), rng))
            for i in np.flatnonzero(dones):
                colors[infos[i]["agent"]] += 1
                outcomes[infos[i]["outcome"]] += 1
        check(asked[0] > 0, "the opponent was never asked to move")
        check(colors["w"] > 0 and colors["b"] > 0, "the agent played only one color: %s" % dict(colors))
        return "opponent moves %d, agent colors %s, outcomes %s" % (asked[0], dict(colors), dict(outcomes))


def campaign_with_shaping():
    rng = np.random.default_rng(8)
    with SemunCraftVecEnv(8, {"mode": "classic", "levels": [0, 1], "shaping": 0.1}, num_workers=2, seed=2) as env:
        env.reset()
        returns, levels = [], set()
        for _ in range(1500):
            _, rewards, dones, infos = env.step(sample_legal(env.action_masks(), rng))
            check(np.abs(rewards).max() <= 1.5, "reward out of range %s" % rewards)
            for i in np.flatnonzero(dones):
                returns.append(infos[i]["episode"]["r"])
                levels.add(infos[i]["scenario"]["level"])
        check(levels == {0, 1}, "levels played: %s" % levels)
        return "%d games, mean return %.2f" % (len(returns), np.mean(returns) if returns else 0)


def configure_switches_mode():
    rng = np.random.default_rng(1)
    with SemunCraftVecEnv(4, {"mode": "classic", "maxTurns": 40}, num_workers=1, seed=3) as env:
        env.reset()
        env.configure({"mode": "pvp", "opponent": "random", "agentColor": "b"})
        modes = []
        for _ in range(400):
            _, _, dones, infos = env.step(sample_legal(env.action_masks(), rng))
            modes += [infos[i]["scenario"]["mode"] for i in np.flatnonzero(dones)]
        check(modes[:4].count("classic") == 4 and "pvp" in modes[4:], "modes of finished games: %s" % modes[:8])


def illegal_action_rejected():
    with SemunCraftVecEnv(2, {"mode": "classic"}, num_workers=1, seed=1) as env:
        env.reset()
        masks = env.action_masks()
        try:
            env.step([np.flatnonzero(~masks[0])[0], np.flatnonzero(masks[1])[0]])
            check(False, "an illegal action was accepted")
        except RuntimeError as err:
            check("not legal" in str(err), "unexpected error: %s" % err)


def throughput():
    n, workers, out = 64, min(os.cpu_count() or 1, 16), []
    for name, config in (("classic vs the built-in AI", {"mode": "classic"}),
                         ("pvp vs random", {"mode": "pvp", "opponent": "random"})):
        rng = np.random.default_rng(0)
        with SemunCraftVecEnv(n, config, num_workers=workers, seed=7) as env:
            env.reset()
            steps, t0 = 0, time.time()
            while time.time() - t0 < 5:
                env.step(sample_legal(env.action_masks(), rng))
                steps += n
            out.append("%s %d" % (name, steps / (time.time() - t0)))
    return "agent steps/s: " + ", ".join(out) + " (%d envs, %d workers, random actions)" % (n, workers)


if __name__ == "__main__":
    section("classic games against the built-in AI", classic_vs_bot)
    section("same seeds give the same games on any worker count", same_seed_same_games)
    section("pvp with an external opponent", external_opponent)
    section("campaign levels with reward shaping", campaign_with_shaping)
    section("configure applies from the next game", configure_switches_mode)
    section("illegal actions are rejected", illegal_action_rejected)
    section("throughput", throughput)
    print("\n" + ("%d failure(s)" % failures if failures else "all environment tests passed"))
    sys.exit(1 if failures else 0)
