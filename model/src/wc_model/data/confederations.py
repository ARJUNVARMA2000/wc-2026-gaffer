"""Derive each national team's confederation from tournament participation.

Rather than hand-maintaining a 210-row table, we infer confederation from which
confederation-specific competitions a team has appeared in (most frequent wins).
A small manual override map fixes the handful of ambiguous cases.
"""

from __future__ import annotations

from typing import Dict

import pandas as pd

from ..config import CONFEDERATION_TOURNAMENT_KEYWORDS

# Hosts & a few teams whose competitive history is thin/ambiguous in the data.
MANUAL_OVERRIDES: Dict[str, str] = {
    "United States": "CONCACAF",
    "Canada": "CONCACAF",
    "Mexico": "CONCACAF",
    "Curaçao": "CONCACAF",
    "Haiti": "CONCACAF",
    "Panama": "CONCACAF",
    "Cape Verde": "CAF",
    "DR Congo": "CAF",
    "New Zealand": "OFC",
    "Australia": "AFC",   # moved AFC in 2006
    "Uzbekistan": "AFC",
    "Jordan": "AFC",
}


def derive_confederations(df: pd.DataFrame) -> Dict[str, str]:
    """Return {team_name: confederation} for every team in the results frame."""
    teams = pd.unique(pd.concat([df["home_team"], df["away_team"]]))
    tlower = df["tournament"].str.lower()

    # Pre-compute a confederation tag per match from the tournament name.
    def match_confed(t: str) -> str | None:
        for confed, keywords in CONFEDERATION_TOURNAMENT_KEYWORDS.items():
            if any(k in t for k in keywords):
                return confed
        return None

    df = df.assign(_confed=tlower.map(match_confed))
    tagged = df.dropna(subset=["_confed"])

    # Count confederation appearances per team (home + away).
    counts: Dict[str, Dict[str, int]] = {}
    for side in ("home_team", "away_team"):
        for team, confed in zip(tagged[side], tagged["_confed"]):
            counts.setdefault(team, {}).setdefault(confed, 0)
            counts[team][confed] += 1

    result: Dict[str, str] = {}
    for team in teams:
        if team in MANUAL_OVERRIDES:
            result[team] = MANUAL_OVERRIDES[team]
        elif team in counts and counts[team]:
            result[team] = max(counts[team].items(), key=lambda kv: kv[1])[0]
        else:
            result[team] = "UNK"
    return result
