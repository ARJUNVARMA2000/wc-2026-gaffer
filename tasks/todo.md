# World Cup 2026 Model + Website — Task Tracker

## Phase 0 — Scaffold ✅
- [x] Monorepo layout (`model/`, `web/`, `tasks/`)
- [x] Python package `wc_model` + requirements.txt

## Phase 1 — Data pipeline ✅
- [x] Download martj42 international_results (49k matches, 1872→2026; auto-updating, includes 2026 WC fixtures)
- [x] Classify tournaments → importance tiers (K-weights)
- [x] Derive confederations from tournament participation
- [x] Team→ISO flag map (48 teams)

## Phase 2 — Ratings ✅
- [x] Port + extend Elo engine (expected score, MoV "paddlin'" multiplier, importance K, home adv)
- [x] Process 49k matches → current Elo (validated: Argentina/Spain/France/England top)

## Phase 3 — Goal model ✅
- [x] Time-weighted multiplicative Poisson attack/defense fit (home_adv 1.26, ~2.75 g/match)
- [x] Dixon-Coles scoreline matrix (mean draw 25.7% — realistic)
- [x] Round-Robin Score (PADDLIN headline metric)

## Phase 4 — Simulation ✅
- [x] 2026 bracket config (groups, R32, best-thirds eligibility, KO tree) — verified
- [x] Best-thirds selection + slot assignment via precomputed LUT
- [x] Vectorized Monte Carlo (50k sims in <1s); FIFA tiebreakers; live conditioning on played matches
- [x] Validated: probs sum to 1, monotonic rounds, sensible favorites

## Phase 5 — Pipeline ✅
- [x] `wc_model.pipeline` → teams.json, groups.json, matches.json, meta.json
- [x] Outputs copied to `web/public/data/`

## Phase 6 — Website ✅
- [x] Scaffold Next.js 16 (App Router, TS, Tailwind v4, Framer Motion 12)
- [x] Design system: ink/lime/gold theme, Anton+Hanken+JetBrains Mono, atmosphere bg
- [x] Projections (home): hero + favorite spotlight (CountUp) + sortable animated table w/ heatmap
- [x] Team Strength: attack/defense scatter + sortable Elo/RR/tilt table, confed filter
- [x] Groups: 12 animated cards, live standings + qualification-odds bars
- [x] Matches: results + upcoming W/D/L odds + projected scores, filters
- [x] Methodology page (credits Caley/PADDLIN' + Double Pivot)
- [x] Reduced-motion support; responsive; production build clean (TS passes, all pages static)

## Phase 7 — Live automation + hosting ✅
- [x] GitHub repo (private): github.com/ARJUNVARMA2000/wc-2026-gaffer
- [x] DEPLOYED on Firebase Hosting (GCP project agentic-ai-487000): https://gaffer-wc26.web.app
      (static export via next.config output:"export" → web/out → firebase deploy)
- [x] Workflow (.github/workflows/update.yml): every 6h refresh data → commit → build → deploy
- [ ] LAST STEP (user): add FIREBASE_SERVICE_ACCOUNT secret to enable the auto-deploy step
      (creating the SA key was blocked for me as a privilege escalation — see DEPLOY.md for the
      3 commands; manual `firebase deploy` already works with gcloud login)

## Phase 8 — Enhancements (LATER, per "pragmatic core")
- [ ] Transfermarkt squad-value adjustment + confederation blending
- [ ] Backtest vs WC 2022 (calibration: Brier/log-loss)

## Review
- Model validated end-to-end on 2026 data (28/72 group matches played as of 2026-06-19).
- Top title odds: Argentina 16%, Spain 11%, England 9%, Brazil 9%, France 8%.
- Website: Next.js 16 production build clean (0 TS errors, all 5 pages prerendered static);
  all routes HTTP 200; DOM-verified fonts/colors/data render correctly. Live at localhost:3000.
- Note: the gstack/preview screenshot tools time out in this sandbox (renderer can't capture);
  verification done via production build + DOM inspection + HTTP checks instead of screenshots.
- Verify visually: `cd web && npm run dev` → http://localhost:3000.

## Phase 8 — Enhancements
- [x] Transfermarkt squad-value scrape (`data/transfermarkt.py`, FIFA-ranking table, 48/48
      teams) + confederation-aware blend (`goals/blend.py`: lean value cross-confed, results intra)
      → shifts odds toward European value heavyweights (Argentina 16%→12%, Spain/England/France up)
      → shown on Strength page (SQUAD € column + scatter tooltip); `--refresh-values` re-scrapes
- [x] Backtest harness (`backtest.py`): (A) Elo walk-forward 2018-26 — log-loss 0.887 vs
      baseline 1.05, 60% acc, well-calibrated; (B) value-blend A/B on 2024-26 holdout — blend
      IMPROVES log-loss (0.8479 vs 0.8533) → confirms the squad-value layer helps out-of-sample;
      (C) pre-WC2022 Elo had champion Argentina #2 and runner-up France #8
- [ ] Expected-goals (xG / xElo) layer — the last missing PADDLIN' piece (hard data sourcing)
- [ ] Knockout-stage live conditioning once those fixtures appear in the dataset
- [ ] Altitude / time-zone-travel components of home advantage
- [ ] Tune VALUE_WEIGHT_SAME (0.15) / VALUE_WEIGHT_CROSS (0.45) via backtest
