"""Central configuration: paths, Elo parameters, tournament weights, confederations.

Tournament-importance K-weights follow the World Football Elo Ratings convention
(K ranges ~20-60 by match importance), which is the established standard for
international football and matches the granularity of the martj42 `tournament` field.
"""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
MODEL_DIR = Path(__file__).resolve().parents[2]          # .../model
DATA_DIR = MODEL_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
OUTPUT_DIR = DATA_DIR / "output"
WEB_DATA_DIR = MODEL_DIR.parent / "web" / "public" / "data"   # web reads this

RESULTS_CSV = RAW_DIR / "results.csv"
RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
SHOOTOUTS_CSV = RAW_DIR / "shootouts.csv"
SHOOTOUTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/shootouts.csv"

# Last group matchday of the 2026 World Cup; knockout play starts the day after.
# Same-group pairings after this date are knockout rematches (possible from the QF on).
GROUP_STAGE_END = "2026-06-27"

# ---------------------------------------------------------------------------
# Elo parameters (World Football Elo style)
# ---------------------------------------------------------------------------
DEFAULT_RATING = 1500.0
RATING_SCALE = 400.0          # logistic divisor
HOME_ADVANTAGE = 100.0        # rating points added to the home (non-neutral) side
GOAL_DIFF_LOG_FACTOR = 0.7    # margin-of-victory ("paddlin'") dampening
MAX_GOAL_DIFF_MULTIPLIER = 2.5

# K-factor weight by match-importance tier (the "G"/importance index)
K_WEIGHTS = {
    "world_cup_final": 60.0,
    "world_cup": 60.0,           # World Cup finals matches
    "continental_final": 50.0,   # Euro / Copa / AFCON / Asian Cup / Gold Cup finals stage
    "confederations": 50.0,
    "nations_league": 40.0,
    "world_cup_qual": 40.0,
    "continental_qual": 30.0,
    "minor_tournament": 30.0,
    "friendly": 20.0,
}

# Map raw `tournament` strings -> importance tier. Matching is substring / keyword based.
# Order matters: more specific keys are checked first in classify_tournament().
TOURNAMENT_TIERS = {
    "fifa world cup qualification": "world_cup_qual",
    "fifa world cup": "world_cup",
    "confederations cup": "confederations",
    "uefa nations league": "nations_league",
    "concacaf nations league": "nations_league",
    "uefa euro qualification": "continental_qual",
    "african cup of nations qualification": "continental_qual",
    "afc asian cup qualification": "continental_qual",
    "copa américa qualification": "continental_qual",
    "gold cup qualification": "continental_qual",
    "uefa euro": "continental_final",
    "african cup of nations": "continental_final",
    "afc asian cup": "continental_final",
    "copa américa": "continental_final",
    "gold cup": "continental_final",
    "friendly": "friendly",
}

# ---------------------------------------------------------------------------
# Confederations — derived primarily from tournament participation (see
# data/confederations.py), with these keyword anchors per confederation.
# ---------------------------------------------------------------------------
CONFEDERATION_TOURNAMENT_KEYWORDS = {
    "UEFA": ["uefa euro", "uefa nations league"],
    "CONMEBOL": ["copa américa", "copa america"],
    "CONCACAF": ["gold cup", "concacaf nations league", "concacaf championship"],
    "CAF": ["african cup of nations", "african nations"],
    "AFC": ["afc asian cup", "aff championship", "saff", "gulf cup"],
    "OFC": ["ofc nations cup", "oceania nations"],
}

CONFEDERATIONS = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"]

# ---------------------------------------------------------------------------
# Goal model
# ---------------------------------------------------------------------------
# Average total goals in a men's international (used as the baseline of the
# Elo -> goal-supremacy mapping; the supremacy slope is calibrated from data).
BASELINE_TOTAL_GOALS = 2.6
DIXON_COLES_RHO = -0.05       # low-score dependence parameter (tuned later)
MAX_GOALS_GRID = 10          # scoreline matrix is (MAX+1) x (MAX+1)

# ---------------------------------------------------------------------------
# Squad-value blend (Transfermarkt)
# ---------------------------------------------------------------------------
# How much to pull a team toward its market-value-implied strength. PADDLIN leans
# on market value MORE in cross-confederation matchups (sparse head-to-head history)
# and on results MORE within a confederation (dense, reliable history).
VALUE_WEIGHT_SAME = 0.15
VALUE_WEIGHT_CROSS = 0.45
VALUE_GAP_CLIP = 0.7        # clip the log-strength residual to avoid extreme swings

# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------
DEFAULT_N_SIMS = 50_000

# ---------------------------------------------------------------------------
# Kalshi comparison + betting backtest (compare.py / data/kalshi.py)
# ---------------------------------------------------------------------------
# Public market data, no auth needed for reads.
KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
KALSHI_SERIES = "KXWCGAME"        # World Cup per-match 3-way moneyline (home/away/TIE)
# A match market closes ~at the final whistle; its price sits on a flat plateau
# all day until kickoff, so the price ~this many minutes before close_time is a
# clean PRE-MATCH quote (and safely avoids leaking any in-game movement).
KALSHI_PREMATCH_BUFFER_MIN = 150
# Betting strategy
EDGE_MIN = 0.02                   # min GAFFER edge over Kalshi ask to place a bet
FLAT_STAKE = 100.0                # $ deployed per qualifying bet (flat strategy)
KELLY_START = 1000.0              # starting bankroll for the Kelly strategy
KELLY_FRACTION = 0.5             # fractional (half-) Kelly, for realism
