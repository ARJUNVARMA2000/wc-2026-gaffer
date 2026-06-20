"""Backtests: is the model calibrated, and does the squad-value blend help?

Three checks:
  A) Elo walk-forward (2018->now): predict every match W/D/L from ratings known
     BEFORE kickoff, score vs a base-rate baseline. Tests out-of-sample calibration.
  B) Value-blend A/B: fit the goal model on <=2023, predict 2024-2026 matches with and
     without the Transfermarkt blend, compare log-loss. Tests whether the blend helps.
  C) Pre-WC2022 favorites: ratings as of the day before the 2022 World Cup, vs what
     actually happened (Argentina won, France runner-up).

Run: PYTHONPATH=src python -m wc_model.backtest
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .data.confederations import derive_confederations
from .data.results import load_results
from .data.transfermarkt import load_values
from .goals.blend import build_blend
from .goals.dixon_coles import outcome_probs, scoreline_matrix
from .goals.strength import fit_goal_strength
from .ratings.elo import expected_score, k_factor, mov_multiplier, win_draw_loss
from .config import DEFAULT_RATING, HOME_ADVANTAGE


def _metrics(probs: np.ndarray, outcomes: np.ndarray) -> dict:
    """probs: (n,3) for [H,D,A]; outcomes: (n,) in {0,1,2}. Returns log-loss, brier, acc."""
    p = np.clip(probs, 1e-9, 1)
    n = len(outcomes)
    ll = -np.mean(np.log(p[np.arange(n), outcomes]))
    onehot = np.zeros((n, 3)); onehot[np.arange(n), outcomes] = 1
    brier = np.mean(np.sum((p - onehot) ** 2, axis=1))
    acc = np.mean(np.argmax(p, axis=1) == outcomes)
    return {"n": n, "logloss": ll, "brier": brier, "acc": acc}


def _outcome(hg, ag) -> int:
    return 0 if hg > ag else (1 if hg == ag else 2)


# ---------------------------------------------------------------------------
# A) Elo walk-forward
# ---------------------------------------------------------------------------
def elo_walk_forward(df: pd.DataFrame, start="2018-01-01"):
    ratings: dict[str, float] = {}
    start = pd.Timestamp(start)
    rows_probs, rows_out = [], []
    for r in df[df["played"]].itertuples(index=False):
        rh = ratings.get(r.home_team, DEFAULT_RATING)
        ra = ratings.get(r.away_team, DEFAULT_RATING)
        if r.date >= start:
            w, d, l = win_draw_loss(rh, ra, neutral=bool(r.neutral))
            rows_probs.append([w, d, l]); rows_out.append(_outcome(r.home_score, r.away_score))
        # update
        adv = 0.0 if r.neutral else HOME_ADVANTAGE
        he = expected_score(rh + adv, ra)
        if r.home_score > r.away_score: ha, aa = 1.0, 0.0
        elif r.away_score > r.home_score: ha, aa = 0.0, 1.0
        else: ha, aa = 0.5, 0.5
        k = k_factor(r.tier) * mov_multiplier(r.home_score - r.away_score)
        ratings[r.home_team] = rh + k * (ha - he)
        ratings[r.away_team] = ra + k * (aa - (1 - he))
    if not rows_out:                       # ratings-only call (no eval window)
        return None, None, None, ratings
    probs = np.array(rows_probs); out = np.array(rows_out, dtype=int)
    model = _metrics(probs, out)
    base = np.bincount(out, minlength=3) / len(out)
    baseline = _metrics(np.tile(base, (len(out), 1)), out)
    return model, baseline, base, ratings


def calibration_table(df: pd.DataFrame, start="2018-01-01", bins=10):
    """Reliability of the predicted home-win probability."""
    ratings: dict[str, float] = {}
    start = pd.Timestamp(start)
    ph_list, hit_list = [], []
    for r in df[df["played"]].itertuples(index=False):
        rh = ratings.get(r.home_team, DEFAULT_RATING); ra = ratings.get(r.away_team, DEFAULT_RATING)
        if r.date >= start:
            w, d, l = win_draw_loss(rh, ra, neutral=bool(r.neutral))
            ph_list.append(w); hit_list.append(1 if r.home_score > r.away_score else 0)
        adv = 0.0 if r.neutral else HOME_ADVANTAGE
        he = expected_score(rh + adv, ra)
        if r.home_score > r.away_score: ha, aa = 1.0, 0.0
        elif r.away_score > r.home_score: ha, aa = 0.0, 1.0
        else: ha, aa = 0.5, 0.5
        k = k_factor(r.tier) * mov_multiplier(r.home_score - r.away_score)
        ratings[r.home_team] = rh + k * (ha - he); ratings[r.away_team] = ra + k * (aa - (1 - he))
    ph = np.array(ph_list); hit = np.array(hit_list)
    edges = np.linspace(0, 1, bins + 1)
    table = []
    for i in range(bins):
        m = (ph >= edges[i]) & (ph < edges[i + 1])
        if m.sum() > 20:
            table.append((edges[i], edges[i + 1], ph[m].mean(), hit[m].mean(), int(m.sum())))
    return table


# ---------------------------------------------------------------------------
# B) Value-blend A/B (goal model, holdout 2024-2026)
# ---------------------------------------------------------------------------
def value_blend_ab(df: pd.DataFrame, train_end="2023-12-31", eval_start="2024-01-01"):
    train = df[df["date"] <= pd.Timestamp(train_end)]
    gs = fit_goal_strength(train)
    confed = derive_confederations(train)
    values = load_values(allow_scrape=False)
    m_val = build_blend(gs, confed, values)
    m_no = build_blend(gs, confed, {})

    ev = df[(df["played"]) & (df["date"] > pd.Timestamp(eval_start))]
    P_val, P_no, out = [], [], []
    for r in ev.itertuples(index=False):
        if r.home_team not in gs.atk or r.away_team not in gs.atk:
            continue
        for model, store in ((m_val, P_val), (m_no, P_no)):
            lh, la = model.expected_goals(r.home_team, r.away_team, neutral=bool(r.neutral))
            store.append(list(outcome_probs(scoreline_matrix(lh, la))))
        out.append(_outcome(r.home_score, r.away_score))
    out = np.array(out)
    return _metrics(np.array(P_val), out), _metrics(np.array(P_no), out)


# ---------------------------------------------------------------------------
# C) Pre-WC2022 favorites
# ---------------------------------------------------------------------------
def pre_wc2022_favorites(df: pd.DataFrame, top=12):
    _, _, _, ratings = elo_walk_forward(df[df["date"] < pd.Timestamp("2022-11-20")], start="2099-01-01")
    ranked = sorted(ratings.items(), key=lambda kv: -kv[1])
    return ranked[:top]


def main():
    df = load_results()
    print("=" * 64)
    print("A) ELO WALK-FORWARD CALIBRATION (matches since 2018)")
    model, baseline, base, _ = elo_walk_forward(df, start="2018-01-01")
    print(f"   eval matches: {model['n']:,}")
    print(f"   base rates   H/D/A: {base[0]:.0%}/{base[1]:.0%}/{base[2]:.0%}")
    print(f"   {'metric':9}{'model':>10}{'baseline':>12}")
    for k in ("logloss", "brier", "acc"):
        print(f"   {k:9}{model[k]:>10.4f}{baseline[k]:>12.4f}")
    print("\n   home-win calibration (pred -> observed):")
    for lo, hi, predm, obs, n in calibration_table(df):
        print(f"     {lo:.1f}-{hi:.1f}: pred {predm:.2f}  obs {obs:.2f}  (n={n})")

    print("\n" + "=" * 64)
    print("B) SQUAD-VALUE BLEND A/B (goal model, holdout 2024-2026)")
    val, no = value_blend_ab(df)
    print(f"   eval matches: {val['n']:,}")
    print(f"   {'metric':9}{'+value':>10}{'results-only':>14}")
    for k in ("logloss", "brier", "acc"):
        print(f"   {k:9}{val[k]:>10.4f}{no[k]:>14.4f}")
    delta = no["logloss"] - val["logloss"]
    print(f"   -> value blend {'IMPROVES' if delta > 0 else 'WORSENS'} log-loss by {abs(delta):.4f}")

    print("\n" + "=" * 64)
    print("C) PRE-WC2022 FAVORITES (Elo as of 2022-11-19; Argentina won, France 2nd)")
    for i, (t, r) in enumerate(pre_wc2022_favorites(df), 1):
        tag = {"Argentina": "  <- CHAMPION", "France": "  <- runner-up",
               "Croatia": "  <- semis", "Morocco": "  <- semis"}.get(t, "")
        print(f"   {i:2}. {t:16} {r:6.0f}{tag}")


if __name__ == "__main__":
    main()
