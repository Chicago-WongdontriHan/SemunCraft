"""Tests for rl/ppo.py, with an optional speed benchmark of the policy head.

    python rl/test_ppo.py                 # tests on the CPU
    python rl/test_ppo.py --bench cuda    # also time a training minibatch, all actions vs legal actions only
"""
import argparse
import os
import sys
import time

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ppo import SLOT_BIAS, PolicyValueNet, Rollout, Runner, encoding_of, legal_dist, masked_dist, ppo_update  # noqa: E402
from semuncraft_env import ENCODINGS, LATEST_ENCODING, SemunCraftVecEnv, sample_legal  # noqa: E402

LAYOUT = ENCODINGS[LATEST_ENCODING]
ACTIONS = 11 * 11 * LAYOUT["slots"] + 1
failures = 0


def check(ok, message):
    global failures
    if not ok:
        failures += 1
        print("  FAIL " + message)


def section(name, fn):
    before, t0 = failures, time.time()
    extra = fn()
    print("%s %s (%d ms)%s" % ("ok  " if failures == before else "FAIL", name, (time.time() - t0) * 1000,
                               " - " + extra if extra else ""))


def random_legal(batch, per_row, generator):
    """Random masks with about per_row legal actions (skip always legal) and the matching padded index lists."""
    masks = torch.rand(batch, ACTIONS, generator=generator) < per_row / ACTIONS
    masks[:, -1] = True
    counts = masks.sum(1)
    legal = torch.zeros(batch, int(counts.max()), dtype=torch.long)
    for i in range(batch):
        found = masks[i].nonzero().squeeze(1)
        legal[i, :len(found)] = found
    return masks, legal, counts


def legal_matches_all_actions():
    g = torch.Generator().manual_seed(0)
    logits = torch.randn(64, ACTIONS, generator=g) * 3
    masks, legal, counts = random_legal(64, 50, g)
    full, restricted = masked_dist(logits, masks), legal_dist(logits, legal, counts)
    picks = torch.stack([torch.randint(int(c), (1,), generator=g)[0] for c in counts])
    actions = legal.gather(1, picks[:, None]).squeeze(1)
    check(torch.allclose(full.log_prob(actions), restricted.log_prob(picks), atol=1e-4), "log-probabilities differ")
    check(torch.allclose(full.entropy(), restricted.entropy(), atol=1e-4), "entropies differ")
    samples = restricted.sample((2000,))
    check(bool((samples < counts).all()), "sampled a padding position")


def encoding_1_networks_still_load():
    """A network shaped like the ones trained on encoding 1 is recognised and builds with its own head."""
    e = ENCODINGS[1]
    old = PolicyValueNet(e["channels"], width=16, blocks=1, slots=e["slots"], on_board=e["on_board"])
    check(encoding_of(old.state_dict()) == 1, "an encoding 1 network is not recognised")
    logits, _ = old(torch.zeros(2, e["channels"], 11, 11))
    check(logits.shape == (2, 11 * 11 * e["slots"] + 1), "encoding 1 logits %s" % (tuple(logits.shape),))


def fresh_policy_is_even_over_kinds():
    """With SLOT_BIAS a new network gives orders in a minority of its moves; without it, in most of them."""
    rng, g = np.random.default_rng(4), torch.Generator().manual_seed(2)
    slots = ENCODINGS[2]["slots"]
    kind = lambda i: "skip" if i == 11 * 11 * slots else ("order" if i % slots >= 84 else "scry" if i % slots == 82 else "other")
    out = []
    with SemunCraftVecEnv(16, {"mode": "classic", "opponent": "random", "agentColor": "random"}, num_workers=2, seed=8) as env:
        check(env.encoding == 2, "this test is about encoding 2")
        frames = [env.reset()]
        for _ in range(12):
            frames.append(env.step(sample_legal(env.action_masks(), rng))[0])
        obs, masks = torch.as_tensor(np.concatenate(frames)), None
        # the masks belong to the last frame only, so judge the policy on that frame's legal actions
        legal = torch.as_tensor(env.action_masks())
        obs = obs[-16:]
        shares = {}
        for name, bias in (("biased", SLOT_BIAS[2]), ("plain", None)):
            torch.manual_seed(1)
            net = PolicyValueNet(env.channels, width=16, blocks=1, slots=slots, on_board=env.on_board, slot_bias=bias)
            with torch.no_grad():
                dist = masked_dist(net(obs)[0], legal)
            picks = dist.sample((200,)).reshape(-1).tolist()
            counts = {}
            for p in picks:
                counts[kind(p)] = counts.get(kind(p), 0) + 1
            shares[name] = counts.get("order", 0) / len(picks)
            out.append("%s: orders %.0f%%, Scry %.0f%%" % (name, 100 * shares[name], 100 * counts.get("scry", 0) / len(picks)))
        check(0.03 < shares["biased"] < 0.45, "the biased start gives orders %.2f of the time" % shares["biased"])
        check(shares["plain"] > shares["biased"] + 0.2, "the plain start gives orders only %.2f of the time" % shares["plain"])
    return "; ".join(out)


def short_training():
    device = torch.device("cpu")
    with SemunCraftVecEnv(8, {"mode": "classic", "levels": [0]}, num_workers=2, seed=3) as env:
        net = PolicyValueNet(env.channels, width=16, blocks=1, slots=env.slots, on_board=env.on_board).to(device)
        check(encoding_of(net.state_dict()) == env.encoding, "encoding_of does not recognise the network")
        check(net(torch.zeros((1,) + env.observation_shape))[0].shape == (1, env.num_actions), "logit count")
        opt = torch.optim.Adam(net.parameters(), lr=1e-3)
        rollout, runner = Rollout(16, env, device), Runner(env, device)
        games = []
        for _ in range(3):
            runner.collect(net, rollout, lambda i, info: games.append(info["outcome"]))
            stats = ppo_update(net, opt, rollout, epochs=2, minibatch=32)
            check(all(np.isfinite(v) for v in stats.values()), "non-finite statistics %s" % stats)
        check(int(rollout.counts.min()) >= 1, "a step had no legal actions")
        return "%d games; %s" % (len(games), ", ".join("%s %.3f" % kv for kv in sorted(stats.items())))


def bench(device):
    """Forward and backward of a 2,048-sample minibatch through the training network, both ways."""
    g = torch.Generator().manual_seed(1)
    net = PolicyValueNet(LAYOUT["channels"], width=96, blocks=6, slots=LAYOUT["slots"], on_board=LAYOUT["on_board"]).to(device)
    obs = torch.rand(2048, LAYOUT["channels"], 11, 11, generator=g).to(device)
    masks, legal, counts = (x.to(device) for x in random_legal(2048, 60, g))
    picks = (torch.rand(2048, generator=g).to(device) * counts).long()
    actions = legal.gather(1, picks[:, None]).squeeze(1)
    out = []
    for name, loss_fn in (("all actions", lambda logits: masked_dist(logits, masks)),
                          ("legal actions only", lambda logits: legal_dist(logits, legal, counts))):
        take = actions if name == "all actions" else picks
        for i in range(13):
            if i == 3:  # warm-up done
                torch.cuda.synchronize() if device.type == "cuda" else None
                t0 = time.time()
            logits, value = net(obs)
            dist = loss_fn(logits)
            (-(dist.log_prob(take)).mean() - 0.01 * dist.entropy().mean() + value.pow(2).mean()).backward()
            net.zero_grad()
        if device.type == "cuda":
            torch.cuda.synchronize()
        out.append("%s %.0f ms" % (name, (time.time() - t0) / 10 * 1000))
    return "per minibatch: " + ", ".join(out)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--bench", metavar="DEVICE", help="also benchmark on this device (cpu or cuda)")
    args = p.parse_args()
    section("the legal-actions distribution equals the masked one over all actions", legal_matches_all_actions)
    section("an encoding 1 network is recognised and runs", encoding_1_networks_still_load)
    section("a fresh network starts roughly even over kinds of action", fresh_policy_is_even_over_kinds)
    section("collect and update on campaign level 1", short_training)
    if args.bench:
        section("policy head speed", lambda: bench(torch.device(args.bench)))
    print("\n" + ("%d failure(s)" % failures if failures else "all PPO tests passed"))
    sys.exit(1 if failures else 0)
