"""End-to-end pipeline: data -> ratings -> goal model -> simulation -> JSON.

Run:  PYTHONPATH=src python -m wc_model.pipeline [--download] [--sims N]

Writes teams.json, groups.json, matches.json, meta.json to data/output/ and
copies them to ../web/public/data/ (the contract the website reads).
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from typing import Dict

import numpy as np

from . import __version__
from .config import DEFAULT_N_SIMS, OUTPUT_DIR, WEB_DATA_DIR
from .data.flags import iso
from .data.results import download_results, load_results, world_cup_2026
from .data.transfermarkt import load_values
from .goals.blend import BlendedModel, build_blend
from .goals.dixon_coles import most_likely_score, outcome_probs, scoreline_matrix
from .goals.strength import fit_goal_strength
from .ratings.build import build_ratings
from .sim.bracket_2026 import GROUPS, HOSTS
from .sim.simulate import simulate


def round_robin_scores(model: BlendedModel, teams: list) -> Dict[str, float]:
    """Average points/match each team would earn vs the 48-team field (neutral)."""
    rr = {}
    for t in teams:
        pts = 0.0
        for o in teams:
            if o == t:
                continue
            lh, la = model.expected_goals(t, o, neutral=True)
            ph, pd_, _ = outcome_probs(scoreline_matrix(lh, la))
            pts += 3 * ph + pd_
        rr[t] = pts / (len(teams) - 1)
    return rr


def current_standings(wc_df) -> Dict[str, dict]:
    """Group-stage points/GD/GF so far, from played matches only."""
    rec = {t: {"played": 0, "points": 0, "gf": 0, "ga": 0} for ts in GROUPS.values() for t in ts}
    for row in wc_df.itertuples(index=False):
        if not bool(row.played):
            continue
        h, a, hg, ag = row.home_team, row.away_team, int(row.home_score), int(row.away_score)
        if h not in rec or a not in rec:
            continue
        for tt, gf, ga in ((h, hg, ag), (a, ag, hg)):
            rec[tt]["played"] += 1
            rec[tt]["gf"] += gf
            rec[tt]["ga"] += ga
            rec[tt]["points"] += 3 if gf > ga else (1 if gf == ga else 0)
    for r in rec.values():
        r["gd"] = r["gf"] - r["ga"]
    return rec


def build_outputs(n_sims: int = DEFAULT_N_SIMS, download: bool = False,
                  refresh_values: bool = False) -> dict:
    if download:
        download_results()
    df = load_results()
    rating_model = build_ratings(df)
    gs = fit_goal_strength(df)

    # squad-value blend (Transfermarkt), confederation-aware
    confed = {t: r.confederation for t, r in rating_model.ratings.items()}
    if refresh_values:
        from .data.transfermarkt import refresh as refresh_tm
        refresh_tm(verbose=False)
    values = load_values()
    model = build_blend(gs, confed, values)

    sim = simulate(model, n_sims=n_sims, df=df)

    wc_df = world_cup_2026(df)
    teams = sim.teams
    tidx = {t: i for i, t in enumerate(teams)}
    team_to_group = {t: g for g, ts in GROUPS.items() for t in ts}
    rr = round_robin_scores(model, teams)
    stand = current_standings(wc_df)
    elo_order = sorted(teams, key=lambda t: rating_model.elo(t), reverse=True)
    elo_rank = {t: i + 1 for i, t in enumerate(elo_order)}
    val_order = sorted(teams, key=lambda t: model.value.get(t, 0), reverse=True)
    val_rank = {t: i + 1 for i, t in enumerate(val_order)}

    # ---- teams.json ----
    teams_out = []
    for t in teams:
        i = tidx[t]
        attack, defense = gs.strength_vs_field(t, teams)
        teams_out.append({
            "name": t, "iso": iso(t), "confederation": rating_model.ratings[t].confederation,
            "group": team_to_group[t], "host": t in HOSTS,
            "elo": round(rating_model.elo(t), 0), "eloRank": elo_rank[t],
            "rr": round(rr[t], 3),
            "value": round(model.value.get(t, 0) / 1e6, 1), "valueRank": val_rank[t],
            "attack": round(attack, 2), "defense": round(defense, 2),
            "tilt": round(attack - defense, 2),
            "champion": round(float(sim.champion[i]), 4),
            "final": round(float(sim.rounds["Final"][i]), 4),
            "sf": round(float(sim.rounds["SF"][i]), 4),
            "qf": round(float(sim.rounds["QF"][i]), 4),
            "r16": round(float(sim.rounds["R16"][i]), 4),
            "ko": round(float(sim.rounds["R32"][i]), 4),
            "current": stand.get(t, {"played": 0, "points": 0, "gd": 0, "gf": 0}),
        })
    teams_out.sort(key=lambda x: -x["champion"])

    # ---- groups.json ----
    groups_out = {}
    for g, ts in GROUPS.items():
        rows = []
        for li, t in enumerate(ts):
            rows.append({
                "name": t, "iso": iso(t), "host": t in HOSTS,
                "winGroup": round(float(sim.group_win[g][li]), 4),
                "advance": round(float(sim.group_advance[g][li]), 4),
                "xPts": round(float(sim.exp_points[g][li]), 2),
                **stand.get(t, {"played": 0, "points": 0, "gd": 0, "gf": 0}),
            })
        rows.sort(key=lambda r: (-r["points"], -r["gd"], -r["gf"]))  # live standing order
        groups_out[g] = rows

    # ---- matches.json ----
    matches_out = []
    for row in wc_df.sort_values("date").itertuples(index=False):
        h, a = row.home_team, row.away_team
        g = team_to_group.get(h)
        if g is None or team_to_group.get(a) != g:
            continue
        m = {
            "date": row.date.strftime("%Y-%m-%d"), "group": g,
            "home": h, "away": a, "homeIso": iso(h), "awayIso": iso(a),
            "city": getattr(row, "city", ""), "played": bool(row.played),
        }
        if bool(row.played):
            m["homeScore"] = int(row.home_score)
            m["awayScore"] = int(row.away_score)
        else:
            venue = getattr(row, "country", None)
            adv = h if (h in HOSTS and venue == h) else (a if (a in HOSTS and venue == a) else None)
            lh, la = model.lambdas(h, a, adv)
            mat = scoreline_matrix(lh, la)
            ph, pd_, pa = outcome_probs(mat)
            mh, ma, _ = most_likely_score(mat)
            m.update({
                "pHome": round(ph, 3), "pDraw": round(pd_, 3), "pAway": round(pa, 3),
                "projHome": round(lh, 2), "projAway": round(la, 2),
                "likelyHome": mh, "likelyAway": ma,
            })
        matches_out.append(m)

    played_group = sum(1 for m in matches_out if m["played"])
    meta = {
        "lastUpdated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataThrough": rating_model.last_update,
        "nSims": n_sims,
        "groupMatchesPlayed": played_group,
        "groupMatchesTotal": len(matches_out),
        "nTeams": len(teams),
        "modelVersion": __version__,
        "homeAdv": round(gs.home_adv, 3),
        "avgGoals": round(gs.avg_goals * 2, 2),
        "valuesLoaded": sum(1 for t in teams if model.value.get(t)),
    }
    return {"teams.json": teams_out, "groups.json": groups_out,
            "matches.json": matches_out, "meta.json": meta}


def write_outputs(outputs: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for fname, data in outputs.items():
        path = OUTPUT_DIR / fname
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.copy(path, WEB_DATA_DIR / fname)
    print(f"Wrote {len(outputs)} files to {OUTPUT_DIR} and {WEB_DATA_DIR}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="fetch latest results first")
    ap.add_argument("--refresh-values", action="store_true", help="re-scrape Transfermarkt values")
    ap.add_argument("--sims", type=int, default=DEFAULT_N_SIMS)
    args = ap.parse_args()
    outputs = build_outputs(n_sims=args.sims, download=args.download,
                            refresh_values=args.refresh_values)
    write_outputs(outputs)
    top = outputs["teams.json"][:5]
    print("Top 5:", ", ".join(f"{t['name']} {t['champion']*100:.1f}%" for t in top))


if __name__ == "__main__":
    main()
