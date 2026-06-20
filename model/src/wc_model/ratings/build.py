"""Build current team ratings by processing the full match history chronologically.

Outputs, per team:
  - elo            : current results-based Elo
  - attack/defense : expected goals for/against an average team on neutral ground
  - matches_played, last_match_date, confederation

Also calibrates the Elo -> goal-supremacy slope (`beta`) from recent results, which
the goal model uses to turn a rating gap into expected goals.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional

import pandas as pd

from ..config import BASELINE_TOTAL_GOALS, DEFAULT_RATING, HOME_ADVANTAGE
from ..data.confederations import derive_confederations
from ..data.results import load_results
from .elo import expected_score, k_factor, mov_multiplier


@dataclass
class TeamRating:
    name: str
    elo: float = DEFAULT_RATING
    peak_elo: float = DEFAULT_RATING
    matches_played: int = 0
    last_match_date: Optional[str] = None
    confederation: str = "UNK"
    # filled in after calibration
    attack: float = 0.0
    defense: float = 0.0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "elo": round(self.elo, 1),
            "peak_elo": round(self.peak_elo, 1),
            "attack": round(self.attack, 3),
            "defense": round(self.defense, 3),
            "tilt": round(self.attack - self.defense, 3),
            "matches_played": self.matches_played,
            "last_match_date": self.last_match_date,
            "confederation": self.confederation,
        }


@dataclass
class RatingModel:
    ratings: Dict[str, TeamRating]
    beta: float                 # goals of supremacy per Elo point
    total_goals: float          # baseline total goals per match
    n_matches: int
    last_update: str = ""
    history: pd.DataFrame = field(default=None, repr=False)

    def elo(self, team: str) -> float:
        return self.ratings[team].elo if team in self.ratings else DEFAULT_RATING


def build_ratings(
    df: Optional[pd.DataFrame] = None,
    calibrate_since: str = "2015-01-01",
) -> RatingModel:
    """Process every played match in date order to produce current ratings."""
    if df is None:
        df = load_results()
    confeds = derive_confederations(df)

    ratings: Dict[str, TeamRating] = {}

    def get(team: str) -> TeamRating:
        if team not in ratings:
            ratings[team] = TeamRating(name=team, confederation=confeds.get(team, "UNK"))
        return ratings[team]

    # Calibration accumulators (through-origin fit of goal_diff on rating_diff).
    cal_xx = 0.0
    cal_xy = 0.0
    cal_total = 0.0
    cal_n = 0
    cal_cutoff = pd.Timestamp(calibrate_since)

    played = df[df["played"]]
    n_matches = 0
    for row in played.itertuples(index=False):
        home, away = get(row.home_team), get(row.away_team)
        adv = 0.0 if row.neutral else HOME_ADVANTAGE
        rating_diff = (home.elo + adv) - away.elo

        # collect calibration sample from the modern era
        if row.date >= cal_cutoff:
            gd = row.home_score - row.away_score
            cal_xx += rating_diff * rating_diff
            cal_xy += rating_diff * gd
            cal_total += row.home_score + row.away_score
            cal_n += 1

        # Elo update
        home_exp = expected_score(home.elo + adv, away.elo)
        away_exp = 1.0 - home_exp
        if row.home_score > row.away_score:
            ha, aa = 1.0, 0.0
        elif row.away_score > row.home_score:
            ha, aa = 0.0, 1.0
        else:
            ha, aa = 0.5, 0.5
        k = k_factor(row.tier) * mov_multiplier(row.home_score - row.away_score)
        home.elo += k * (ha - home_exp)
        away.elo += k * (aa - away_exp)

        for t, new in ((home, home.elo), (away, away.elo)):
            t.peak_elo = max(t.peak_elo, new)
            t.matches_played += 1
            t.last_match_date = row.date.strftime("%Y-%m-%d")
        n_matches += 1

    beta = (cal_xy / cal_xx) if cal_xx > 0 else 0.0025
    total_goals = (cal_total / cal_n) if cal_n else BASELINE_TOTAL_GOALS

    # Derive attack/defense vs an average (1500) opponent on neutral ground.
    half = total_goals / 2.0
    for t in ratings.values():
        sup = beta * (t.elo - DEFAULT_RATING)
        t.attack = max(0.2, half + sup / 2.0)
        t.defense = max(0.2, half - sup / 2.0)

    last_update = played["date"].max().strftime("%Y-%m-%d") if len(played) else ""
    return RatingModel(
        ratings=ratings,
        beta=beta,
        total_goals=total_goals,
        n_matches=n_matches,
        last_update=last_update,
    )
