"""Squad-value blend: nudge each team toward its Transfermarkt-implied strength.

PADDLIN' credits teams for squad quality beyond what results alone show, and trusts
market value MORE across confederations (where head-to-head history is thin) than
within one. We implement that as a per-matchup, confederation-aware adjustment to the
goal model's attack/defense.

For each team we have a results log-strength s_r = log(atk) - log(dfn) and a
value-implied log-strength s_v (from a regression of s_r on log market value). The
gap d = s_v - s_r is applied with weight w (larger for cross-confederation games):
attack is multiplied by exp(w·d/2) and defense divided by it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, Optional

import numpy as np

from ..config import VALUE_GAP_CLIP, VALUE_WEIGHT_CROSS, VALUE_WEIGHT_SAME
from .strength import GoalStrength


@dataclass
class BlendedModel:
    gs: GoalStrength
    confed: Dict[str, str]
    gap: Dict[str, float]                 # d[t] = s_v - s_r (0 if no market value)
    value: Dict[str, float]               # market value (eur), for display
    w_same: float = VALUE_WEIGHT_SAME
    w_cross: float = VALUE_WEIGHT_CROSS
    reg: tuple = field(default=(0.0, 0.0))  # (slope, intercept) of s_r ~ log(value)

    @property
    def home_adv(self) -> float:
        return self.gs.home_adv

    @property
    def avg_goals(self) -> float:
        return self.gs.avg_goals

    def _weight(self, a: str, b: str) -> float:
        ca, cb = self.confed.get(a, "UNK"), self.confed.get(b, "UNK")
        return self.w_cross if ca != cb else self.w_same

    def _eff(self, t: str, w: float) -> tuple[float, float]:
        """Confederation-weighted effective (attack, defense) for team t."""
        f = math.exp(0.5 * w * self.gap.get(t, 0.0))
        return self.gs.atk.get(t, 1.0) * f, self.gs.dfn.get(t, self.gs.avg_goals) / f

    def lambdas(self, home: str, away: str, adv_team: Optional[str] = None) -> tuple[float, float]:
        w = self._weight(home, away)
        atk_h, dfn_h = self._eff(home, w)
        atk_a, dfn_a = self._eff(away, w)
        lh = (self.home_adv if adv_team == home else 1.0) * atk_h * dfn_a
        la = (self.home_adv if adv_team == away else 1.0) * atk_a * dfn_h
        return lh, la

    def expected_goals(self, home: str, away: str, neutral: bool = True) -> tuple[float, float]:
        return self.lambdas(home, away, adv_team=None if neutral else home)


def build_blend(
    gs: GoalStrength,
    confed: Dict[str, str],
    values: Dict[str, float],
    w_same: float = VALUE_WEIGHT_SAME,
    w_cross: float = VALUE_WEIGHT_CROSS,
) -> BlendedModel:
    """Calibrate s_v from market value and return a BlendedModel."""
    # results log-strength for every fit team
    s_r = {t: math.log(max(gs.atk[t], 1e-3)) - math.log(max(gs.dfn[t], 1e-3)) for t in gs.teams}

    # regress s_r on log(value) over teams that have both
    xs, ys = [], []
    for t, v in values.items():
        if v and t in s_r:
            xs.append(math.log(v))
            ys.append(s_r[t])
    if len(xs) >= 5:
        slope, intercept = np.polyfit(np.array(xs), np.array(ys), 1)
    else:
        slope, intercept = 0.0, 0.0

    gap: Dict[str, float] = {}
    for t, v in values.items():
        if v and t in s_r:
            s_v = slope * math.log(v) + intercept
            gap[t] = float(np.clip(s_v - s_r[t], -VALUE_GAP_CLIP, VALUE_GAP_CLIP))

    return BlendedModel(
        gs=gs, confed=confed, gap=gap, value=dict(values),
        w_same=w_same, w_cross=w_cross, reg=(float(slope), float(intercept)),
    )
