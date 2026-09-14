"""Export trained SemunCraft networks for the browser game.

Writes networks' policy weights as half-precision JavaScript files that the game loads on
demand, then checks js/nn.js against PyTorch on real positions. --run takes a training run's
two most-trained networks (models/ai-1.js is the most trained, models/ai-2.js the next);
--checkpoints takes any files, named with --names (ai-1, ai-2, ... by default).

    python rl/export_web.py --run %LOCALAPPDATA%/semuncraft-rl/runs/step3-run
    python rl/export_web.py --checkpoints run/snapshots/update_000100.pt run/snapshots/update_000400.pt --names easy medium
"""
import argparse
import base64
import datetime
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ppo import PolicyValueNet  # noqa: E402
from semuncraft_env import SemunCraftVecEnv, find_node, sample_legal  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POLICY = ("stem.", "body.", "cell_logits.", "skip_logit.")  # the value head isn't needed to play


def load_checkpoint(path):
    """(network weights, training info) from a snapshot (weights only) or a full checkpoint."""
    data = torch.load(path, map_location="cpu", weights_only=True)
    if "net" in data:
        return data["net"], {k: data[k] for k in ("update", "steps", "games", "stage") if k in data}
    match = re.search(r"update_(\d+)", os.path.basename(path))
    return data, {"update": int(match.group(1))} if match else {}


def newest_two(run):
    """Paths of a run's two most-trained networks, most trained first."""
    by_update = {}
    for path in glob.glob(os.path.join(run, "snapshots", "update_*.pt")):
        by_update[int(re.search(r"update_(\d+)", path).group(1))] = path
    latest = os.path.join(run, "latest.pt")
    if os.path.exists(latest):
        update = torch.load(latest, map_location="cpu", weights_only=True)["update"]
        by_update[update] = latest  # full state at the end of the run (same weights as final.pt)
    if len(by_update) < 2:
        raise SystemExit("need at least two checkpoints in " + run)
    return [by_update[u] for u in sorted(by_update, reverse=True)[:2]]


def architecture(state):
    blocks = 0
    while "body.%d.conv1.weight" % blocks in state:
        blocks += 1
    return {"channels": state["stem.weight"].shape[1], "width": state["stem.weight"].shape[0], "blocks": blocks}


def export(state, info, name, source, out_dir):
    tensors, chunks = [], []
    for key, value in state.items():
        if key.startswith(POLICY):
            tensors.append([key, list(value.shape)])
            chunks.append(value.detach().cpu().contiguous().to(torch.float16).numpy().astype("<f2").tobytes())
    meta = dict(info, name=name, source=source, grid=11, exported=datetime.date.today().isoformat(), **architecture(state))
    body = {"meta": meta, "dtype": "float16", "tensors": tensors, "data": base64.b64encode(b"".join(chunks)).decode()}
    path = os.path.join(out_dir, name + ".js")
    with open(path, "w", newline="\n") as f:
        f.write("// SemunCraft network exported by rl/export_web.py from %s; don't edit by hand.\n" % source)
        f.write("(function(root){(root.SemunModels=root.SemunModels||{})[%s]=%s;})"
                "(typeof globalThis!=='undefined'?globalThis:this);\n" % (json.dumps(name), json.dumps(body, separators=(",", ":"))))
    return path, meta


def logits_of(state, obs, half=False):
    net = PolicyValueNet(**architecture(state))
    net.load_state_dict({k: v.to(torch.float16).float() if half else v for k, v in state.items()})
    with torch.no_grad():
        return net.eval()(torch.as_tensor(obs))[0].numpy()


def check(exported, workdir):
    """Compares js/nn.js with PyTorch on positions from real games (classic order, both colors)."""
    config = {"mode": "classic", "opponent": "random", "agentColor": "random", "maxTurns": 160}
    rng, obs, legal = np.random.default_rng(0), [], []
    with SemunCraftVecEnv(8, config, num_workers=2, seed=5) as env:
        env.reset()
        for step in range(40):
            masks = env.action_masks()
            if step % 10 == 9:
                obs.append(env.observations())
                legal += [np.flatnonzero(m).tolist() for m in masks]
            env.step(sample_legal(masks, rng))
    obs = np.concatenate(obs)
    spec = {"observations": base64.b64encode(np.round(obs * 255).astype(np.uint8).tobytes()).decode(),
            "count": len(obs), "legal": legal, "models": []}
    for path, state in exported:
        spec["models"].append({"file": path,
                               "logits": base64.b64encode(logits_of(state, obs).astype("<f4").tobytes()).decode(),
                               "halfLogits": base64.b64encode(logits_of(state, obs, half=True).astype("<f4").tobytes()).decode()})
    spec_path = os.path.join(workdir, "nn-check.json")
    with open(spec_path, "w") as f:
        json.dump(spec, f)
    return subprocess.run([find_node(), os.path.join(ROOT, "tests", "nn.test.js"), spec_path]).returncode


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--run", help="training run folder: export its two most-trained networks as ai-1 and ai-2")
    group.add_argument("--checkpoints", nargs="+", metavar="PT", help="checkpoint files to export")
    p.add_argument("--names", nargs="+", help="model names for --checkpoints (default ai-1, ai-2, ...)")
    p.add_argument("--out", default=os.path.join(ROOT, "models"))
    args = p.parse_args()

    paths = newest_two(args.run) if args.run else args.checkpoints
    names = args.names or ["ai-%d" % i for i in range(1, len(paths) + 1)]
    if len(names) != len(paths):
        raise SystemExit("give one name per checkpoint")
    os.makedirs(args.out, exist_ok=True)
    exported = []
    for name, path in zip(names, paths):
        state, info = load_checkpoint(path)
        folder = os.path.abspath(args.run) if args.run else os.path.dirname(os.path.dirname(os.path.abspath(path)))
        source = os.path.basename(folder) + "/" + os.path.relpath(os.path.abspath(path), folder).replace(os.sep, "/")
        out, meta = export(state, info, name, source, args.out)
        exported.append((out, state))
        print("%s: %s, update %s, %.1f MB" % (out, source, meta.get("update", "?"), os.path.getsize(out) / 1e6), flush=True)
    with tempfile.TemporaryDirectory() as workdir:
        sys.exit(check(exported, workdir))


if __name__ == "__main__":
    main()
