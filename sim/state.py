"""City state: creation, power, and validation. The state dict is the snapshot (ADR-0003)."""

import random

from sim import rules as R
from sim.rng import choice, randint, randrange, sample

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
            "s": randrange(rng, R.STYLE_SEED_MAX), "b": tick}  # fmt: skip


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


def hub_plaza():
    """Tile indices of the plaza round the central crossing, where the renderer stands the city's
    tower: HUB_PLAZA tiles each way from the crossing, which runs between tiles c - 1 and c."""
    c, h = R.SIZE // 2, R.HUB_PLAZA
    return [y * R.SIZE + x for y in range(c - h, c + h) for x in range(c - h, c + h)]


def interchange():
    """Tile indices of the land kept for the highway interchange: the four blocks round the
    crossing of the central street along x (between rows c - 1 and c) with the outermost cross
    street on the +x side (between columns e - 1 and e), where the renderer brings the highway in
    on a viaduct and loops its ramps down to the streets. Clear of the core, the plaza and every
    railway the seed can lay (its rows sit 8 to 12 tiles off the center)."""
    c, e, b = R.SIZE // 2, R.SIZE - R.BLOCK, R.INTERCHANGE_BLOCK
    return [y * R.SIZE + x for y in range(c - b, c + b) for x in range(e - b, e + b)]


def plan_for(seed):
    """The static plan (ADR-0015), fixed for the life of the city: the backbone corridors (the
    boulevard and the main streets, which cityLayout draws 36 m and 21 m wide on every seed; `at` is
    the tile boundary each runs on) and the reserved sites, as inclusive tile rectangles. The
    headquarters fills the block east of the boulevard's avenue stretch, north or south of the
    centre, straddling that sector's mid street and facing the avenue; its court is across it."""
    rng = random.Random(f"{seed}:plan")
    c, b = R.SIZE // 2, R.BLOCK
    by = choice(rng, (c // b - 2, c // b + 1))  # the avenue's sectors: the second out each way
    y0, y1 = by * b + 1, by * b + b - 2
    backbone = [
        {"along": along, "at": at, "role": "boulevard" if at == c else "arterial"}
        for along in ("x", "y")
        for at in (c - 2 * b, c, c + 2 * b)
    ]
    hq = {"use": "hq", "x0": c, "y0": y0, "x1": c + R.HQ_DEPTH - 1, "y1": y1, "face": "-x"}
    court = {"use": "court", "x0": c - R.COURT_DEPTH, "y0": y0, "x1": c - 1, "y1": y1}
    return {"backbone": backbone, "sites": [hq, court]}


def site_tiles(plan):
    """Tile indices inside the plan's site rectangles, in row order."""
    return sorted(
        y * R.SIZE + x
        for s in plan["sites"]
        for y in range(s["y0"], s["y1"] + 1)
        for x in range(s["x0"], s["x1"] + 1)
    )


def lay_terrain(seed, plan):
    """Tile index -> terrain kind: the hub plaza, a railway in from one edge, the interchange's
    land, the plan's reserved sites, a few parks, an old industrial site.

    Everything but the plaza stays clear of the starting core, so the city grows around it.
    Integer math only.
    """
    rng = random.Random(f"{seed}:terrain")
    c = R.SIZE // 2
    clear = [chebyshev(*xy(i), c, c) <= R.START_RADIUS + 1 for i in range(R.SIZE * R.SIZE)]
    terrain = lay_rail(rng, clear)
    terrain.update(dict.fromkeys(hub_plaza(), "park"))
    terrain.update(dict.fromkeys(interchange(), "road"))
    terrain.update(dict.fromkeys(site_tiles(plan), "site"))  # before the parks, which skip them
    rails = [xy(i) for i, k in terrain.items() if k == "rail"]
    lay_parks(rng, clear, terrain, rails)
    lay_works(rng, clear, terrain, rails)
    return terrain


def lay_rail(rng, clear):
    """A straight band two tiles wide, parallel to the streets, from one edge of the map
    RAIL_LENGTH tiles in, as {tile index: "rail"}.

    It runs along the middle of a row of blocks (rows 1 and 2 of each BLOCK // 2, where the renderer
    draws blocks), so the viaduct and its terminus station sit clear of the streets beside them and
    the city's center keeps no railway. The outermost sectors are never in the starting core.
    """
    n, c, half = R.SIZE, R.SIZE // 2, R.BLOCK // 2
    lo, hi = R.RAIL_OFFSET
    rows = [
        r for r in range(n - 1) if r % half == 1 and lo <= min(abs(r - c), abs(r + 1 - c)) <= hi
    ]
    row, along_x, edge = choice(rng, rows), choice(rng, (True, False)), choice(rng, (0, n - 1))
    rail = {}
    for i in range(n * n):
        x, y = xy(i)
        a, b = (x, y) if along_x else (y, x)  # a: along the line, b: across it
        if b in (row, row + 1) and abs(a - edge) < R.RAIL_LENGTH and not clear[i]:
            rail[i] = "rail"
    return rail


def lay_parks(rng, clear, terrain, rails):
    """Parks into terrain: two overlapping ellipses each, away from the core, the rails and each
    other. A park that finds no spot in 500 tries is skipped."""
    n, c = R.SIZE, R.SIZE // 2
    parks = []
    for _ in range(R.PARKS):
        for _attempt in range(500):
            px, py = randrange(rng, n), randrange(rng, n)
            if (
                R.PARK_DISTANCE[0] <= chebyshev(px, py, c, c) <= R.PARK_DISTANCE[1]
                and not near(px, py, rails, 3)
                and not near(px, py, parks, R.PARK_SPACING - 1)
            ):
                break
        else:
            continue
        parks.append((px, py))
        blobs = [(px, py), (px + randint(rng, -2, 2), py + randint(rng, -2, 2))]
        blobs = [
            (bx, by, randint(rng, *R.PARK_RADIUS), randint(rng, *R.PARK_RADIUS)) for bx, by in blobs
        ]
        # Only the blobs' bounding box, in row order like a full scan, so tiles keep their order.
        x0, x1 = (
            max(0, min(bx - a for bx, _, a, _ in blobs)),
            min(n - 1, max(bx + a for bx, _, a, _ in blobs)),
        )
        y0, y1 = (
            max(0, min(by - b for _, by, _, b in blobs)),
            min(n - 1, max(by + b for _, by, _, b in blobs)),
        )
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                i = y * n + x
                inside = any(
                    ((x - bx) * b) ** 2 + ((y - by) * a) ** 2 <= (a * b) ** 2
                    for bx, by, a, b in blobs
                )
                if inside and i not in terrain and not clear[i]:
                    terrain[i] = "park"


def lay_works(rng, clear, terrain, rails):
    """The old industrial site into terrain: a rectangle with one corner missing, set against the
    railway, if any rail tile is at the right distance from the center. A placement that lands only
    on other terrain is drawn again, up to WORKS_TRIES times."""
    n, c = R.SIZE, R.SIZE // 2
    sidings = [
        (x, y)
        for x, y in rails
        if R.WORKS_DISTANCE[0] <= chebyshev(x, y, c, c) <= R.WORKS_DISTANCE[1]
    ]
    if not sidings:
        return
    for _ in range(R.WORKS_TRIES):
        rx, ry = choice(rng, sidings)
        (w, h), sx, sy = R.WORKS_SIZE, choice(rng, (1, -1)), choice(rng, (1, -1))
        xs = range(rx + 1, rx + 1 + w) if sx > 0 else range(rx - w, rx)
        ys = range(ry + 1, ry + 1 + h) if sy > 0 else range(ry - h, ry)
        corner = (choice(rng, (xs[0], xs[-1])), choice(rng, (ys[0], ys[-1])))
        works = [
            y * n + x
            for y in ys
            for x in xs
            if 0 <= x < n and 0 <= y < n and (x, y) != corner
            and y * n + x not in terrain and not clear[y * n + x]
        ]  # fmt: skip
        if works:  # seed 443's first placement fell wholly on a park (ADR-0015)
            terrain.update(dict.fromkeys(works, "works"))
            return


def new_city(seed):
    """A small core around the center: one plant just off the hub plaza, a couple of markets, a
    few low houses, and the terrain (hub plaza, railway, interchange, parks, industrial site) the
    city will grow around, and the static plan that reserves land for the headquarters."""
    rng = random.Random(seed)
    plan = plan_for(seed)
    terrain = lay_terrain(seed, plan)
    c = R.SIZE // 2
    plant = (c + R.HUB_PLAZA, c + R.HUB_PLAZA)
    core = [
        i
        for i in range(R.SIZE * R.SIZE)
        if chebyshev(*xy(i), c, c) <= R.START_RADIUS and i not in terrain and xy(i) != plant
    ]
    markets = set(sample(rng, core, R.START_MARKETS))
    market_xy = [xy(i) for i in markets]
    tiles = []
    for i in range(R.SIZE * R.SIZE):
        x, y = xy(i)
        if i in terrain:
            tiles.append(new_tile(terrain[i], rng))
        elif (x, y) == plant:
            tiles.append(new_tile("plant", rng))
        elif i in markets:
            tiles.append(new_tile("market", rng))
        elif (
            chebyshev(x, y, c, c) <= R.START_RADIUS
            and near(x, y, market_xy, R.MARKET_RADIUS)
            and rng.random() < R.START_HOUSE_CHANCE
        ):
            f = randint(rng, *R.START_FLOORS)
            tiles.append(new_tile("house", rng, f, f, f * R.PEOPLE_PER_FLOOR // 2))
        else:
            tiles.append(new_tile("lot", rng))
    return {
        "schema": R.SCHEMA,
        "sim": R.SIM_VERSION,
        "tick": 0,
        "seed": seed,
        "size": R.SIZE,
        "plan": plan,
        "tiles": tiles,
        "power": apply_power(tiles),
        "events": [],
        "mark_ids": [],
    }


def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def is_count(v):
    return is_int(v) and v >= 0


def plan_errors(plan, tiles):
    """What is wrong with a snapshot's plan (ADR-0015): its format, and its sites against the grid.
    Never compared with plan_for(seed): a later version may lay out another plan for a seed."""
    if not (isinstance(plan, dict) and set(plan) == {"backbone", "sites"}
            and all(isinstance(v, list) for v in plan.values())):  # fmt: skip
        return ["plan must be an object with lists backbone and sites"]
    errors = [
        f"plan: bad corridor {b!r}"
        for b in plan["backbone"]
        if not (
            isinstance(b, dict)
            and set(b) == {"along", "at", "role"}
            and b["along"] in ("x", "y")
            and is_count(b["at"])
            and b["at"] <= R.SIZE
            and b["role"] in R.ROLES
        )
    ]
    c, reserved = R.SIZE // 2, set()
    for site in plan["sites"]:
        keys = {"use", "x0", "y0", "x1", "y1"}
        if isinstance(site, dict) and site.get("use") == "hq":
            keys.add("face")
        if not (isinstance(site, dict) and set(site) == keys and site["use"] in R.SITE_USES
                and site.get("face", "-x") in R.FACES
                and all(is_int(site[k]) for k in ("x0", "y0", "x1", "y1"))):  # fmt: skip
            errors.append(f"plan: bad site {site!r}")
            continue
        x0, y0, x1, y1 = site["x0"], site["y0"], site["x1"], site["y1"]
        if not (0 <= x0 <= x1 < R.SIZE and 0 <= y0 <= y1 < R.SIZE):
            errors.append(f"plan: site {site['use']} out of bounds")
            continue
        if chebyshev(max(x0, min(c, x1)), max(y0, min(c, y1)), c, c) <= R.START_RADIUS + 1:
            errors.append(f"plan: site {site['use']} overlaps the core")
        reserved.update(y * R.SIZE + x for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))
    kinds = [t.get("k") if isinstance(t, dict) else None for t in tiles]
    if len(kinds) != R.SIZE * R.SIZE:
        return errors  # the tiles are already reported
    for i in sorted(reserved):
        if kinds[i] in ("road", "rail", "works"):
            errors.append(f"plan: a site overlaps {kinds[i]} at {xy(i)}")
        elif kinds[i] != "site":
            errors.append(f"plan: site tile {xy(i)} is {kinds[i]!r}, not site")
    errors += [
        f"tile {xy(i)}: site outside the plan's sites"
        for i, k in enumerate(kinds)
        if k == "site" and i not in reserved
    ]
    return errors


def validate(state):
    """Return a list of contract violations; empty means the snapshot is valid."""
    errors = []
    if not isinstance(state, dict):
        return ["state is not an object"]
    if state.get("schema") != R.SCHEMA:
        errors.append(f"schema must be {R.SCHEMA}")
    # Within this schema any version is valid; resume_error decides whether this code advances it.
    if not (is_count(state.get("sim")) and state["sim"] >= 1):
        errors.append("sim must be a simulation version (a positive integer)")
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
        if t["k"] in R.TERRAIN and t["t"]:
            errors.append(f"{where}: terrain has no floors")

    errors += plan_errors(state.get("plan"), tiles)

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
