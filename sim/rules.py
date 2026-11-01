"""Constants for sim v1. Tuning these changes behavior, not the snapshot schema."""

SCHEMA = 1
SIZE = 48
BLOCK = 8  # sectors are BLOCK x BLOCK tiles; streets run between them and are renderer-only

KINDS = ("lot", "build", "house", "market", "plant")
EVENT_KINDS = (
    "commissioned",
    "topped_out",
    "collapse",
    "market_opened",
    "market_closed",
    "blackout",
    "power_restored",
)
MARK_KINDS = ("commission",)
MARK_ID_MAX_LEN = 64
# shortcut: forgets mark IDs older than this, fine at one mark per visitor per day
MARK_IDS_KEEP = 5000

STYLE_SEED_MAX = 2**31

# Starting city
START_PLANTS = 4
START_MARKETS = 8
START_HOUSE_CHANCE = 0.3
START_FLOORS = (3, 8)

# Buildings
FLOORS = (3, 20)  # construction target range, inclusive
PEOPLE_PER_FLOOR = 10
TALL = 12  # only towers at least this tall make a topped_out event

# Power
PLANT_RADIUS = 10  # Chebyshev distance
PLANT_CAPACITY = 4000
BUILD_LOAD = 5
MARKET_LOAD = 20

# Per-tick behavior
MARKET_RADIUS = 4  # Chebyshev distance
BUILD_CHANCE = 0.02  # powered lot near a market starts construction
GROWTH = 3  # max new residents per tick for a powered house near a market
DECAY = 2  # residents lost per tick without power
OVERCROWD_DECAY_CHANCE = 0.1  # overcrowded house loses a floor
EMPTY_DECAY_CHANCE = 0.02  # empty house loses a floor
MARKET_OPEN_CHANCE = 0.01  # lot with enough houses nearby and no market opens one
MARKET_OPEN_HOUSES = 12
MARKET_CLOSE_CHANCE = 0.1  # market with no houses nearby closes
