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
import csv
import json
import math
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .config import MODEL_DIR, OUTPUT_DIR, RAW_DIR, WEB_DATA_DIR
from .goals.dixon_coles import outcome_probs, scoreline_matrix
from .sim.bracket_2026 import HOSTS

LOG_NAME = "predictions_log.json"
LOG_PATH = OUTPUT_DIR / LOG_NAME
REPO_ROOT = MODEL_DIR.parent
MATCHES_REL = "web/public/data/matches.json"
MODEL_REL = "web/public/data/model.json"

# Anchor for the R32 backfill: the last committed model.json that has the full
# group stage but no knockout results. Verified at build time — every R32 team's
# latest Elo entry at this commit is 2026-06-27 (group stage complete), and the
# first R32 tie is 2026-06-28, so predictions reconstructed from it cannot leak
# any knockout result. (R32 rows only entered matches.json once already played,
# so they were never snapshotted pre-match; this recovers them without hindsight.)
R32_ANCHOR_SHA = "6af792eea2510458c2de6784af40eb3d4e3ca482"


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


def _model_at(sha: str) -> dict:
    """The committed model.json (per-team goal params) as of a git commit."""
    blob = _git(["show", f"{sha}:{MODEL_REL}"])
    return json.loads(blob)


def _predict_from_params(params: dict, home: str, away: str,
                         adv: Optional[str]) -> tuple:
    """(pHome, pDraw, pAway, lambdaHome, lambdaAway) for a matchup from a
    model.json param block. Mirrors goals/blend.py BlendedModel.lambdas exactly
    (validated to reproduce live-logged predictions), then runs the shared
    Dixon-Coles core. adv=the team playing in its own country, else None."""
    T = params["teams"]
    ca, cb = T[home]["confederation"], T[away]["confederation"]
    w = params["wCross"] if ca != cb else params["wSame"]

    def eff(t: str) -> tuple:
        f = math.exp(0.5 * w * T[t]["gap"])
        return T[t]["atk"] * f, T[t]["dfn"] / f

    atk_h, dfn_h = eff(home)
    atk_a, dfn_a = eff(away)
    ha = params["homeAdv"]
    lh = (ha if adv == home else 1.0) * atk_h * dfn_a
    la = (ha if adv == away else 1.0) * atk_a * dfn_h
    ph, pd_, pa = outcome_probs(scoreline_matrix(lh, la, rho=params["rho"]))
    return ph, pd_, pa, lh, la


def _host_adv(home: str, away: str, country: Optional[str]) -> Optional[str]:
    """Which side (if any) is a tournament host playing in its own country.
    Mirrors pipeline.build_matches' knockout adv rule."""
    if home in HOSTS and country == home:
        return home
    if away in HOSTS and country == away:
        return away
    return None


def _results_country_index(path: Path = RAW_DIR / "results.csv") -> Dict[frozenset, str]:
    """Order-independent {home,away} -> host country, from the results feed."""
    idx: Dict[frozenset, str] = {}
    if not path.exists():
        return idx
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            h, a, c = r.get("home_team"), r.get("away_team"), r.get("country")
            if h and a:
                idx[frozenset((h, a))] = c or ""
    return idx


def backfill_r32_from_model(matches: List[dict], log: Dict[str, dict],
                            anchor: str = R32_ANCHOR_SHA) -> Dict[str, dict]:
    """Reconstruct pre-match predictions for played R32 ties that were never
    snapshotted live, using the model.json committed just after the group stage.

    Returns only NEW entries (never overwrites an existing snapshot). Each carries
    reconstructed/anchorSha provenance so it can't be mistaken for a live log."""
    params = _model_at(anchor)
    when = _git(["show", "-s", "--format=%cI", anchor]).strip() or _now()
    countries = _results_country_index()

    out: Dict[str, dict] = {}
    for m in matches:
        if m.get("round") != "R32" or not m.get("played"):
            continue
        key = _key(m)
        if key in log:                       # keep any live snapshot as-is
            continue
        h, a = m["home"], m["away"]
        adv = _host_adv(h, a, countries.get(frozenset((h, a))))
        ph, pd_, pa, lh, la = _predict_from_params(params, h, a, adv)
        out[key] = {
            "date": m["date"], "home": h, "away": a,
            "pHome": round(ph, 3), "pDraw": round(pd_, 3), "pAway": round(pa, 3),
            "projHome": round(lh, 2), "projAway": round(la, 2),
            "snapshotAt": when, "reconstructed": True, "anchorSha": anchor,
        }
    return out


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
    ap.add_argument("--backfill-r32", action="store_true",
                    help="reconstruct R32 pre-match predictions from the post-group model.json")
    args = ap.parse_args()
    if args.backfill:
        bf = backfill_from_git()
        merged = load_log()
        for k, v in bf.items():
            merged.setdefault(k, v)        # never clobber a live snapshot
        write_log(merged)
        print(f"backfilled {len(bf)} matches; log now has {len(merged)} entries")
    elif args.backfill_r32:
        with open(REPO_ROOT / MATCHES_REL, encoding="utf-8") as f:
            matches = json.load(f)
        bf = backfill_r32_from_model(matches, load_log())
        merged = load_log()
        for k, v in bf.items():
            merged.setdefault(k, v)        # never clobber a live snapshot
        write_log(merged)
        print(f"reconstructed {len(bf)} R32 ties; log now has {len(merged)} entries")
    else:
        print(f"{len(load_log())} entries in {LOG_PATH}")


if __name__ == "__main__":
    main()
