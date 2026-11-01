"""Run the city for N ticks and write one snapshot per tick: python -m sim --help"""

import argparse
import json
from collections import Counter
from pathlib import Path

from sim.state import new_city
from sim.step import step, tick_rng


def write(state, out):
    (out / f"{state['tick']:06d}.json").write_text(json.dumps(state, separators=(",", ":")))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m sim", description=__doc__)
    parser.add_argument("--ticks", type=int, default=288, help="ticks to run (288 = one day)")
    parser.add_argument("--seed", type=int, default=7, help="world seed (non-negative)")
    parser.add_argument("--out", type=Path, default=Path("snapshots"), help="output folder")
    args = parser.parse_args(argv)
    if args.seed < 0 or args.ticks < 0:
        parser.error("--seed and --ticks must be non-negative")

    args.out.mkdir(parents=True, exist_ok=True)
    state = new_city(args.seed)
    write(state, args.out)
    totals = Counter()
    for _ in range(args.ticks):
        state, events = step(state, [], tick_rng(state))
        totals.update(e["kind"] for e in events)
        write(state, args.out)

    tiles = state["tiles"]
    print(f"tick {state['tick']}, snapshots in {args.out}")
    print("tiles:", dict(Counter(t["k"] for t in tiles)))
    print("population:", sum(t["p"] for t in tiles))
    print("power:", state["power"], "| unpowered tiles:", sum(not t["on"] for t in tiles))
    print("events:", dict(totals))


if __name__ == "__main__":
    main()
