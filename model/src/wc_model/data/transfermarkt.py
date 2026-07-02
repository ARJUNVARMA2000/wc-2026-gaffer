"""Scrape national-team squad market values from Transfermarkt.

Source: the FIFA world-ranking table on transfermarkt.com, which lists every nation
with its total squad market value and confederation. Polite, cached, and resilient:
results are saved to data/raw/transfermarkt_values.json and reused unless refreshed.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Dict

from ..config import RAW_DIR

TM_URL = "https://www.transfermarkt.com/fifa/weltrangliste/statistik"
CACHE = RAW_DIR / "transfermarkt_values.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}

# Transfermarkt name -> our canonical (martj42) name, where they differ.
TM_NAME_FIXES = {
    "Cote d'Ivoire": "Ivory Coast",
    "Côte d'Ivoire": "Ivory Coast",
    "Czechia": "Czech Republic",
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
    "Korea, South": "South Korea",
    "South Korea": "South Korea",
    "Republic of Korea": "South Korea",
    "IR Iran": "Iran",
    "Cabo Verde": "Cape Verde",
    "Türkiye": "Turkey",
    "Turkiye": "Turkey",
    "USA": "United States",
    "Congo DR": "DR Congo",
    "DR Congo": "DR Congo",
    "Democratic Republic of the Congo": "DR Congo",
    "Curacao": "Curaçao",
    "United States of America": "United States",
}


def parse_value(s: str) -> float:
    """'€1.22bn' -> 1.22e9, '€807.50m' -> 8.075e8, '€0'/'-' -> 0.0 (euros)."""
    s = s.replace("€", "").replace(",", "").strip()
    if not s or s in {"-", "0"}:
        return 0.0
    m = re.match(r"([\d.]+)\s*(bn|m|k|Th\.)?", s)
    if not m:
        return 0.0
    val = float(m.group(1))
    unit = m.group(2)
    mult = {"bn": 1e9, "m": 1e6, "k": 1e3, "Th.": 1e3, None: 1.0}.get(unit, 1.0)
    return val * mult


def scrape(max_pages: int = 12, delay: float = 1.5, verbose: bool = True) -> Dict[str, dict]:
    """Scrape all nations -> {canonical_name: {value, confederation, fifa_rank}}."""
    import requests
    from bs4 import BeautifulSoup

    out: Dict[str, dict] = {}
    session = requests.Session()
    session.headers.update(HEADERS)
    for page in range(1, max_pages + 1):
        url = TM_URL if page == 1 else f"{TM_URL}?page={page}"
        resp = session.get(url, timeout=25)
        if resp.status_code != 200:
            if verbose:
                print(f"  page {page}: HTTP {resp.status_code}, stopping")
            break
        soup = BeautifulSoup(resp.text, "html.parser")
        table = soup.select_one("table.items")
        rows = table.select("tbody > tr") if table else []
        if not rows:
            break
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all("td", recursive=False)]
            a = row.select_one("td.hauptlink a") or row.select_one("a[href*='/startseite/verein/']")
            name = (a.get("title") or a.get_text(strip=True)) if a else (cells[1] if len(cells) > 1 else None)
            if not name:
                continue
            name = TM_NAME_FIXES.get(name, name)
            # value cell is the one containing '€'
            value_cell = next((c for c in cells if "€" in c), "")
            confed = next((c for c in cells if c in {"UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"}), "")
            out[name] = {
                "value": parse_value(value_cell),
                "confederation": confed,
                "fifa_rank": int(cells[0]) if cells and cells[0].isdigit() else None,
            }
        if verbose:
            print(f"  page {page}: {len(rows)} rows (total {len(out)})")
        time.sleep(delay)
    return out


def refresh(dest: Path = CACHE, min_teams: int = 50, **kw) -> Dict[str, dict]:
    """Scrape and write the cache file.

    Guard: if the scrape returns implausibly few nations (likely blocked), keep the
    existing cache instead of overwriting good data with a bad run.
    """
    data = scrape(**kw)
    if len(data) < min_teams and dest.exists():
        print(f"  scrape returned only {len(data)} nations; keeping existing cache")
        with open(dest, encoding="utf-8") as f:
            return json.load(f)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def load_values(path: Path = CACHE, allow_scrape: bool = True) -> Dict[str, float]:
    """Return {canonical_name: market_value_eur}. Uses cache; scrapes if missing."""
    if not path.exists():
        if allow_scrape:
            refresh(path)
        else:
            return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {k: v["value"] for k, v in data.items() if v.get("value")}
