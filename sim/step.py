"""One tick of the city: step(state, marks, rng) -> (new_state, events). Pure and deterministic."""

import random

from sim import rules as R
from sim.state import apply_power, count_near, near, new_tile, sector, xy


def tick_rng(state):
    """The rng for the tick after `state`, so any tick can be replayed from its snapshot alone."""
    return random.Random(f"{state['seed']}:{state['tick'] + 1}")


def mark_error(mark):
    """Return why a visitor mark is malformed, or None. Lot availability is checked in step()."""
    if not isinstance(mark, dict):
        return "mark must be an object"
    mid = mark.get("id")
    if not isinstance(mid, str) or not 0 < len(mid) <= R.MARK_ID_MAX_LEN:
        return "bad id"
    if mark.get("kind") not in R.MARK_KINDS:
        return "bad kind"
    for key in ("x", "y"):
        v = mark.get(key)
        if not isinstance(v, int) or isinstance(v, bool) or not 0 <= v < R.SIZE:
            return f"bad {key}"
    return None


def event(kind, x, y):
    return {"kind": kind, "sector": sector(x, y), "x": x, "y": y}


def step(state, marks, rng):
    old = state["tiles"]
    tiles = [dict(t) for t in old]
    events = []

    # Visitor marks: malformed ones are dropped, each valid ID is handled at most once.
    seen = set(state["mark_ids"])
    mark_ids = list(state["mark_ids"])
    for m in marks:
        if mark_error(m) or m["id"] in seen:
            continue
        seen.add(m["id"])
        mark_ids.append(m["id"])
        i = m["y"] * R.SIZE + m["x"]
        if tiles[i]["k"] == "lot":
            tiles[i] = new_tile("build", rng, target=rng.randint(*R.FLOORS))
            events.append(event("commissioned", m["x"], m["y"]))

    # Growth and decay read last tick's layout and power: a change shows up for neighbors next tick.
    markets = [xy(i) for i, t in enumerate(old) if t["k"] == "market"]
    houses = [xy(i) for i, t in enumerate(old) if t["k"] == "house"]
    for i, t in enumerate(tiles):
        x, y = xy(i)
        powered = old[i]["on"]
        k = t["k"]
        if k == "lot":
            if powered and rng.random() < R.BUILD_CHANCE and near(x, y, markets, R.MARKET_RADIUS):
                tiles[i] = new_tile("build", rng, target=rng.randint(*R.FLOORS))
            elif (
                rng.random() < R.MARKET_OPEN_CHANCE
                and not near(x, y, markets, R.MARKET_RADIUS)
                and count_near(x, y, houses, R.MARKET_RADIUS) >= R.MARKET_OPEN_HOUSES
            ):
                tiles[i] = new_tile("market", rng)
                events.append(event("market_opened", x, y))
        elif k == "build":
            if powered:
                t["f"] += 1
                if t["f"] >= t["t"]:
                    t.update(k="house", f=t["t"], p=0)
                    if t["t"] >= R.TALL:
                        events.append(event("topped_out", x, y))
        elif k == "house":
            if not powered:
                t["p"] = max(0, t["p"] - R.DECAY)
            elif near(x, y, markets, R.MARKET_RADIUS):
                t["p"] += rng.randint(0, R.GROWTH)
            if t["p"] > t["f"] * R.PEOPLE_PER_FLOOR:
                if rng.random() < R.OVERCROWD_DECAY_CHANCE:
                    t["f"] -= 1
                    t["p"] = max(0, t["p"] - R.PEOPLE_PER_FLOOR)
            elif t["p"] == 0 and rng.random() < R.EMPTY_DECAY_CHANCE:
                t["f"] -= 1
            if t["f"] == 0:
                tiles[i] = new_tile("lot", rng)
                events.append(event("collapse", x, y))
        elif k == "market":
            if not near(x, y, houses, R.MARKET_RADIUS) and rng.random() < R.MARKET_CLOSE_CHANCE:
                tiles[i] = new_tile("lot", rng)
                events.append(event("market_closed", x, y))

    power = apply_power(tiles)
    for i, t in enumerate(tiles):
        if t["k"] == "plant" and old[i]["k"] == "plant" and t["on"] != old[i]["on"]:
            events.append(event("power_restored" if t["on"] else "blackout", *xy(i)))

    new_state = {
        **state,
        "tick": state["tick"] + 1,
        "tiles": tiles,
        "power": power,
        "events": events,
        "mark_ids": mark_ids[-R.MARK_IDS_KEEP :],
    }
    return new_state, events
