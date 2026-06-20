# GAFFER — World Cup 2026 Forecast Engine

A national-team strength model and live projection site for the 2026 FIFA World Cup,
in the spirit of Michael Caley's **PADDLIN'** (Double Pivot / Expecting Goals).

**Pipeline:** results-Elo → Dixon-Coles goal model → Monte Carlo tournament simulation → JSON → website.

```
model/   Python: data ingest, ratings, goal model, simulation, pipeline
web/     Next.js site (App Router, Tailwind v4, Framer Motion)
tasks/   todo + lessons
```

## How it works

1. **Data** — every men's international since 1872 (~49k matches) from the public
   [martj42/international_results](https://github.com/martj42/international_results) dataset.
   It is kept current, so finished 2026 World Cup games flow straight in while upcoming
   fixtures stay open (live updating).
2. **Ratings** — Elo updated per match (`ΔR = K·G·(W−E)`); `K` scales with match importance,
   `G` is a log-dampened margin-of-victory ("paddlin'") multiplier. Home advantage applied at
   non-neutral venues.
3. **Goal model** — a time-weighted multiplicative Poisson fit gives each team an attack and
   defense rating; Dixon-Coles corrects low-scoring draws and yields a full scoreline distribution.
4. **Squad value** — each team's rating is nudged toward its Transfermarkt market value, weighted
   more in cross-confederation games and less within a confederation (PADDLIN's confederation blend).
5. **Simulation** — the real 2026 bracket (12 groups → top 2 + 8 best thirds → Round of 32 → … →
   Final) is played out 50,000 times, vectorized with NumPy. Played matches are fixed; only the
   rest are simulated. Outputs: title odds, round-by-round advancement, group qualification odds,
   per-match odds and projected scores.

## Run it

### Model (Python)
```bash
cd model
python -m venv .venv && . .venv/Scripts/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# generate all projections (downloads latest results, runs 50k sims, writes JSON)
PYTHONPATH=src python -m wc_model.pipeline --download --sims 50000
```
Outputs land in `model/data/output/` and are copied to `web/public/data/`
(`teams.json`, `groups.json`, `matches.json`, `meta.json`).

### Website (Next.js)
```bash
cd web
npm install
npm run dev          # http://localhost:3000
# or: npm run build && npm run start
```

## Live updates

Re-running `python -m wc_model.pipeline --download` re-pulls results, recomputes ratings,
re-simulates conditioned on games already played, and refreshes the JSON the site reads.
A scheduled GitHub Action (`.github/workflows/update.yml`) automates this; wire it to a
Vercel deploy so the public site refreshes through the tournament.

## Pages

- **Projections** — sortable title & advancement odds with a round-by-round heatmap
- **Strength** — Elo, round-robin score, attack/defense scatter
- **Groups** — 12 live group cards with qualification odds
- **Matches** — results + upcoming odds and projected scorelines
- **Method** — methodology, with credit to Caley/PADDLIN' and the Double Pivot

## Status / roadmap

Built: full pipeline + site, including **Transfermarkt squad-value blend** with confederation-aware
weighting (`--refresh-values` re-scrapes). The remaining piece of Caley's full model is expected-goals
(xG / xElo) data, hard to source for all international teams. See `tasks/todo.md`.

## Validation

`PYTHONPATH=src python -m wc_model.backtest` runs three checks:
- **Walk-forward calibration** (8,136 matches since 2018): log-loss **0.887 vs 1.05** baseline,
  60% accuracy, predicted vs observed home-win rates track within ~0.03 across all buckets.
- **Squad-value A/B** (2024-26 holdout): the Transfermarkt blend **improves** log-loss
  (0.8479 vs 0.8533) — it helps out-of-sample, not just in-sample.
- **Pre-WC2022 face check**: the model's ratings the day before the 2022 World Cup had eventual
  champion **Argentina #2** and runner-up **France #8**.

## Credit

Methodology adapted, with thanks, from Michael Caley & Mike Goodman's
[Double Pivot](https://www.youtube.com/@DoublePivotPod) series and Caley's
[Expecting Goals](https://www.expectinggoals.com) PADDLIN' write-ups. A forecast, not a guarantee.
