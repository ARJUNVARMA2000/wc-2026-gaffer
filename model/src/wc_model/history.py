"""Accumulate GAFFER's team-level projections over time (powers the Trends tab).

`teams.json` is overwritten every run, so to chart how title odds / Elo move over the
tournament we keep one snapshot per *results-state*. Mirrors `predictions_log.py`:
- update_history(): pure; upserts the current snapshot (keyed by `dataThrough`, so the
  ~6-hourly identical re-runs collapse to one point per results-day) and recomputes the
  risers/fallers; returns the merged object routed through `write_outputs`.
- backfill_from_git(): one-time reconstruction from committed teams.json + meta.json.

Stored at data/output/history.json (+ web mirror). Snapshot team keys are short to keep
the file small over a full tournament: c=champion f=final s=sf q=qf r=r16 k=ko e=elo.

Run (one-time):  PYTHONPATH=src python -m wc_model.history --backfill
"""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .config import MODEL_DIR, OUTPUT_DIR, WEB_DATA_DIR

HISTORY_NAME = "history.json"
HISTORY_PATH = OUTPUT_DIR / HISTORY_NAME
REPO_ROOT = MODEL_DIR.parent
TEAMS_REL = "web/public/data/teams.json"
META_REL = "web/public/data/meta.json"
N_MOVERS = 8


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _snapshot(teams: List[dict], meta: dict) -> dict:
    return {
        "ts": meta.get("lastUpdated", _now()),
        "date": meta.get("dataThrough", ""),
        "played": meta.get("groupMatchesPlayed", 0),
        "teams": {
            t["name"]: {
                "c": t["champion"], "f": t["final"], "s": t["sf"],
                "q": t["qf"], "r": t["r16"], "k": t["ko"], "e": t["elo"],
            }
            for t in teams
        },
    }


def _upsert(snapshots: List[dict], snap: dict) -> List[dict]:
    """One point per `date`: replace the last snapshot if same results-state, else append."""
    if snapshots and snapshots[-1].get("date") == snap["date"]:
        snapshots[-1] = snap
    else:
        snapshots.append(snap)
    return snapshots


def _movers(snapshots: List[dict], metric: str, base_idx: int) -> dict:
    """Top ±N teams by change in `metric` between snapshots[base_idx] and the latest."""
    if len(snapshots) < 2 or base_idx >= len(snapshots) - 1:
        return {"risers": [], "fallers": []}
    cur, base = snapshots[-1]["teams"], snapshots[base_idx]["teams"]
    deltas = []
    for name, c in cur.items():
        if name in base and metric in c and metric in base[name]:
            deltas.append({"name": name, "from": base[name][metric],
                           "to": c[metric], "delta": round(c[metric] - base[name][metric], 4)})
    deltas.sort(key=lambda d: d["delta"], reverse=True)
    risers = [d for d in deltas if d["delta"] > 0][:N_MOVERS]
    fallers = [d for d in deltas if d["delta"] < 0][-N_MOVERS:][::-1]
    return {"risers": risers, "fallers": fallers}


def _with_movers(snapshots: List[dict]) -> dict:
    return {
        "generatedAt": _now(),
        "snapshots": snapshots,
        "movers": {
            "sinceStart": {"champ": _movers(snapshots, "c", 0), "elo": _movers(snapshots, "e", 0)},
            "sinceLast": {"champ": _movers(snapshots, "c", len(snapshots) - 2),
                          "elo": _movers(snapshots, "e", len(snapshots) - 2)},
        },
    }


def load_history(path: Path = HISTORY_PATH) -> List[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f).get("snapshots", [])


def update_history(teams: List[dict], meta: dict,
                   prev: Optional[List[dict]] = None) -> dict:
    """Append the current snapshot (deduped by results-state) and recompute movers."""
    snapshots = list(prev) if prev is not None else load_history()
    snapshots = _upsert(snapshots, _snapshot(teams, meta))
    return _with_movers(snapshots)


def _git(args: List[str]) -> str:
    return subprocess.run(["git", *args], cwd=REPO_ROOT,
                          capture_output=True, text=True, encoding="utf-8").stdout


def backfill_from_git() -> dict:
    """Rebuild the snapshot series from the committed history of teams.json + meta.json."""
    shas = _git(["log", "--format=%H", "--", TEAMS_REL]).split()
    shas.reverse()                                   # oldest -> newest
    snapshots: List[dict] = []
    for sha in shas:
        try:
            teams = json.loads(_git(["show", f"{sha}:{TEAMS_REL}"]) or "[]")
            meta = json.loads(_git(["show", f"{sha}:{META_REL}"]) or "{}")
        except json.JSONDecodeError:
            continue
        if not teams or not meta:
            continue
        snapshots = _upsert(snapshots, _snapshot(teams, meta))
    return _with_movers(snapshots)


def write_history(obj: dict) -> None:
    for d in (OUTPUT_DIR, WEB_DATA_DIR):
        d.mkdir(parents=True, exist_ok=True)
        with open(d / HISTORY_NAME, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true",
                    help="rebuild history.json from git history of teams.json")
    args = ap.parse_args()
    if args.backfill:
        obj = backfill_from_git()
        write_history(obj)
        print(f"backfilled {len(obj['snapshots'])} snapshots to {HISTORY_PATH}")
    else:
        print(f"{len(load_history())} snapshots in {HISTORY_PATH}")


if __name__ == "__main__":
    main()
