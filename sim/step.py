"""One tick of the city: step(state, marks, rng) -> (new_state, events). Pure and deterministic."""

import random

from sim import rules as R
from sim.cycles import blackout_window, wave
from sim.state import apply_power, chebyshev, count_near, near, new_tile, power_grid, sector, xy


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


def height_cap(x, y, tiles):
    """Tallest a new building here may be: a few floors above its neighbors' average."""
    r = R.HEIGHT_RADIUS
    floors = [
        tiles[ny * R.SIZE + nx]["f"]
        for ny in range(max(0, y - r), min(R.SIZE, y + r + 1))
        for nx in range(max(0, x - r), min(R.SIZE, x + r + 1))
        if tiles[ny * R.SIZE + nx]["k"] == "house"
    ]
    avg = sum(floors) // len(floors) if floors else 0
    return max(R.FLOORS_MIN + 2, min(R.FLOORS_MAX, avg + R.HEIGHT_STEP))


def new_build(x, y, tiles, rng, low=R.FLOORS_MIN):
    return new_tile("build", rng, target=rng.randint(low, height_cap(x, y, tiles)))


def built_percent(tiles):
    """Percent of each sector's tiles that are not empty lots, keyed by sector number."""
    counts = {}
    for i, t in enumerate(tiles):
        s = sector(*xy(i))
        counts[s] = counts.get(s, 0) + (t["k"] != "lot")
    return {s: 100 * n // (R.BLOCK * R.BLOCK) for s, n in counts.items()}


def step(state, marks, rng):
    old = state["tiles"]
    tiles = [dict(t) for t in old]
    tick = state["tick"] + 1
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
            tiles[i] = new_build(m["x"], m["y"], old, rng)
            events.append(event("commissioned", m["x"], m["y"]))

    # Growth and decay read last tick's layout and power: a change shows up for neighbors next tick.
    plants, serving, loads = power_grid(old)
    maxed = [plant_load >= R.PLANT_CAPACITY for plant_load in loads]
    built = built_percent(old)
    waves = {s: wave(state["seed"], s, tick) for s in built}
    markets = [xy(i) for i, t in enumerate(old) if t["k"] == "market"]
    houses = [xy(i) for i, t in enumerate(old) if t["k"] == "house"]
    for i, t in enumerate(tiles):
        x, y = xy(i)
        s = sector(x, y)
        powered = old[i]["on"]
        can_grow = powered and serving[i] is not None and not maxed[serving[i]]
        booming = waves[s] > R.BOOM
        declining = waves[s] < R.DECLINE and built[s] >= R.DECLINE_MIN_BUILT
        k = t["k"]
        if k == "lot":
            chance = R.BUILD_CHANCE * (R.BOOM_BUILD_BONUS if booming else 1)
            if (
                can_grow
                and not declining
                and rng.random() < chance
                and near(x, y, markets, R.MARKET_RADIUS)
            ):
                tiles[i] = new_build(x, y, old, rng)
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
            elif declining:
                t["p"] = max(0, t["p"] - R.DECLINE_LOSS)
            elif can_grow and near(x, y, markets, R.MARKET_RADIUS):
                t["p"] = min(t["f"] * R.PEOPLE_PER_FLOOR, t["p"] + rng.randint(0, R.GROWTH))
            if t["p"] > t["f"] * R.PEOPLE_PER_FLOOR:
                if rng.random() < R.OVERCROWD_DECAY_CHANCE:
                    t["f"] -= 1
                    t["p"] = max(0, t["p"] - R.PEOPLE_PER_FLOOR)
            elif (
                t["p"] == 0
                and (declining or not near(x, y, markets, R.MARKET_RADIUS))
                and rng.random() < R.EMPTY_DECAY_CHANCE
            ):
                t["f"] -= 1
            if t["f"] == 0:
                tiles[i] = new_tile("lot", rng)
                events.append(event("collapse", x, y))
            elif (
                can_grow
                and not declining
                and built[s] >= R.REDEVELOP_BUILT
                and rng.random() < R.REDEVELOP_CHANCE
                and height_cap(x, y, old) >= t["f"] + 2
            ):
                tiles[i] = new_build(x, y, old, rng, low=t["f"] + 2)
        elif k == "market":
            if not near(x, y, houses, R.MARKET_RADIUS) and rng.random() < R.MARKET_CLOSE_CHANCE:
                tiles[i] = new_tile("lot", rng)
                events.append(event("market_closed", x, y))

    # A strained plant gets a new neighbor at the city's edge, extending where the city can grow.
    strained = [
        j for j, plant_load in enumerate(loads) if plant_load >= R.PLANT_STRAIN * R.PLANT_CAPACITY
    ]
    if strained and rng.random() < R.PLANT_BUILD_CHANCE:
        hub = xy(plants[max(strained, key=lambda j: loads[j])])
        plant_xy = [xy(i) for i in plants]
        spots = [
            i
            for i, t in enumerate(tiles)
            if t["k"] == "lot"
            and chebyshev(*xy(i), *hub) <= R.PLANT_REACH
            and not near(*xy(i), plant_xy, R.PLANT_SPACING - 1)
            and near(*xy(i), houses, 1)
        ]
        if spots:
            i = rng.choice(spots)
            tiles[i] = new_tile("plant", rng)
            events.append(event("plant_opened", *xy(i)))

    # Scheduled blackout: the most loaded plant goes dark for the whole window.
    dark = None
    in_window, first = blackout_window(state["seed"], tick)
    if in_window and plants:
        still_dark = [i for i in plants if not old[i]["on"]]
        dark = still_dark[0] if still_dark and not first else plants[loads.index(max(loads))]
    power = apply_power(tiles, dark)
    for i in plants:
        if tiles[i]["on"] != old[i]["on"]:
            events.append(event("power_restored" if tiles[i]["on"] else "blackout", *xy(i)))

    new_state = {
        **state,
        "tick": tick,
        "tiles": tiles,
        "power": power,
        "events": events,
        "mark_ids": mark_ids[-R.MARK_IDS_KEEP :],
    }
    return new_state, events
