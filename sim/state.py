"""City state: creation, power, and validation. The state dict is the snapshot (ADR-0003)."""

import random

from sim import rules as R

TILE_KEYS = {"k", "f", "t", "p", "on", "s"}
POWER_KEYS = ("capacity", "demand", "supplied")


def xy(i):
    return i % R.SIZE, i // R.SIZE


def sector(x, y):
    return 1 + (y // R.BLOCK) * (R.SIZE // R.BLOCK) + x // R.BLOCK


def chebyshev(x, y, px, py):
    return max(abs(x - px), abs(y - py))


def count_near(x, y, points, radius):
    return sum(chebyshev(x, y, px, py) <= radius for px, py in points)


def near(x, y, points, radius):
    return any(chebyshev(x, y, px, py) <= radius for px, py in points)


def new_tile(kind, rng, floors=0, target=0, people=0):
    return {"k": kind, "f": floors, "t": target, "p": people, "on": False,
            "s": rng.randrange(R.STYLE_SEED_MAX)}  # fmt: skip


def load(tile):
    return {"house": tile["p"], "build": R.BUILD_LOAD, "market": R.MARKET_LOAD}.get(tile["k"], 0)


def power_grid(tiles):
    """Plant tile indexes, which plant serves each tile (index into plants, or None), plant loads.

    Each tile draws from its nearest plant in range (ties go to the first plant in row order).
    """
    plants = [i for i, t in enumerate(tiles) if t["k"] == "plant"]
    plant_xy = [xy(i) for i in plants]
    loads = [0] * len(plants)
    serving = [None] * len(tiles)
    for i, t in enumerate(tiles):
        x, y = xy(i)
        best = None
        for j, (px, py) in enumerate(plant_xy):
            d = chebyshev(x, y, px, py)
            if d <= R.PLANT_RADIUS and (best is None or d < best[0]):
                best = (d, j)
        if best:
            serving[i] = best[1]
            loads[best[1]] += load(t)
    return plants, serving, loads


def apply_power(tiles, dark=None):
    """Set each tile's `on` flag in place and return the power summary.

    Every tile a plant reaches has power, except those served by plant tile `dark` (a scheduled
    blackout). A plant past capacity still keeps the lights on; it only stops growth (see step).
    """
    plants, serving, loads = power_grid(tiles)
    for i, t in enumerate(tiles):
        t["on"] = serving[i] is not None and plants[serving[i]] != dark
    return {
        "capacity": R.PLANT_CAPACITY * len(plants),
        "demand": sum(loads),
        "supplied": sum(
            min(plant_load, R.PLANT_CAPACITY)
            for i, plant_load in zip(plants, loads, strict=True)
            if i != dark
        ),
    }


def new_city(seed):
    """A small core around the center: one plant, a couple of markets, a few low houses."""
    rng = random.Random(seed)
    c = R.SIZE // 2
    core = [i for i in range(R.SIZE * R.SIZE) if 0 < chebyshev(*xy(i), c, c) <= R.START_RADIUS]
    markets = set(rng.sample(core, R.START_MARKETS))
    market_xy = [xy(i) for i in markets]
    tiles = []
    for i in range(R.SIZE * R.SIZE):
        x, y = xy(i)
        if (x, y) == (c, c):
            tiles.append(new_tile("plant", rng))
        elif i in markets:
            tiles.append(new_tile("market", rng))
        elif (
            chebyshev(x, y, c, c) <= R.START_RADIUS
            and near(x, y, market_xy, R.MARKET_RADIUS)
            and rng.random() < R.START_HOUSE_CHANCE
        ):
            f = rng.randint(*R.START_FLOORS)
            tiles.append(new_tile("house", rng, f, f, f * R.PEOPLE_PER_FLOOR // 2))
        else:
            tiles.append(new_tile("lot", rng))
    return {
        "schema": R.SCHEMA,
        "tick": 0,
        "seed": seed,
        "size": R.SIZE,
        "tiles": tiles,
        "power": apply_power(tiles),
        "events": [],
        "mark_ids": [],
    }


def is_count(v):
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def validate(state):
    """Return a list of contract violations; empty means the snapshot is valid."""
    errors = []
    if not isinstance(state, dict):
        return ["state is not an object"]
    if state.get("schema") != R.SCHEMA:
        errors.append(f"schema must be {R.SCHEMA}")
    if state.get("size") != R.SIZE:
        errors.append(f"size must be {R.SIZE}")
    for key in ("tick", "seed"):
        if not is_count(state.get(key)):
            errors.append(f"{key} must be a non-negative integer")

    tiles = state.get("tiles")
    if not isinstance(tiles, list) or len(tiles) != R.SIZE * R.SIZE:
        errors.append(f"tiles must be a list of {R.SIZE * R.SIZE}")
        tiles = []
    for i, t in enumerate(tiles):
        where = f"tile {xy(i)}"
        if not isinstance(t, dict) or set(t) != TILE_KEYS:
            errors.append(f"{where}: keys must be {sorted(TILE_KEYS)}")
            continue
        if t["k"] not in R.KINDS:
            errors.append(f"{where}: unknown kind {t['k']!r}")
        if not all(is_count(t[key]) for key in ("f", "t", "p", "s")):
            errors.append(f"{where}: f, t, p, s must be non-negative integers")
            continue
        if not isinstance(t["on"], bool):
            errors.append(f"{where}: on must be a boolean")
        if t["s"] >= R.STYLE_SEED_MAX:
            errors.append(f"{where}: style seed out of range")
        if t["f"] > t["t"]:
            errors.append(f"{where}: floors exceed target")
        if t["k"] == "house" and t["f"] < 1:
            errors.append(f"{where}: house without floors")
        if t["k"] != "house" and t["p"]:
            errors.append(f"{where}: only houses have residents")

    power = state.get("power")
    if not isinstance(power, dict) or not all(is_count(power.get(k)) for k in POWER_KEYS):
        errors.append(f"power must have non-negative integers {POWER_KEYS}")
    elif power["supplied"] > min(power["capacity"], power["demand"]):
        errors.append("power supplied exceeds capacity or demand")

    events = state.get("events")
    if not isinstance(events, list):
        errors.append("events must be a list")
        events = []
    for e in events:
        if (
            not isinstance(e, dict)
            or e.get("kind") not in R.EVENT_KINDS
            or not (is_count(e.get("x")) and e["x"] < R.SIZE)
            or not (is_count(e.get("y")) and e["y"] < R.SIZE)
            or e.get("sector") != sector(e["x"], e["y"])
        ):
            errors.append(f"bad event {e!r}")

    ids = state.get("mark_ids")
    if (
        not isinstance(ids, list)
        or len(ids) > R.MARK_IDS_KEEP
        or not all(isinstance(m, str) for m in ids)
    ):
        errors.append(f"mark_ids must be a list of at most {R.MARK_IDS_KEEP} strings")
    return errors
