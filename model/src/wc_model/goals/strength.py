"""Time-weighted multiplicative Poisson attack/defense ratings.

Model (the standard Dixon-Coles mean structure):
    λ_home = home_adv · atk[home] · def[away]
    λ_away =            atk[away] · def[home]

where `atk[t]` is an attacking multiplier (mean 1 across teams) and `def[t]` is a
goals-conceded factor (≈ goals an average attack scores against t; lower = better
defense). Parameters are fit by weighted iterative proportional fitting (the MLE for
this multiplicative Poisson), with exponential time-decay so recent form dominates.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import numpy as np
import pandas as pd

from ..data.results import load_results


@dataclass
class GoalStrength:
    atk: Dict[str, float]
    dfn: Dict[str, float]
    home_adv: float
    avg_goals: float            # global average goals per team per match
    teams: list

    def expected_goals(self, home: str, away: str, neutral: bool = True) -> tuple[float, float]:
        """Expected goals (λ_home, λ_away) for a fixture."""
        a_h = self.atk.get(home, 1.0)
        a_a = self.atk.get(away, 1.0)
        d_h = self.dfn.get(home, self.avg_goals)
        d_a = self.dfn.get(away, self.avg_goals)
        adv = self.home_adv if not neutral else 1.0
        return adv * a_h * d_a, a_a * d_h

    def strength_vs_field(self, team: str, field: list) -> tuple[float, float]:
        """Attack/defense expressed vs an average opponent in `field` (neutral)."""
        atk_field = np.mean([self.atk.get(t, 1.0) for t in field])
        dfn_field = np.mean([self.dfn.get(t, self.avg_goals) for t in field])
        attack = self.atk.get(team, 1.0) * dfn_field
        defense = atk_field * self.dfn.get(team, self.avg_goals)
        return float(attack), float(defense)


def fit_goal_strength(
    df: Optional[pd.DataFrame] = None,
    since: str = "2014-01-01",
    halflife_days: float = 900.0,
    n_iter: int = 80,
) -> GoalStrength:
    """Fit attack/defense multipliers from recent results with time-decay."""
    if df is None:
        df = load_results(played_only=True)
    recent = df[(df["played"]) & (df["date"] >= pd.Timestamp(since))].copy()

    asof = recent["date"].max()
    age = (asof - recent["date"]).dt.days.to_numpy(dtype=float)
    w = np.power(0.5, age / halflife_days)

    home = recent["home_team"].to_numpy()
    away = recent["away_team"].to_numpy()
    hg = recent["home_score"].to_numpy(dtype=float)
    ag = recent["away_score"].to_numpy(dtype=float)
    neutral = recent["neutral"].to_numpy()

    teams = sorted(set(home) | set(away))
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    hi = np.array([idx[t] for t in home])
    ai = np.array([idx[t] for t in away])

    avg_goals = float(np.average(np.concatenate([hg, ag]), weights=np.concatenate([w, w])))

    atk = np.ones(n)
    dfn = np.full(n, avg_goals)
    home_adv = 1.30

    # Weighted sums of goals for/against per team (numerators are fixed).
    gf = np.bincount(hi, weights=w * hg, minlength=n) + np.bincount(ai, weights=w * ag, minlength=n)
    ga = np.bincount(hi, weights=w * ag, minlength=n) + np.bincount(ai, weights=w * hg, minlength=n)
    wsum = np.bincount(hi, weights=w, minlength=n) + np.bincount(ai, weights=w, minlength=n)

    home_factor = np.where(neutral, 1.0, home_adv)
    for _ in range(n_iter):
        # Update attack: goals_for / Σ (def[opp] * venue_factor_on_my_side)
        denom_atk = (
            np.bincount(hi, weights=w * dfn[ai] * np.where(neutral, 1.0, home_adv), minlength=n)
            + np.bincount(ai, weights=w * dfn[hi], minlength=n)
        )
        atk = np.where(denom_atk > 0, gf / denom_atk, atk)
        atk *= n / atk.sum()                       # normalize mean attack to 1

        # Update defense: goals_against / Σ (atk[opp] * venue_factor_on_opp_side)
        denom_dfn = (
            np.bincount(hi, weights=w * atk[ai], minlength=n)                                  # home concedes: away atk, neutral on away
            + np.bincount(ai, weights=w * atk[hi] * np.where(neutral, 1.0, home_adv), minlength=n)  # away concedes: home atk * home_adv
        )
        dfn = np.where(denom_dfn > 0, ga / denom_dfn, dfn)

        # Update global home advantage from non-neutral matches.
        nn = ~neutral
        if nn.any():
            num = float(np.sum(w[nn] * hg[nn]))
            den = float(np.sum(w[nn] * atk[hi[nn]] * dfn[ai[nn]]))
            home_adv = max(1.0, num / den) if den > 0 else home_adv

    return GoalStrength(
        atk={t: float(atk[idx[t]]) for t in teams},
        dfn={t: float(dfn[idx[t]]) for t in teams},
        home_adv=float(home_adv),
        avg_goals=avg_goals,
        teams=teams,
    )
