"""Shared fixtures: synthetic results frames and a minimal goal-model stand-in.

Everything here is deterministic and self-contained — no network, no
model/data/raw files — so the suite runs anywhere (CI included).
"""

from __future__ import annotations

import sys
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Make `wc_model` importable no matter where pytest is invoked from
# (pyproject's `pythonpath = ["src"]` covers the normal case).
SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from wc_model.data.results import classify_tournament  # noqa: E402
from wc_model.sim import bracket_2026 as B  # noqa: E402


def make_results_df(rows: list[dict]) -> pd.DataFrame:
    """Build a frame shaped like data.results.load_results() from row overrides."""
    base = {
        "date": "2024-06-01",
        "home_team": "",
        "away_team": "",
        "home_score": np.nan,
        "away_score": np.nan,
        "tournament": "Friendly",
        "city": "",
        "country": "",
        "neutral": False,
    }
    df = pd.DataFrame([{**base, **r} for r in rows])
    df["date"] = pd.to_datetime(df["date"])
    df["home_score"] = pd.to_numeric(df["home_score"])
    df["away_score"] = pd.to_numeric(df["away_score"])
    df["neutral"] = df["neutral"].astype(bool)
    df["tier"] = df["tournament"].map(classify_tournament)
    df["played"] = df["home_score"].notna() & df["away_score"].notna()
    return df.sort_values("date").reset_index(drop=True)


@pytest.fixture
def results_factory():
    return make_results_df


class DummyModel:
    """Minimal object honouring the `lambdas(home, away, adv_team)` contract.

    Strength-ratio based, so it is symmetric: lambdas(a, b) == reversed
    lambdas(b, a), which keeps the knockout win matrix complementary.
    """

    def __init__(self, strengths: dict | None = None, base: float = 1.25, adv: float = 1.25):
        self.strengths = strengths or {}
        self.base = base
        self.adv = adv

    def lambdas(self, home: str, away: str, adv_team: str | None = None):
        sh = self.strengths.get(home, 1.0)
        sa = self.strengths.get(away, 1.0)
        lh = self.base * sh / sa
        la = self.base * sa / sh
        if adv_team == home:
            lh *= self.adv
        elif adv_team == away:
            la *= self.adv
        return lh, la

    def expected_goals(self, home: str, away: str, neutral: bool = True):
        return self.lambdas(home, away, None if neutral else home)


@pytest.fixture
def dummy_model():
    return DummyModel()


@pytest.fixture
def dummy_model_factory():
    return DummyModel


def _wc2026_rows() -> list[dict]:
    rows = []
    day = 0
    for teams in B.GROUPS.values():
        for h, a in combinations(teams, 2):
            rows.append(
                {
                    "date": f"2026-06-{11 + (day % 15):02d}",
                    "home_team": h,
                    "away_team": a,
                    "tournament": "FIFA World Cup",
                    "neutral": True,
                    "country": "",
                    "city": "Somewhere",
                }
            )
            day += 1
    return rows


@pytest.fixture
def wc2026_df() -> pd.DataFrame:
    """All 72 group-stage fixtures of the real 2026 draw, none played yet."""
    return make_results_df(_wc2026_rows())


@pytest.fixture
def wc2026_groupA_played() -> pd.DataFrame:
    """Same 72 fixtures, but group A fully played: Mexico wins every match 2-0,
    the other three group-A games are 1-1 draws."""
    rows = _wc2026_rows()
    group_a = set(B.GROUPS["A"])
    mexico = "Mexico"
    for r in rows:
        if r["home_team"] in group_a and r["away_team"] in group_a:
            if r["home_team"] == mexico:
                r["home_score"], r["away_score"] = 2, 0
            elif r["away_team"] == mexico:
                r["home_score"], r["away_score"] = 0, 2
            else:
                r["home_score"], r["away_score"] = 1, 1
    return make_results_df(rows)


def wc2026_all_played_rows() -> list[dict]:
    """All 72 group games played with deterministic scores: within each group,
    the draw-order teams finish 1st..4th with distinct points (9/6/3/0) — no
    ties anywhere, so final standings are unambiguous."""
    rows = _wc2026_rows()
    for g, ts in B.GROUPS.items():
        rank = {t: i for i, t in enumerate(ts)}
        for r in rows:
            if r["home_team"] in rank and r["away_team"] in rank:
                if rank[r["home_team"]] < rank[r["away_team"]]:
                    r["home_score"], r["away_score"] = 1, 0
                else:
                    r["home_score"], r["away_score"] = 0, 1
    return rows


@pytest.fixture
def wc2026_all_played() -> pd.DataFrame:
    return make_results_df(wc2026_all_played_rows())


def ko_row(date: str, home: str, away: str, hg=None, ag=None,
           city: str = "Somewhere", country: str = "United States",
           neutral: bool = True) -> dict:
    """A 2026 WC knockout row for make_results_df (unplayed when scores None)."""
    return {
        "date": date, "home_team": home, "away_team": away,
        "home_score": np.nan if hg is None else hg,
        "away_score": np.nan if ag is None else ag,
        "tournament": "FIFA World Cup", "neutral": neutral,
        "city": city, "country": country,
    }


def make_shootouts_df(rows: list[dict]) -> pd.DataFrame:
    """Frame shaped like data.results.load_shootouts()."""
    cols = ["date", "home_team", "away_team", "winner", "first_shooter"]
    base = {c: "" for c in cols}
    df = pd.DataFrame([{**base, **r} for r in rows], columns=cols)
    df["date"] = pd.to_datetime(df["date"])
    return df
