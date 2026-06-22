"""Grade GAFFER's pre-match predictions against the Kalshi market.

Produces scorecard.json with two views of every played group match:

1. ACCURACY (no vig) — who is the better forecaster. Kalshi's three legs are
   de-vigged to a fair probability, then GAFFER and the market are each scored
   with Brier + log-loss on the actual result.

2. BETTING P&L (with vig) — how much money you'd have made backing GAFFER's edges
   into Kalshi's *actual* ask price. Per match we take the single leg where GAFFER
   most disagrees with the market (largest edge over the ask); if that edge clears
   EDGE_MIN we "buy" it. Settled at the real result, two ways: a flat stake and a
   fractional-Kelly bankroll.

The two views use different prices on purpose: accuracy uses the de-vigged mid (a
fair forecast comparison); P&L uses the raw ask (the real, vig-inclusive cost),
so the money figure is honest rather than flattering.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

import numpy as np

from .backtest import _metrics, _outcome
from .config import EDGE_MIN, FLAT_STAKE, KELLY_FRACTION, KELLY_START
from .data import kalshi

LEGS = ("HOME", "DRAW", "AWAY")
LEG_IDX = {"HOME": 0, "DRAW": 1, "AWAY": 2}


def _devig(mids: List[float]) -> List[float]:
    s = sum(mids)
    return [m / s for m in mids] if s > 0 else mids


def _clean(metrics: dict) -> dict:
    return {k: (int(v) if k == "n" else round(float(v), 4)) for k, v in metrics.items()}


def _key(m: dict) -> str:
    return f"{m['date']}|{m['home']}|{m['away']}"


def build_scorecard(matches: List[dict], log: Dict[str, dict],
                    kalshi_data: Dict[str, dict],
                    edge_min: float = EDGE_MIN, flat_stake: float = FLAT_STAKE,
                    kelly_start: float = KELLY_START,
                    kelly_fraction: float = KELLY_FRACTION) -> dict:
    played = [m for m in matches if m.get("played") and m.get("homeScore") is not None]
    skipped = {"noPrediction": 0, "noMarket": 0}

    rows = []
    for m in played:
        pred = log.get(_key(m))
        if not pred:
            skipped["noPrediction"] += 1
            continue
        km = kalshi_data.get(kalshi.pair_key(m["home"], m["away"]))
        legs = (km or {}).get("legs", {})
        home_leg, away_leg, tie_leg = legs.get(m["home"]), legs.get(m["away"]), legs.get("TIE")
        if not (home_leg and away_leg and tie_leg):
            skipped["noMarket"] += 1
            continue
        rows.append({
            "match": m, "pred": pred,
            "closeTime": (km or {}).get("closeTime"),
            "legs": {"HOME": home_leg, "DRAW": tie_leg, "AWAY": away_leg},
            "outcome": _outcome(m["homeScore"], m["awayScore"]),
        })

    accuracy = _accuracy(rows)
    pnl, ledger = _backtest(rows, edge_min, flat_stake, kelly_start, kelly_fraction)

    return {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "nPlayed": len(played),
            "nScored": len(rows),
            "nAccuracy": accuracy["n"] if accuracy else 0,
            "skipped": skipped,
            "edgeMin": edge_min, "flatStake": flat_stake,
            "kellyStart": kelly_start, "kellyFraction": kelly_fraction,
        },
        "accuracy": accuracy,
        "pnl": pnl,
        "ledger": ledger,
    }


def _accuracy(rows: List[dict]) -> Optional[dict]:
    g_probs, k_probs, outs = [], [], []
    for r in rows:
        mids = [r["legs"][L].get("mid") for L in LEGS]
        if any(x is None for x in mids):
            continue
        p = r["pred"]
        g_probs.append([p["pHome"], p["pDraw"], p["pAway"]])
        k_probs.append(_devig(mids))
        outs.append(r["outcome"])
    if not outs:
        return None
    outs = np.array(outs, dtype=int)
    return {
        "n": len(outs),
        "gaffer": _clean(_metrics(np.array(g_probs), outs)),
        "kalshi": _clean(_metrics(np.array(k_probs), outs)),
    }


def _backtest(rows: List[dict], edge_min: float, flat_stake: float,
              kelly_start: float, kelly_fraction: float):
    rows_sorted = sorted(rows, key=lambda r: r.get("closeTime") or r["match"]["date"])

    flat_net = flat_staked = 0.0
    flat_wins = n_bets = 0
    flat_curve: List[float] = []
    bank = kelly_start
    kelly_curve: List[float] = []
    ledger: List[dict] = []

    for r in rows_sorted:
        m, pred, outcome = r["match"], r["pred"], r["outcome"]
        gp = {"HOME": pred["pHome"], "DRAW": pred["pDraw"], "AWAY": pred["pAway"]}

        # best +EV leg = where GAFFER most exceeds the ask
        best = None
        for L in LEGS:
            ask = r["legs"][L].get("ask")
            if ask is None or not (0.0 < ask < 1.0):
                continue
            edge = gp[L] - ask
            if best is None or edge > best["edge"]:
                best = {"leg": L, "ask": ask, "edge": edge}

        bet = None
        if best and best["edge"] >= edge_min:
            L, ask, edge = best["leg"], best["ask"], best["edge"]
            won = LEG_IDX[L] == outcome

            # flat: deploy a fixed $ per bet, buy flat_stake/ask contracts @ $1 payout
            f_net = (flat_stake / ask - flat_stake) if won else -flat_stake
            flat_net += f_net
            flat_staked += flat_stake
            n_bets += 1
            flat_wins += int(won)

            # fractional Kelly on the binary edge: f* = (p - ask) / (1 - ask)
            f_star = max(0.0, min(kelly_fraction * (edge / (1.0 - ask)), 1.0))
            stake_k = f_star * bank
            k_net = (stake_k / ask - stake_k) if won else -stake_k
            bank += k_net

            flat_curve.append(round(flat_net, 2))
            kelly_curve.append(round(bank, 2))
            bet = {
                "leg": L, "ask": round(ask, 4), "edge": round(edge, 4), "won": won,
                "netFlat": round(f_net, 2),
                "stakeKelly": round(stake_k, 2), "netKelly": round(k_net, 2),
            }

        mids = {L: r["legs"][L].get("mid") for L in LEGS}
        devig = None
        if all(mids[L] is not None for L in LEGS):
            dv = _devig([mids["HOME"], mids["DRAW"], mids["AWAY"]])
            devig = {L: round(dv[i], 4) for i, L in enumerate(LEGS)}

        ledger.append({
            "date": m["date"], "home": m["home"], "away": m["away"],
            "homeIso": m.get("homeIso"), "awayIso": m.get("awayIso"),
            "homeScore": m["homeScore"], "awayScore": m["awayScore"],
            "outcome": outcome,
            "gaffer": {L: round(gp[L], 3) for L in LEGS},
            "market": {L: {k: r["legs"][L].get(k) for k in ("ask", "bid", "mid")}
                       for L in LEGS},
            "devig": devig,
            "bet": bet,
        })

    pnl = {
        "flat": {
            "staked": round(flat_staked, 2), "net": round(flat_net, 2),
            "roi": round(flat_net / flat_staked, 4) if flat_staked else 0.0,
            "nBets": n_bets, "wins": flat_wins,
            "winRate": round(flat_wins / n_bets, 4) if n_bets else 0.0,
            "curve": flat_curve,
        },
        "kelly": {
            "start": kelly_start, "final": round(bank, 2),
            "roi": round((bank - kelly_start) / kelly_start, 4) if kelly_start else 0.0,
            "curve": kelly_curve,
        },
    }
    return pnl, ledger
