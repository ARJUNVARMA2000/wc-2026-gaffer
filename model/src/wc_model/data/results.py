"""Load and classify the martj42 international results dataset.

The dataset (`results.csv`) holds every men's full international since 1872 and is
kept up to date, so it doubles as our live source for 2026 World Cup results:
played matches carry scores, not-yet-played fixtures carry NA.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd

from ..config import RESULTS_CSV, RESULTS_URL, TOURNAMENT_TIERS


def download_results(dest: Path = RESULTS_CSV) -> Path:
    """Download the latest results.csv from GitHub (used by the live pipeline)."""
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(RESULTS_URL, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return dest


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


def world_cup_2026(df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """Return the 2026 World Cup matches present in the dataset (group stage)."""
    if df is None:
        df = load_results()
    wc = df[(df["tournament"] == "FIFA World Cup") & (df["date"].dt.year == 2026)]
    return wc.reset_index(drop=True)
