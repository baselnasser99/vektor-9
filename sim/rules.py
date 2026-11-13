"""Constants for the simulation. Tuning these changes behavior, not the snapshot schema."""

# The snapshot format (ADR-0003). Bump when keys, kinds or their meaning change.
SCHEMA = 6
# The simulation rules (ADR-0013). Bump when new_city() or step() can give a different result for
# any input: a constant here, a rule, the order or kind of random draws (all through sim/rng.py).
# The golden-output test (tests/test_golden.py) fails until this is bumped and recorded.
# 2: every draw is built on random() alone, so the rules no longer depend on how a Python version
#    implements randint, randrange, choice or sample.
# 3: the static plan (ADR-0015): the headquarters' site and court reserved as site terrain, parks
#    laid after them, and works that always find ground.
# 4: growth weighted by frontage on the plan's backbone and by distance from the centre, under a
#    height envelope that falls toward the edge (ADR-0015). The same draws; only thresholds and
#    ranges change.
SIM_VERSION = 4
SIZE = 48
BLOCK = 8  # sectors are BLOCK x BLOCK tiles; streets run between them and are renderer-only
TICKS_PER_DAY = 288  # one tick every 5 minutes

# Laid out by new_city; never built on, never changed. "site": land the plan reserves (ADR-0015).
TERRAIN = ("rail", "park", "works", "road", "site")
KINDS = ("lot", "build", "house", "market", "plant", *TERRAIN)
EVENT_KINDS = (
    "commissioned",
    "topped_out",
    "collapse",
    "market_opened",
    "market_closed",
    "plant_opened",
    "blackout",
    "power_restored",
)
MARK_KINDS = ("commission",)
MARK_ID_MAX_LEN = 64
# shortcut: forgets mark IDs older than this, fine at one mark per visitor per day
MARK_IDS_KEEP = 5000

STYLE_SEED_MAX = 2**31

# Starting city: a small core around the center
START_RADIUS = 4  # Chebyshev distance from the center
START_MARKETS = 2
START_HOUSE_CHANCE = 0.4
START_FLOORS = (2, 4)

# Terrain the city grows around: a railway in from one edge to a terminus in the outer ring, a
# few parks, an old industrial site.
# Placement is integer math only, so every machine lays out the same map.
RAIL_LENGTH = BLOCK  # tiles in from the edge: the outer sectors only, never the center
RAIL_OFFSET = (8, 12)  # the line passes this many tiles from the center
HUB_PLAZA = 2  # tiles each side of the central crossing kept as the tower's plaza (park terrain)
# Land for the highway interchange (road terrain): the four blocks round the crossing of the
# central street along x with the outermost cross street on the +x side, where the renderer brings
# the highway in. Tiles a side of each block, a block of the renderer's street grid.
INTERCHANGE_BLOCK = 4
PARKS = 2
PARK_RADIUS = (2, 3)  # half-axes of each park's two overlapping ellipses
PARK_DISTANCE = (9, 17)  # Chebyshev distance of a park's center from the city center
PARK_SPACING = 8
WORKS_SIZE = (5, 4)
WORKS_DISTANCE = (13, 19)  # the industrial site sits beside the railway this far out
WORKS_TRIES = 50  # placements tried until one lands on free ground

# The static plan (ADR-0015): the backbone corridors the renderer already lays out (cityLayout owns
# their widths), and land reserved from tick 0 for the headquarters and its court across the avenue.
ROLES = ("arterial", "boulevard")
SITE_USES = ("hq", "court")
FACES = ("+x", "-x", "+y", "-y")
HQ_DEPTH = 4  # tiles: the whole block east of the avenue
COURT_DEPTH = 2  # tiles, across the avenue from it

# Buildings
FLOORS_MIN = 2
FLOORS_MAX = 60
HEIGHT_STEP = 8  # new buildings reach up to this many floors above their neighbors' average
HEIGHT_RADIUS = 2
PEOPLE_PER_FLOOR = 10
TALL = 20  # only towers at least this tall make a topped_out event

# Growth weighting (ADR-0015). F, a tile's frontage: 1 facing the boulevard, ARTERIAL_SHARE facing
# only an arterial, else MINOR_SHARE (the ring road, the 14 m lines and interior tiles). C, its
# centrality: max(0, 1 - ring / CENTRE_REACH). Weighted floor terms are rounded down.
# Neutral (version 3's growth): FRONT_BUILD, CENTRE_BUILD, FRONT_FLOORS, CENTRE_FLOORS and
# CENTRE_LOW 0, EDGE_FLOORS = FLOORS_MAX.
ARTERIAL_SHARE = 0.8
MINOR_SHARE = 0
CENTRE_REACH = 24  # rings
FRONT_BUILD = 24  # build chance x (1 + FRONT_BUILD F + CENTRE_BUILD C)
CENTRE_BUILD = 1
FRONT_FLOORS = 24  # extra floors on the cap and the envelope
CENTRE_FLOORS = 48  # extra floors on the cap
EDGE_FLOORS = 16  # the envelope: EDGE_FLOORS + (FLOORS_MAX - EDGE_FLOORS) C + FRONT_FLOORS F
CENTRE_LOW = 56  # lowest target: FLOORS_MIN + CENTRE_LOW C, never above the cap

# Landmark clearance (ADR-0015, round 4): the renderer's landmarks in floors (its floor is 3.5 m;
# tests/js/landmarks.test.mjs checks these against the models), and the envelope near each, so
# they stand above their neighbours from the air. A zone is the tiles 1 to RADIUS tiles
# (Chebyshev) outside the tower's plaza, or outside the headquarters' site and its court together;
# there the envelope is at most int(SHARE x the landmark's floors). Neutral: RADIUS 0.
TOWER_FLOORS = 75  # the telecom tower's top, 262.8 m
HQ_FLOORS = 45  # the headquarters' roof, 156.25 m
TOWER_CLEAR_RADIUS = 3
TOWER_CLEAR_SHARE = 0.5
HQ_CLEAR_RADIUS = 2
HQ_CLEAR_SHARE = 0.6

# Power
PLANT_RADIUS = 8  # Chebyshev distance
PLANT_CAPACITY = 6000  # a plant at capacity keeps the lights on but its area stops growing
BUILD_LOAD = 5
MARKET_LOAD = 20
PLANT_STRAIN = 0.8  # share of capacity at which the city starts building another plant
PLANT_BUILD_CHANCE = 0.006  # per tick while any plant is strained
PLANT_SPACING = 7  # new plants keep at least this distance from existing ones
PLANT_REACH = PLANT_RADIUS + 3  # how far from the strained plant a new one may go

# Blackouts: scheduled, and they hit the most loaded plant
BLACKOUTS_PER_DAY = 3
BLACKOUT_TICKS = 6  # 30 minutes
BLACKOUT_GAP = 24  # at least 2 hours between blackouts, including across midnight

# District waves: each sector slowly cycles through boom and decline
WAVE_PERIOD = TICKS_PER_DAY * 8
WAVE_JITTER = TICKS_PER_DAY * 2
BOOM = 33  # wave level above which a sector booms
DECLINE = -33  # wave level below which a sector declines
DECLINE_MIN_BUILT = 75  # percent of a sector built before decline can set in
BOOM_BUILD_BONUS = 2  # construction chance multiplier while booming
DECLINE_LOSS = 1  # residents lost per tick in a declining sector

# Per-tick behavior
MARKET_RADIUS = 4  # Chebyshev distance
BUILD_CHANCE = 0.004  # powered lot near a market starts construction
GROWTH = 3  # max new residents per tick for a powered house near a market
DECAY = 2  # residents lost per tick without power
OVERCROWD_DECAY_CHANCE = 0.1  # overcrowded house loses a floor
EMPTY_DECAY_CHANCE = 0.02  # empty house with no market nearby, or in decline, loses a floor
MARKET_OPEN_CHANCE = 0.003  # lot with enough houses nearby and no market opens one
MARKET_OPEN_HOUSES = 12
MARKET_CLOSE_CHANCE = 0.1  # market with no houses nearby closes
REDEVELOP_BUILT = 60  # percent of a sector built before old towers get replaced
REDEVELOP_CHANCE = 0.003  # per tick, a house in a busy sector is torn down for a taller one
