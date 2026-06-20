"""International Elo engine (World Football Elo style).

Ported and adapted from the club-level engine in ../Team_Strength:
  - expected score:  E_a = 1 / (1 + 10^((R_b - R_a)/400))
  - rating update:   ΔR  = K · G · (W - E)
  - K  = importance weight (20-60) by tournament tier
  - G  = margin-of-victory multiplier (the "paddlin'" weighting), log-dampened
  - home advantage added to the home side unless the match is at a neutral venue
"""

from __future__ import annotations

import math

from ..config import (
    GOAL_DIFF_LOG_FACTOR,
    HOME_ADVANTAGE,
    K_WEIGHTS,
    MAX_GOAL_DIFF_MULTIPLIER,
    RATING_SCALE,
)


def expected_score(rating_a: float, rating_b: float) -> float:
    """Probability-like expected score of A vs B (0..1)."""
    return 1.0 / (1.0 + math.pow(10, (rating_b - rating_a) / RATING_SCALE))


def mov_multiplier(goal_difference: int) -> float:
    """Margin-of-victory multiplier: ln(gd+1)*factor + 1, capped.

    This is PADDLIN's "paddlin'" idea — convincing wins move ratings more, with
    logarithmic dampening so blowouts don't cause runaway swings.
    """
    gd = abs(int(goal_difference))
    if gd <= 1:
        return 1.0
    return min(math.log(gd + 1) * GOAL_DIFF_LOG_FACTOR + 1.0, MAX_GOAL_DIFF_MULTIPLIER)


def k_factor(tier: str) -> float:
    """Importance weight for the match's tournament tier."""
    return K_WEIGHTS.get(tier, K_WEIGHTS["minor_tournament"])


def update_ratings(
    home_rating: float,
    away_rating: float,
    home_score: int,
    away_score: int,
    tier: str = "friendly",
    neutral: bool = False,
) -> tuple[float, float]:
    """Return (new_home_rating, new_away_rating) after one match."""
    adv = 0.0 if neutral else HOME_ADVANTAGE
    home_exp = expected_score(home_rating + adv, away_rating)
    away_exp = 1.0 - home_exp

    if home_score > away_score:
        home_actual, away_actual = 1.0, 0.0
    elif away_score > home_score:
        home_actual, away_actual = 0.0, 1.0
    else:
        home_actual, away_actual = 0.5, 0.5

    k = k_factor(tier) * mov_multiplier(home_score - away_score)
    new_home = home_rating + k * (home_actual - home_exp)
    new_away = away_rating + k * (away_actual - away_exp)
    return new_home, new_away


def win_draw_loss(rating_a: float, rating_b: float, neutral: bool = True) -> tuple[float, float, float]:
    """Quick W/D/L estimate from Elo (used for sanity checks only; the real
    match probabilities come from the Dixon-Coles goal model)."""
    adv = 0.0 if neutral else HOME_ADVANTAGE
    e = expected_score(rating_a + adv, rating_b)
    diff = (rating_a + adv) - rating_b
    draw = 0.28 * math.exp(-abs(diff) / 400.0)
    win = (1.0 - draw) * e
    loss = (1.0 - draw) * (1.0 - e)
    return win, draw, loss
