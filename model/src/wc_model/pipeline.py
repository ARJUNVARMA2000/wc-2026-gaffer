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
from .config import (
    DEFAULT_N_SIMS,
    DIXON_COLES_RHO,
    OUTPUT_DIR,
    VALUE_WEIGHT_CROSS,
    VALUE_WEIGHT_SAME,
    WEB_DATA_DIR,
)
from .data.flags import iso
from .data.results import download_results, load_results, world_cup_2026
from .data.transfermarkt import load_values
from .goals.blend import BlendedModel, build_blend
from .goals.dixon_coles import most_likely_score, outcome_probs, scoreline_matrix
from .goals.strength import fit_goal_strength
from .ratings.build import build_ratings
from .sim import bracket_2026 as B
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


def build_paths(sim, rr: Dict[str, float], rating_model, team_to_group: Dict[str, str]) -> list:
    """Per-team likely knockout opponents + draw-difficulty (powers the Paths tab).

    Difficulty = "draw luck": the expected round-robin strength of the R32+R16 opponents,
    independent of the team's own quality, min-max normalised 0 (kindest) .. 100 (cruelest).
    """
    teams = sim.teams
    tidx = {t: i for i, t in enumerate(teams)}
    rr_vec = np.array([rr[t] for t in teams])
    OPP = ("R32", "R16", "QF", "SF")

    cond = {}
    for R in OPP:
        M = sim.opp[R].astype(float)
        rs = M.sum(axis=1, keepdims=True)
        cond[R] = np.divide(M, rs, out=np.zeros_like(M), where=rs > 0)

    exp_r32 = cond["R32"] @ rr_vec
    exp_r16 = cond["R16"] @ rr_vec
    has_r16 = sim.opp["R16"].sum(axis=1) > 0
    raw = np.where(has_r16, 0.6 * exp_r32 + 0.4 * exp_r16, exp_r32)
    valid = sim.opp["R32"].sum(axis=1) > 0
    lo, hi = raw[valid].min(), raw[valid].max()
    span = (hi - lo) or 1.0
    diff = np.where(valid, 100.0 * (raw - lo) / span, 0.0)
    order = np.argsort(raw)                       # ascending raw = kindest first
    rank = np.empty(len(teams), dtype=int)
    rank[order] = np.arange(1, len(teams) + 1)

    out = []
    for t in teams:
        i = tidx[t]
        entry = {
            "name": t, "iso": iso(t),
            "confederation": rating_model.ratings[t].confederation,
            "group": team_to_group[t],
            "reachR32": round(float(sim.rounds["R32"][i]), 4),
            "reachR16": round(float(sim.rounds["R16"][i]), 4),
            "reachQF": round(float(sim.rounds["QF"][i]), 4),
            "reachSF": round(float(sim.rounds["SF"][i]), 4),
            "champion": round(float(sim.champion[i]), 4),
            "pathDifficulty": round(float(diff[i]), 1),
            "pathRank": int(rank[i]),
            "expOppR32": round(float(exp_r32[i]), 2),
            "expOppR16": round(float(exp_r16[i]), 2),
            "rounds": {},
        }
        for R in OPP:
            row = cond[R][i]
            top = np.argsort(-row)[:6]
            entry["rounds"][R] = [
                {"opp": teams[j], "oppIso": iso(teams[j]),
                 "prob": round(float(row[j]), 4), "winProb": round(float(sim.win[i, j]), 4)}
                for j in top if row[j] > 0
            ]
        out.append(entry)
    out.sort(key=lambda p: p["pathRank"])
    return out


def _bracket_feeders() -> Dict[int, tuple]:
    """match_no -> (feeder_a, feeder_b) for every non-R32 knockout match (incl. the final)."""
    return {**B.R16, **B.QF, **B.SF, B.FINAL: (101, 102)}


def _inorder_matches() -> list:
    """All knockout match numbers in visual top-to-bottom order (in-order tree walk).

    Walking left-subtree -> node -> right-subtree from the final yields, within any
    single round, the matches in the order they stack vertically in the bracket. The
    first half of each round is the left side of the tree, the second half the right.
    """
    feeders = _bracket_feeders()
    r32 = {m for m, _, _ in B.R32}
    seq: list = []

    def walk(m: int) -> None:
        if m in r32:
            seq.append(m)
            return
        fa, fb = feeders[m]
        walk(fa)
        seq.append(m)
        walk(fb)

    walk(B.FINAL)
    return seq


def _slot_label(slot: str) -> str:
    """Human label for a bracket slot: '1E' -> 'Winner Grp E', 'T74' -> '3rd place'."""
    if slot.startswith("T"):
        return "3rd place"
    pos, g = slot[0], slot[1]
    return f"{'Winner' if pos == '1' else 'Runner-up'} Grp {g}"


def build_bracket(sim, rating_model, team_to_group: Dict[str, str], elo_rank: Dict[str, int]) -> dict:
    """Forward-filled projected knockout bracket.

    The Round-of-32 is seeded with the modal (most-simulated) team per slot. From there
    the favourite of each tie advances (chalk propagation by the neutral head-to-head
    win matrix), filling R16 -> QF -> SF -> Final -> champion. Every slot carries:
      - winPct: P(this team beats the other team IN THIS MATCH) — the two sides of a
        match sum to 1.0;
      - candidates: the teams most likely to actually occupy this slot (from the feeding
        match's winner distribution), for the on-hover "who else could be here" list.
    """
    teams = sim.teams
    n = sim.n_sims
    win = sim.win
    feeders = _bracket_feeders()
    r32_slots = {m: (sa, sb) for m, sa, sb in B.R32}

    # ---- R32 occupants: modal team per slot, de-duplicated (confident slots first) ----
    counts = sim.slots
    top_share = {s: float(c.max()) / n for s, c in counts.items()}
    used: set = set()
    slot_team: Dict[str, int] = {}
    for s in sorted(counts, key=lambda s: -top_share[s]):
        modal = int(np.argmax(counts[s]))
        chosen = modal  # fallback: a real occupant (may duplicate) beats an impossible team
        for ti in np.argsort(-counts[s]):
            ti = int(ti)
            if counts[s][ti] <= 0:
                break       # support exhausted — keep the modal pick, never invent a 0-sim team
            if ti not in used:
                chosen = ti
                break
        used.add(chosen)
        slot_team[s] = chosen

    # ---- chalk propagation: participants + projected winner of every match ----
    part: Dict[int, tuple] = {}      # match -> (team_a_idx, team_b_idx)
    proj_winner: Dict[int, int] = {}
    for m, sa, sb in B.R32:
        a, b = slot_team[sa], slot_team[sb]
        part[m] = (a, b)
        proj_winner[m] = a if win[a, b] >= win[b, a] else b
    for pairs in (B.R16, B.QF, B.SF, {B.FINAL: (101, 102)}):
        for m, (fa, fb) in pairs.items():
            a, b = proj_winner[fa], proj_winner[fb]
            part[m] = (a, b)
            proj_winner[m] = a if win[a, b] >= win[b, a] else b

    def candidates(dist: np.ndarray, k: int = 6) -> list:
        """Top-k teams by occupancy probability (drop the long tail < 0.5%)."""
        out = []
        for ti in np.argsort(-dist)[:k]:
            p = float(dist[int(ti)])
            if p <= 0 or (p < 0.005 and out):
                break
            nm = teams[int(ti)]
            out.append({"name": nm, "iso": iso(nm), "prob": round(p, 4)})
        return out

    def slot(m: int, which: str) -> dict:
        a, b = part[m]
        me, other = (a, b) if which == "a" else (b, a)
        nm = teams[me]
        info = {
            "name": nm, "iso": iso(nm),
            "seed": elo_rank[nm], "group": team_to_group[nm],
            "winPct": round(float(win[me, other]), 4),
            "fav": bool(me == proj_winner[m]),   # single source of truth — matches the advancer
        }
        if m in r32_slots:                       # R32: occupant is a fixed group finisher
            src = r32_slots[m][0] if which == "a" else r32_slots[m][1]
            info["slotLabel"] = _slot_label(src)
            info["candidates"] = candidates(counts[src] / n)
        else:                                    # R16+: occupant = winner of a feeder match
            f = feeders[m][0] if which == "a" else feeders[m][1]
            info["slotLabel"] = ""
            info["candidates"] = candidates(sim.match_win[f])
        return info

    def make_match(m: int) -> dict:
        return {"match": m, "round": B.ROUND_OF[m], "a": slot(m, "a"), "b": slot(m, "b")}

    rounds = {"R32": [], "R16": [], "QF": [], "SF": []}
    for m in _inorder_matches():
        r = B.ROUND_OF[m]
        if r in rounds:
            rounds[r].append(make_match(m))
    left = {r: ms[: len(ms) // 2] for r, ms in rounds.items()}
    right = {r: ms[len(ms) // 2:] for r, ms in rounds.items()}

    champ = proj_winner[B.FINAL]
    a, b = part[B.FINAL]
    runner = b if champ == a else a
    champ_name = teams[champ]
    champion = {
        "name": champ_name, "iso": iso(champ_name),
        "seed": elo_rank[champ_name], "group": team_to_group[champ_name],
        "champion": round(float(sim.champion[champ]), 4),   # title odds (headline)
        "winPct": round(float(win[champ, runner]), 4),      # win-the-final, head-to-head
        "candidates": candidates(sim.match_win[B.FINAL]),   # title-odds field, for hover
    }
    return {"nSims": n, "left": left, "right": right,
            "final": make_match(B.FINAL), "champion": champion}


def build_model_params(gs, model, rating_model) -> dict:
    """Per-team goal-model params so the website can compute any head-to-head live."""
    return {
        "homeAdv": round(gs.home_adv, 4),
        "rho": DIXON_COLES_RHO,
        "avgGoals": round(gs.avg_goals, 4),
        "wSame": VALUE_WEIGHT_SAME,
        "wCross": VALUE_WEIGHT_CROSS,
        "teams": {
            t: {
                "atk": round(gs.atk[t], 4),
                "dfn": round(gs.dfn[t], 4),
                "gap": round(model.gap.get(t, 0.0), 4),
                "confederation": rating_model.ratings[t].confederation,
                "iso": iso(t),
            }
            for t in gs.teams if t in rating_model.ratings
        },
    }


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
    from .predictions_log import load_log
    plog = load_log()                                  # frozen pre-match probs (for upsets)
    matches_out = []
    for row in wc_df.sort_values("date").itertuples(index=False):
        h, a = row.home_team, row.away_team
        g = team_to_group.get(h)
        if g is None or team_to_group.get(a) != g:
            continue
        date_str = row.date.strftime("%Y-%m-%d")
        venue = getattr(row, "country", None)
        adv = h if (h in HOSTS and venue == h) else (a if (a in HOSTS and venue == a) else None)
        m = {
            "date": date_str, "group": g,
            "home": h, "away": a, "homeIso": iso(h), "awayIso": iso(a),
            "city": getattr(row, "city", ""), "played": bool(row.played),
        }
        if bool(row.played):
            hg, ag = int(row.home_score), int(row.away_score)
            m["homeScore"], m["awayScore"] = hg, ag
            # Pre-match probs: frozen snapshot if we logged one, else recompute (labeled hindsight).
            frozen = plog.get(f"{date_str}|{h}|{a}")
            if frozen and frozen.get("pHome") is not None:
                ph, pd_, pa = frozen["pHome"], frozen["pDraw"], frozen["pAway"]
            else:
                ph, pd_, pa = outcome_probs(scoreline_matrix(*model.lambdas(h, a, adv)))
            outcome = 0 if hg > ag else (2 if ag > hg else 1)
            m.update({
                "pHome": round(ph, 3), "pDraw": round(pd_, 3), "pAway": round(pa, 3),
                "modelProb": round((ph, pd_, pa)[outcome], 3),   # prob model gave the actual result
                "frozen": bool(frozen),
            })
        else:
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
    paths_out = build_paths(sim, rr, rating_model, team_to_group)
    bracket_out = build_bracket(sim, rating_model, team_to_group, elo_rank)
    return {
        "teams.json": teams_out, "groups.json": groups_out,
        "matches.json": matches_out, "meta.json": meta,
        "paths.json": paths_out, "bracket.json": bracket_out,
        "model.json": build_model_params(gs, model, rating_model),
        "ratings_history.json": rating_model.history or {},
    }


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
    ap.add_argument("--scorecard", action="store_true",
                    help="build the Kalshi accuracy + betting scorecard")
    ap.add_argument("--kalshi-refresh", action="store_true",
                    help="re-pull Kalshi market prices before scoring")
    args = ap.parse_args()
    outputs = build_outputs(n_sims=args.sims, download=args.download,
                            refresh_values=args.refresh_values)

    # Always remember pre-match predictions so they survive once matches are played.
    from . import predictions_log
    log = predictions_log.update_log(outputs["matches.json"])
    outputs[predictions_log.LOG_NAME] = log

    # Accumulate team-level projection snapshots over time (powers the Trends tab).
    from . import history
    outputs[history.HISTORY_NAME] = history.update_history(outputs["teams.json"], outputs["meta.json"])

    if args.scorecard:
        from .compare import build_scorecard
        from .data import kalshi
        if args.kalshi_refresh:
            # Kalshi's API intermittently 403s cloud-runner IPs (and can rate-limit).
            # A transient market-data blip must not abort the whole refresh+deploy;
            # fall back to the existing cache, mirroring the Transfermarkt scrape.
            try:
                kalshi.refresh(verbose=False)
            except Exception as e:
                print(f"  kalshi refresh failed ({e}); keeping existing cache")
        outputs["scorecard.json"] = build_scorecard(outputs["matches.json"], log, kalshi.load())

    write_outputs(outputs)
    top = outputs["teams.json"][:5]
    print("Top 5:", ", ".join(f"{t['name']} {t['champion']*100:.1f}%" for t in top))
    if args.scorecard:
        sc = outputs["scorecard.json"]["meta"]
        print(f"Scorecard: {sc['nScored']} matches scored "
              f"({sc['skipped']['noPrediction']} no-pred, {sc['skipped']['noMarket']} no-market)")


if __name__ == "__main__":
    main()
