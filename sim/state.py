"""City state: creation, power, and validation. The state dict is the snapshot (ADR-0003)."""

import math
import random

from sim import rules as R

TILE_KEYS = {"k", "f", "t", "p", "on", "s", "b"}
POWER_KEYS = ("capacity", "demand", "supplied")


def xy(i):
    return i % R.SIZE, i // R.SIZE


def sector(x, y):
    return 1 + (y // R.BLOCK) * (R.SIZE // R.BLOCK) + x // R.BLOCK


# Sector of every tile index, computed once: the tick asks for it thousands of times.
SECTORS = [sector(i % R.SIZE, i // R.SIZE) for i in range(R.SIZE * R.SIZE)]
LOADS = {"build": R.BUILD_LOAD, "market": R.MARKET_LOAD}


def chebyshev(x, y, px, py):
    return max(abs(x - px), abs(y - py))


def near(x, y, points, radius):
    return any(chebyshev(x, y, px, py) <= radius for px, py in points)


def counter(tiles, kind):
    """count(x, y, radius): how many `kind` tiles lie within `radius` (Chebyshev) of (x, y).

    A prefix sum over the grid, so each count is four lookups instead of a scan of every such tile.
    """
    n = R.SIZE
    sums = [[0] * (n + 1) for _ in range(n + 1)]
    for y in range(n):
        row = 0
        for x in range(n):
            row += tiles[y * n + x]["k"] == kind
            sums[y + 1][x + 1] = sums[y][x + 1] + row

    def count(x, y, radius):
        x0, y0 = max(0, x - radius), max(0, y - radius)
        x1, y1 = min(n, x + radius + 1), min(n, y + radius + 1)
        return sums[y1][x1] - sums[y0][x1] - sums[y1][x0] + sums[y0][x0]

    return count


def new_tile(kind, rng, floors=0, target=0, people=0, tick=0):
    """A tile that took its current form at `tick` (its "b": the renderer tells old from new)."""
    return {"k": kind, "f": floors, "t": target, "p": people, "on": False,
            "s": rng.randrange(R.STYLE_SEED_MAX), "b": tick}  # fmt: skip


def load(tile):
    return tile["p"] if tile["k"] == "house" else LOADS.get(tile["k"], 0)


def power_grid(tiles):
    """Plant tile indexes, which plant serves each tile (index into plants, or None), plant loads.

    Each tile draws from its nearest plant in range (ties go to the first plant in row order).
    """
    plants = [i for i, t in enumerate(tiles) if t["k"] == "plant"]
    serving = [None] * len(tiles)
    dist = [R.PLANT_RADIUS + 1] * len(tiles)
    # Each plant claims the tiles in its square that it is strictly closer to; plants go in row
    # order, so a tie stays with the earlier plant.
    for j, p in enumerate(plants):
        px, py = xy(p)
        xs = range(max(0, px - R.PLANT_RADIUS), min(R.SIZE, px + R.PLANT_RADIUS + 1))
        for y in range(max(0, py - R.PLANT_RADIUS), min(R.SIZE, py + R.PLANT_RADIUS + 1)):
            dy, row = abs(y - py), y * R.SIZE
            for x in xs:
                dx = abs(x - px)
                d = dx if dx > dy else dy  # chebyshev inlined: the hottest loop in the tick
                if d < dist[row + x]:
                    dist[row + x], serving[row + x] = d, j
    loads = [0] * len(plants)
    for t, j in zip(tiles, serving, strict=True):
        if j is not None:
            loads[j] += load(t)
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


def lay_terrain(seed):
    """Tile index -> terrain kind: a railway in from one edge, a few parks, an old industrial site.

    Everything stays clear of the starting core, so the city grows around it. Integer math only.
    """
    rng = random.Random(f"{seed}:terrain")
    n, c = R.SIZE, R.SIZE // 2
    clear = [chebyshev(*xy(i), c, c) <= R.START_RADIUS + 1 for i in range(n * n)]
    terrain = {}

    # Railway: a straight band from one edge to a terminus beside the core. With direction (dx, dy),
    # v / |(dx, dy)| is a tile's signed distance from the line; 0 <= v < |dx| + |dy| is the thinnest
    # band whose tiles always touch by a side (a "standard" digital line), so the rail has no gaps.
    # a is a tile's position along the line, 0 where it passes closest to the center; the rail keeps
    # one side of that, so it ends there instead of cutting the city in two.
    dx, dy = rng.choice(R.RAIL_SLOPES)
    dx *= rng.choice((1, -1))
    l2 = dx * dx + dy * dy
    lo, hi = R.RAIL_OFFSET
    k = rng.randint(math.isqrt(lo * lo * l2) + 1, math.isqrt(hi * hi * l2)) * rng.choice((1, -1))
    side = rng.choice((1, -1))
    for i in range(n * n):
        x, y = xy(i)
        v = (x - c) * dy - (y - c) * dx - k
        a = side * ((x - c) * dx + (y - c) * dy)
        if 0 <= v < abs(dx) + abs(dy) and a >= 0 and not clear[i]:
            terrain[i] = "rail"

    # Parks: two overlapping ellipses each, away from the core, the railway and each other.
    rails = [xy(i) for i in terrain]
    parks = []
    for _ in range(R.PARKS):
        for _attempt in range(500):
            px, py = rng.randrange(n), rng.randrange(n)
            if (
                R.PARK_DISTANCE[0] <= chebyshev(px, py, c, c) <= R.PARK_DISTANCE[1]
                and not near(px, py, rails, 3)
                and not near(px, py, parks, R.PARK_SPACING - 1)
            ):
                break
        else:
            continue
        parks.append((px, py))
        blobs = [(px, py), (px + rng.randint(-2, 2), py + rng.randint(-2, 2))]
        blobs = [
            (bx, by, rng.randint(*R.PARK_RADIUS), rng.randint(*R.PARK_RADIUS)) for bx, by in blobs
        ]
        for i in range(n * n):
            x, y = xy(i)
            inside = any(
                ((x - bx) * b) ** 2 + ((y - by) * a) ** 2 <= (a * b) ** 2 for bx, by, a, b in blobs
            )
            if inside and i not in terrain and not clear[i]:
                terrain[i] = "park"

    # Old industrial site: a rectangle with one corner missing, set against the railway.
    sidings = [
        (x, y)
        for x, y in rails
        if R.WORKS_DISTANCE[0] <= chebyshev(x, y, c, c) <= R.WORKS_DISTANCE[1]
    ]
    if sidings:
        rx, ry = rng.choice(sidings)
        (w, h), sx, sy = R.WORKS_SIZE, rng.choice((1, -1)), rng.choice((1, -1))
        xs = range(rx + 1, rx + 1 + w) if sx > 0 else range(rx - w, rx)
        ys = range(ry + 1, ry + 1 + h) if sy > 0 else range(ry - h, ry)
        corner = (rng.choice((xs[0], xs[-1])), rng.choice((ys[0], ys[-1])))
        for y in ys:
            for x in xs:
                i = y * n + x
                if (
                    0 <= x < n
                    and 0 <= y < n
                    and (x, y) != corner
                    and i not in terrain
                    and not clear[i]
                ):
                    terrain[i] = "works"
    return terrain


def new_city(seed):
    """A small core around the center: one plant, a couple of markets, a few low houses, and the
    terrain (railway, parks, industrial site) the city will grow around."""
    rng = random.Random(seed)
    terrain = lay_terrain(seed)
    c = R.SIZE // 2
    core = [i for i in range(R.SIZE * R.SIZE) if 0 < chebyshev(*xy(i), c, c) <= R.START_RADIUS]
    markets = set(rng.sample(core, R.START_MARKETS))
    market_xy = [xy(i) for i in markets]
    tiles = []
    for i in range(R.SIZE * R.SIZE):
        x, y = xy(i)
        if i in terrain:
            tiles.append(new_tile(terrain[i], rng))
        elif (x, y) == (c, c):
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
        if not all(is_count(t[key]) for key in ("f", "t", "p", "s", "b")):
            errors.append(f"{where}: f, t, p, s, b must be non-negative integers")
            continue
        if is_count(state.get("tick")) and t["b"] > state["tick"]:
            errors.append(f"{where}: built after the current tick")
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
