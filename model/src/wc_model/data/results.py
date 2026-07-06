"""Load and classify the martj42 international results dataset.

The dataset (`results.csv`) holds every men's full international since 1872 and is
kept up to date, so it doubles as our live source for 2026 World Cup results:
played matches carry scores, not-yet-played fixtures carry NA.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd

from ..config import (
    GROUP_STAGE_END,
    RESULTS_CSV,
    RESULTS_URL,
    SHOOTOUTS_CSV,
    SHOOTOUTS_URL,
    TOURNAMENT_TIERS,
)


def download_results(dest: Path = RESULTS_CSV) -> Path:
    """Download the latest results.csv from GitHub (used by the live pipeline)."""
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(RESULTS_URL, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return dest


def download_shootouts(dest: Path = SHOOTOUTS_CSV) -> Path:
    """Download the latest shootouts.csv (penalty-shootout winners) from GitHub."""
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(SHOOTOUTS_URL, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return dest


def load_shootouts(path: Path = SHOOTOUTS_CSV) -> pd.DataFrame:
    """Load shootouts.csv (date, home_team, away_team, winner, first_shooter).

    Returns an empty typed frame when the file is absent so callers (fresh
    checkouts, tests) never need to special-case it.
    """
    cols = ["date", "home_team", "away_team", "winner", "first_shooter"]
    if not Path(path).exists():
        df = pd.DataFrame(columns=cols)
        df["date"] = pd.to_datetime(df["date"])
        return df
    df = pd.read_csv(path, encoding="utf-8")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df.dropna(subset=["date"]).reset_index(drop=True)


def classify_tournament(tournament: str) -> str:
    """Map a raw `tournament` label to an importance tier (see config.K_WEIGHTS)."""
    t = str(tournament).strip().lower()
    for key, tier in TOURNAMENT_TIERS.items():
        if key in t:
            return tier
    # Sensible fallbacks for the long tail of minor/regional tournaments.
    if "qualification" in t or "qualifier" in t:
        return "continental_qual"
    if t == "friendly":
        return "friendly"
    return "minor_tournament"


def load_results(path: Path = RESULTS_CSV, played_only: bool = False) -> pd.DataFrame:
    """Load results.csv into a tidy, typed DataFrame.

    Columns: date (datetime), home_team, away_team, home_score, away_score (float;
    NaN = unplayed), tournament, city, country, neutral (bool), tier, played (bool).
    """
    df = pd.read_csv(path, encoding="utf-8")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df["neutral"] = df["neutral"].astype(str).str.upper().eq("TRUE")
    df["tier"] = df["tournament"].map(classify_tournament)
    df["played"] = df["home_score"].notna() & df["away_score"].notna()
    df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    if played_only:
        df = df[df["played"]].reset_index(drop=True)
    return df


def world_cup_2026(df: Optional[pd.DataFrame] = None, stage: str = "all") -> pd.DataFrame:
    """Return the 2026 World Cup matches present in the dataset.

    stage: "all" (default), "group" (same-group pairings on/before GROUP_STAGE_END),
    or "ko" (everything after — the date window matters because from the QF on a
    knockout match CAN pair two same-group teams). A cross-group pairing dated
    inside the group window is anomalous data: excluded from both and warned.
    """
    if stage not in ("all", "group", "ko"):
        raise ValueError(f"stage must be 'all', 'group' or 'ko', got {stage!r}")
    if df is None:
        df = load_results()
    wc = df[(df["tournament"] == "FIFA World Cup") & (df["date"].dt.year == 2026)]
    wc = wc.reset_index(drop=True)
    if stage == "all":
        return wc

    from ..sim.bracket_2026 import GROUPS

    team_group = {t: g for g, ts in GROUPS.items() for t in ts}
    hg = wc["home_team"].map(team_group)
    ag = wc["away_team"].map(team_group)
    same_group = hg.notna() & (hg == ag)
    in_window = wc["date"] <= pd.Timestamp(GROUP_STAGE_END)
    anomalous = ~same_group & in_window
    if anomalous.any():
        for r in wc[anomalous].itertuples(index=False):
            print(f"  WARN: cross-group row inside group window skipped: "
                  f"{r.date.date()} {r.home_team} v {r.away_team}")
    if stage == "group":
        return wc[same_group & in_window].reset_index(drop=True)
    return wc[~in_window].reset_index(drop=True)
