"""Fetch + cache Kalshi World Cup match-market prices (series KXWCGAME).

Mirrors data/transfermarkt.py: a polite, cached, resilient pull. For every World
Cup group match Kalshi runs a 3-way moneyline — one binary market per team plus a
TIE. We snapshot each leg's PRE-MATCH price from the public candlesticks endpoint
so it can be compared to GAFFER's pre-match probabilities and used in a betting
backtest (see compare.py).

Pre-match timing: a match market closes ~at the final whistle, and its price sits
on a flat plateau all day until kickoff, then races to 0/1 during the game. So the
price ~KALSHI_PREMATCH_BUFFER_MIN minutes before close_time is a clean pre-match
quote that cannot leak in-game movement. (occurrence_datetime is the *decisive
moment*, not kickoff, so we deliberately don't use it for the snapshot.)

Public market data needs no auth. Cache: data/raw/kalshi_wcgame.json.

Run: PYTHONPATH=src python -m wc_model.data.kalshi --refresh
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from ..config import (
    KALSHI_API,
    KALSHI_PREMATCH_BUFFER_MIN,
    KALSHI_SERIES,
    RAW_DIR,
)

CACHE = RAW_DIR / "kalshi_wcgame.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept": "application/json"}

# Kalshi team label -> our canonical (martj42 / flags.py) name, where they differ.
KALSHI_NAME_FIXES = {
    "IR Iran": "Iran",
    "Korea Republic": "South Korea",
    "Czechia": "Czech Republic",
    "USA": "United States",
    "Cabo Verde": "Cape Verde",
    "Cote d'Ivoire": "Ivory Coast",
    "Côte d'Ivoire": "Ivory Coast",
    "Türkiye": "Turkey",
    "Turkiye": "Turkey",
    "Curacao": "Curaçao",
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
    "Congo DR": "DR Congo",
}


def canon(name: str) -> str:
    """Kalshi team label -> our canonical team name."""
    name = name.strip()
    return KALSHI_NAME_FIXES.get(name, name)


def pair_key(a: str, b: str) -> str:
    """Order-independent match key (each group pair meets exactly once)."""
    return " | ".join(sorted([a, b]))


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
def _session():
    import requests

    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _get(session, path: str, params: Optional[dict] = None, retries: int = 2):
    url = f"{KALSHI_API}{path}"
    for attempt in range(retries + 1):
        resp = session.get(url, params=params, timeout=25)
        if resp.status_code == 429 or resp.status_code >= 500:
            if attempt < retries:
                time.sleep(0.6 * (attempt + 1))
                continue
        resp.raise_for_status()
        return resp.json()
    resp.raise_for_status()


def _parse_ts(s: Optional[str]) -> Optional[datetime]:
    """Parse an ISO-8601 timestamp (with 'Z' and possible fractional seconds)."""
    if not s:
        return None
    s = s.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        # over-long fractional seconds -> trim to 6 digits
        if "." in s and "+" in s:
            head, rest = s.split(".", 1)
            frac, tz = rest.split("+", 1)
            return datetime.fromisoformat(f"{head}.{frac[:6]}+{tz}")
        raise


def fetch_events(session, status: str = "settled") -> List[dict]:
    """All KXWCGAME events (with nested markets) for a status, following the cursor."""
    out: List[dict] = []
    cursor = None
    while True:
        params = {
            "series_ticker": KALSHI_SERIES,
            "with_nested_markets": "true",
            "limit": 200,
            "status": status,
        }
        if cursor:
            params["cursor"] = cursor
        data = _get(session, "/events", params)
        out.extend(data.get("events", []))
        cursor = data.get("cursor")
        if not cursor:
            break
    return out


def fetch_candles(session, ticker: str, start_ts: int, end_ts: int,
                  period: int = 60) -> List[dict]:
    path = f"/series/{KALSHI_SERIES}/markets/{ticker}/candlesticks"
    data = _get(session, path,
                {"start_ts": start_ts, "end_ts": end_ts, "period_interval": period})
    return data.get("candlesticks", [])


# ---------------------------------------------------------------------------
# Price extraction
# ---------------------------------------------------------------------------
def _price(node: Optional[dict]) -> Optional[float]:
    """A candle price node carries dollars as strings, e.g. {'close_dollars': '0.69'}."""
    if not node:
        return None
    v = node.get("close_dollars")
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if 0.0 < f < 1.0 else None   # 0/1 ⇒ settled, not a live quote


def _snapshot(candles: List[dict], cutoff_ts: int) -> Optional[dict]:
    """Last candle at/before the pre-match cutoff with a usable quote."""
    usable = [c for c in candles if c.get("end_period_ts", 0) <= cutoff_ts]
    for c in reversed(usable):
        ask = _price(c.get("yes_ask"))
        bid = _price(c.get("yes_bid"))
        last = _price(c.get("price"))
        if ask is None and bid is None and last is None:
            continue
        if ask is None:
            ask = last if last is not None else bid
        if bid is None:
            bid = last if last is not None else ask
        mid = (ask + bid) / 2 if (ask is not None and bid is not None) else last
        return {
            "ask": round(ask, 4),
            "bid": round(bid, 4),
            "mid": round(mid, 4),
            "last": round(last, 4) if last is not None else None,
            "ts": c.get("end_period_ts"),
        }
    return None


# ---------------------------------------------------------------------------
# Refresh + load
# ---------------------------------------------------------------------------
def refresh(dest: Path = CACHE, verbose: bool = True,
            lookback_days: int = 14) -> Dict[str, dict]:
    """Pull settled KXWCGAME markets and snapshot each leg's pre-match price."""
    session = _session()
    events = fetch_events(session, status="settled")
    if verbose:
        print(f"  KXWCGAME settled events: {len(events)}")

    out: Dict[str, dict] = {}
    buffer = timedelta(minutes=KALSHI_PREMATCH_BUFFER_MIN)
    for ev in events:
        markets = ev.get("markets") or []
        close = next((_parse_ts(m.get("close_time")) for m in markets if m.get("close_time")), None)
        if close is None:
            continue
        cutoff_ts = int((close - buffer).timestamp())
        start_ts = int((close - buffer - timedelta(days=lookback_days)).timestamp())

        legs: Dict[str, dict] = {}
        teams: List[str] = []
        for m in markets:
            sub = (m.get("yes_sub_title") or "").strip()
            if not sub:
                continue
            is_tie = sub.lower() in {"tie", "draw"}
            leg = "TIE" if is_tie else canon(sub)
            if not is_tie:
                teams.append(leg)
            candles = fetch_candles(session, m["ticker"], start_ts, cutoff_ts)
            snap = _snapshot(candles, cutoff_ts) or {}
            legs[leg] = {**snap, "result": m.get("result", ""), "ticker": m.get("ticker")}

        if len(teams) != 2:
            continue
        key = pair_key(teams[0], teams[1])
        out[key] = {
            "teams": teams,
            "eventTicker": ev.get("event_ticker"),
            "occurrence": next((m.get("occurrence_datetime") for m in markets
                                if m.get("occurrence_datetime")), None),
            "closeTime": close.isoformat(),
            "legs": legs,
        }
        if verbose:
            quotes = {k: v.get("ask") for k, v in legs.items()}
            print(f"    {key}: asks={quotes}")

    # guard: an empty pull shouldn't clobber a good cache
    if not out and dest.exists():
        print("  Kalshi pull returned nothing; keeping existing cache")
        with open(dest, encoding="utf-8") as f:
            return json.load(f)

    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    if verbose:
        print(f"  wrote {len(out)} matches -> {dest}")
    return out


def load(path: Path = CACHE) -> Dict[str, dict]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-pull from the Kalshi API")
    ap.add_argument("--lookback-days", type=int, default=14)
    args = ap.parse_args()
    if args.refresh:
        refresh(lookback_days=args.lookback_days)
    else:
        data = load()
        print(f"{len(data)} cached matches in {CACHE}")
        for k, v in list(data.items())[:5]:
            print(" ", k, "->", {leg: q.get("ask") for leg, q in v["legs"].items()})


if __name__ == "__main__":
    main()
