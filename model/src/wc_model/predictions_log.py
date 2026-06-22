"""Remember GAFFER's PRE-MATCH predictions.

The pipeline overwrites a match with its final score once it is played, discarding
the pre-match probabilities. To grade GAFFER against the market (Kalshi) after the
fact we must keep what we predicted BEFORE kickoff.

- update_log(): called every pipeline run; upserts the current probabilities for
  every still-unplayed match. Once a match is played its entry is never touched
  again, so it freezes as the last pre-match snapshot.
- backfill_from_git(): one-time reconstruction of already-played matches from the
  committed git history of matches.json (each 6-hourly commit froze then-unplayed
  probabilities). Walking oldest -> newest and upserting unplayed matches yields,
  per match, the last snapshot before it was played.

Stored at data/output/predictions_log.json (+ web mirror), keyed "date|home|away".

Run (one-time):  PYTHONPATH=src python -m wc_model.predictions_log --backfill
"""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .config import MODEL_DIR, OUTPUT_DIR, WEB_DATA_DIR

LOG_NAME = "predictions_log.json"
LOG_PATH = OUTPUT_DIR / LOG_NAME
REPO_ROOT = MODEL_DIR.parent
MATCHES_REL = "web/public/data/matches.json"


def _key(m: dict) -> str:
    return f"{m['date']}|{m['home']}|{m['away']}"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _snapshot(m: dict, when: str) -> dict:
    return {
        "date": m["date"], "home": m["home"], "away": m["away"],
        "pHome": m["pHome"], "pDraw": m["pDraw"], "pAway": m["pAway"],
        "projHome": m.get("projHome"), "projAway": m.get("projAway"),
        "snapshotAt": when,
    }


def load_log(path: Path = LOG_PATH) -> Dict[str, dict]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def update_log(matches: List[dict], prev: Optional[Dict[str, dict]] = None,
               when: Optional[str] = None) -> Dict[str, dict]:
    """Merge the latest pre-match probs for every UNPLAYED match into the log.

    Pure: returns the merged dict (the pipeline routes it through write_outputs).
    Played matches are left exactly as they are -> their last pre-match snapshot.
    """
    when = when or _now()
    log = dict(prev) if prev is not None else load_log()
    for m in matches:
        if m.get("played") or m.get("pHome") is None:
            continue
        log[_key(m)] = _snapshot(m, when)
    return log


def _git(args: List[str]) -> str:
    return subprocess.run(["git", *args], cwd=REPO_ROOT,
                          capture_output=True, text=True, encoding="utf-8").stdout


def backfill_from_git(rel: str = MATCHES_REL) -> Dict[str, dict]:
    """Reconstruct the log for already-played matches from matches.json history."""
    shas = _git(["log", "--format=%H", "--", rel]).split()
    shas.reverse()                                   # oldest -> newest
    log: Dict[str, dict] = {}
    for sha in shas:
        blob = _git(["show", f"{sha}:{rel}"])
        if not blob.strip():
            continue
        try:
            matches = json.loads(blob)
        except json.JSONDecodeError:
            continue
        when = _git(["show", "-s", "--format=%cI", sha]).strip() or _now()
        for m in matches:
            if m.get("played") or m.get("pHome") is None:
                continue
            log[_key(m)] = _snapshot(m, when)
    return log


def write_log(log: Dict[str, dict]) -> None:
    """Standalone dual-write (the pipeline uses write_outputs instead)."""
    for d in (OUTPUT_DIR, WEB_DATA_DIR):
        d.mkdir(parents=True, exist_ok=True)
        with open(d / LOG_NAME, "w", encoding="utf-8") as f:
            json.dump(log, f, ensure_ascii=False, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true",
                    help="reconstruct the log from git history of matches.json")
    args = ap.parse_args()
    if args.backfill:
        bf = backfill_from_git()
        merged = load_log()
        for k, v in bf.items():
            merged.setdefault(k, v)        # never clobber a live snapshot
        write_log(merged)
        print(f"backfilled {len(bf)} matches; log now has {len(merged)} entries")
    else:
        print(f"{len(load_log())} entries in {LOG_PATH}")


if __name__ == "__main__":
    main()
