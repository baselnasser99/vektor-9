"""One tick of the city: step(state, marks, rng) -> (new_state, events). Pure and deterministic."""

import random
from functools import cache

from sim import rules as R
from sim.cycles import blackout_window, wave
from sim.rng import choice, randint
from sim.state import (
    SECTORS,
    apply_power,
    chebyshev,
    counter,
    is_count,
    near,
    new_tile,
    power_grid,
    sector,
    xy,
)


def tick_rng(state):
    """The rng for the tick after `state`, so any tick can be replayed from its snapshot alone."""
    return random.Random(f"{state['seed']}:{state['tick'] + 1}")


def resume_error(state):
    """Why this code must not advance `state`, or None (ADR-0013). validate() says whether a
    snapshot is well formed; this says whether these rules may continue it. Older rules versions may
    be continued: the next tick records the new version. Newer rules or another schema are refused,
    so rules versions are never mixed silently."""
    if state.get("schema") != R.SCHEMA:
        return f"snapshot schema {state.get('schema')!r}; this code advances schema {R.SCHEMA}"
    sim = state.get("sim")
    if not (is_count(sim) and 1 <= sim <= R.SIM_VERSION):
        return f"snapshot from simulation version {sim!r}; this code runs version {R.SIM_VERSION}"
    return None


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
        if not (is_count(mark.get(key)) and mark[key] < R.SIZE):
            return f"bad {key}"
    return None


def event(kind, x, y):
    return {"kind": kind, "sector": sector(x, y), "x": x, "y": y}


# Ring of every tile index: its Chebyshev distance from the centre in tiles, 0 for the centre four.
RINGS = [
    max(abs(2 * x + 1 - R.SIZE), abs(2 * y + 1 - R.SIZE)) // 2 for x, y in map(xy, range(R.SIZE**2))
]


@cache
def _weights(backbone, arterial, minor, reach, front_build, centre_build):
    best = {}  # tile index: the strongest backbone role it faces
    for along, at, role in backbone:
        for i in range(R.SIZE**2):
            # A corridor along x on boundary `at` is faced by rows at - 1 and at; along y, columns.
            if xy(i)[1 if along == "x" else 0] in (at - 1, at) and best.get(i) != "boulevard":
                best[i] = role
    out = []
    for i, ring in enumerate(RINGS):
        f = {"boulevard": 1, "arterial": arterial}.get(best.get(i), minor)
        c = max(0, 1 - ring / reach)
        out.append((f, c, 1 + front_build * f + centre_build * c))
    return tuple(out)


def weights(plan):
    """(F, C, growth factor) for every tile index: its frontage on the plan's backbone, its
    centrality, and what its build chance is multiplied by (ADR-0015). Cached per backbone and
    constants, so a tick pays for one tuple lookup."""
    backbone = tuple((b["along"], b["at"], b["role"]) for b in plan["backbone"])
    return _weights(backbone, R.ARTERIAL_SHARE, R.MINOR_SHARE, R.CENTRE_REACH, R.FRONT_BUILD,
                    R.CENTRE_BUILD)  # fmt: skip


def height_cap(x, y, tiles, w):
    """Tallest a new building here may be: a few floors above its neighbors' average, more on the
    backbone and toward the centre, never above the envelope that falls toward the edge."""
    f, c, _ = w
    r = R.HEIGHT_RADIUS
    floors = [
        tiles[ny * R.SIZE + nx]["f"]
        for ny in range(max(0, y - r), min(R.SIZE, y + r + 1))
        for nx in range(max(0, x - r), min(R.SIZE, x + r + 1))
        if tiles[ny * R.SIZE + nx]["k"] == "house"
    ]
    avg = sum(floors) // len(floors) if floors else 0
    front = int(R.FRONT_FLOORS * f)
    # Capped at FLOORS_MAX as before, so no building gets taller than any version has drawn.
    envelope = min(R.FLOORS_MAX, R.EDGE_FLOORS + int((R.FLOORS_MAX - R.EDGE_FLOORS) * c) + front)
    wanted = avg + R.HEIGHT_STEP + front + int(R.CENTRE_FLOORS * c)
    return min(envelope, max(R.FLOORS_MIN + 2, wanted))


def new_build(x, y, tiles, rng, tick, w, low=None):
    cap = height_cap(x, y, tiles, w)
    if low is None:
        low = min(cap, R.FLOORS_MIN + int(R.CENTRE_LOW * w[1]))
    return new_tile("build", rng, target=randint(rng, low, cap), tick=tick)


def built_percent(tiles):
    """Percent of each sector's buildable tiles (not terrain) that are built on, keyed by sector."""
    built, room = {}, {}
    for s, t in zip(SECTORS, tiles, strict=True):
        if t["k"] not in R.TERRAIN:
            built[s] = built.get(s, 0) + (t["k"] != "lot")
            room[s] = room.get(s, 0) + 1
    return {s: 100 * built.get(s, 0) // room[s] if s in room else 0 for s in sorted(set(SECTORS))}


def step(state, marks, rng):
    if why := resume_error(state):
        raise ValueError(f"cannot advance this snapshot: {why}")
    old = state["tiles"]
    tiles = [dict(t) for t in old]
    tick = state["tick"] + 1
    events = []

    # Visitor marks: malformed ones are dropped, each valid ID is handled at most once.
    w = weights(state["plan"])
    seen = set(state["mark_ids"])
    mark_ids = list(state["mark_ids"])
    for m in marks:
        if mark_error(m) or m["id"] in seen:
            continue
        seen.add(m["id"])
        mark_ids.append(m["id"])
        i = m["y"] * R.SIZE + m["x"]
        if tiles[i]["k"] == "lot":
            tiles[i] = new_build(m["x"], m["y"], old, rng, tick, w[i])
            events.append(event("commissioned", m["x"], m["y"]))

    # Growth and decay read last tick's layout and power: a change shows up for neighbors next tick.
    plants, serving, loads = power_grid(old)
    maxed = [plant_load >= R.PLANT_CAPACITY for plant_load in loads]
    built = built_percent(old)
    waves = {s: wave(state["seed"], s, tick) for s in built}
    booms = {s: w > R.BOOM for s, w in waves.items()}
    declines = {s: w < R.DECLINE and built[s] >= R.DECLINE_MIN_BUILT for s, w in waves.items()}
    markets_near, houses_near = counter(old, "market"), counter(old, "house")
    for i, t in enumerate(tiles):
        x, y = xy(i)
        s = SECTORS[i]
        powered = old[i]["on"]
        has_market = markets_near(x, y, R.MARKET_RADIUS) > 0
        can_grow = powered and serving[i] is not None and not maxed[serving[i]]
        booming, declining = booms[s], declines[s]
        k = t["k"]
        if k == "lot":
            chance = R.BUILD_CHANCE * (R.BOOM_BUILD_BONUS if booming else 1) * w[i][2]
            if can_grow and not declining and rng.random() < chance and has_market:
                tiles[i] = new_build(x, y, old, rng, tick, w[i])
            elif (
                rng.random() < R.MARKET_OPEN_CHANCE
                and not has_market
                and houses_near(x, y, R.MARKET_RADIUS) >= R.MARKET_OPEN_HOUSES
            ):
                tiles[i] = new_tile("market", rng, tick=tick)
                events.append(event("market_opened", x, y))
        elif k == "build":
            if powered:
                t["f"] += 1
                if t["f"] >= t["t"]:
                    t.update(k="house", f=t["t"], p=0, b=tick)
                    if t["t"] >= R.TALL:
                        events.append(event("topped_out", x, y))
        elif k == "house":
            if not powered:
                t["p"] = max(0, t["p"] - R.DECAY)
            elif declining:
                t["p"] = max(0, t["p"] - R.DECLINE_LOSS)
            elif can_grow and has_market:
                t["p"] = min(t["f"] * R.PEOPLE_PER_FLOOR, t["p"] + randint(rng, 0, R.GROWTH))
            if t["p"] > t["f"] * R.PEOPLE_PER_FLOOR:
                if rng.random() < R.OVERCROWD_DECAY_CHANCE:
                    t["f"] -= 1
                    t["p"] = max(0, t["p"] - R.PEOPLE_PER_FLOOR)
            elif (
                t["p"] == 0
                and (declining or not has_market)
                and rng.random() < R.EMPTY_DECAY_CHANCE
            ):
                t["f"] -= 1
            if t["f"] == 0:
                tiles[i] = new_tile("lot", rng, tick=tick)
                events.append(event("collapse", x, y))
            elif (
                can_grow
                and not declining
                and built[s] >= R.REDEVELOP_BUILT
                and rng.random() < R.REDEVELOP_CHANCE
                and height_cap(x, y, old, w[i]) >= t["f"] + 2
            ):
                tiles[i] = new_build(x, y, old, rng, tick, w[i], low=t["f"] + 2)
        elif k == "market":
            if not houses_near(x, y, R.MARKET_RADIUS) and rng.random() < R.MARKET_CLOSE_CHANCE:
                tiles[i] = new_tile("lot", rng, tick=tick)
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
            and houses_near(*xy(i), 1)
        ]
        if spots:
            i = choice(rng, spots)
            tiles[i] = new_tile("plant", rng, tick=tick)
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
        "sim": R.SIM_VERSION,  # the rules that made this tick, not the ones that made the last
        "tick": tick,
        "tiles": tiles,
        "power": power,
        "events": events,
        "mark_ids": mark_ids[-R.MARK_IDS_KEEP :],
    }
    return new_state, events
