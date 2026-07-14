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

## Phase 9 — Bracket redesign: per-match win % + forward fill + hover alternatives
Goal: (1) %s = chance of winning THAT match (each match sums to 100%), not title odds;
(2) populate every downstream round (R16/QF/SF/Final) with the projected match winner;
(3) hover a projected slot → other likely teams that could fill it (with probs).
- [ ] sim: expose per-match winner-occupancy dist (`match_win[m]`) from `winners[m]`
- [ ] pipeline `build_bracket`: full multi-round bracket — chalk-propagate favorite by
      `sim.win`; per slot winPct (sums to 100) + fav + candidates (top-K feeder dist);
      champion = final favorite, hover = title-odds dist
- [ ] data.ts: new Bracket/BracketMatch/BracketSlot/Candidate types
- [ ] BracketTree.tsx: all rounds as match cards; heat win% chips; portal hover tooltip
- [ ] page.tsx copy; regen data; build; verify in browser
- Verify: each match sums to 100; advancer == feeding-match favorite; hover alternatives

### Phase 9 — DONE + adversarial review (16-agent workflow)
- [x] All 6 build steps implemented + verified (data math validated across all 31 matches;
      DOM-verified render, hover, champion badge; prod build + ESLint clean)
- [x] Fixed 9 confirmed review findings:
      HIGH — center/final connectors realigned to column 50% (verified connectorTop==centerCell50);
             champion hover relabeled "Most likely to win it all", no misleading bold
      MED  — R32 de-dup zero-occupancy guard; tooltip horizontal viewport clamp;
             ESLint set-state-in-effect → useSyncExternalStore
      LOW  — fav = single source (proj_winner); removed unused import; keyboard/touch a11y
             (tabIndex+onFocus/onBlur+title fallback); copy scoped to R16/QF/SF slots
- Note: projected champion = Spain (wins chalk final 51-49) ≠ title-odds leader Argentina
        (15.4%, easiest draw). Faithful to "winner advances"; flagged to user to confirm headline.
- Pre-existing (out of scope): Nav.tsx:53 timeAgo(Date.now()) causes a recoverable hydration
  mismatch on every page — flagged as a separate task.

## Phase 10 — Live refresh + Linear/Stripe UI overhaul + resume polish
Plan: ~/.claude/plans/task-notification-task-id-w2brfbiie-tas-compressed-storm.md
- [x] WS2 core: lib/types.ts split; lib/live.ts (useSyncExternalStore store, visibility-aware
      polling, minute-bucket cache buster, interest set, atomic swap); LiveUpdater; LiveStatus
      (fixes the Nav timeAgo hydration mismatch above)
- [x] WS1 Phase A foundation: @theme semantic tokens (+migration bridge), Inter(opsz)+JetBrains,
      aurora bg, glass/gradient/focus-visible vocabulary, lib/motion.ts, heat() API (fixes
      invalid `${heatColor}22` CSS), Providers(MotionConfig reducedMotion), template.tsx,
      ui/ primitive kit (PageHeader, Chip, SegmentedControl, SortButton, Bar, Tooltip, Select,
      HeatPill, Footnote, StatCard, Kbd, CommandPalette), CountUp/Reveal rebuilds
- [x] WS1 Phase B shell: scroll-glass Nav w/ layoutId pill + animated mobile menu + ⌘K,
      Footer w/ GitHub + arjun-varma.com links; foundation build green
- [x] Component passes (10-agent fan-out): hero + 14 view components w/ live hooks,
      a11y, perf fixes; TrendChart replaces LineChart+Spark; all tsc-clean
- [x] Python track: model/tests (127 tests, 1.2s, no network), ci.yml, material_diff.py
      (validated: volatile-only edits ⇒ MATERIAL=false), hourly update.yml w/ flavor +
      material gate (pins byte-identical)
- [x] Phase E cleanup: bridge tokens + heatColor + navlink deleted; grep sweeps zero-hit;
      build+tsc+lint green (fixed 8 react-hooks strict errors: setState-in-effect →
      render-adjust/useSyncExternalStore patterns; TrendChart ref→state)
- [x] Full verification: pytest 127 green; live-refresh proven end-to-end in dev (poll →
      interest-set fetch → atomic swap 50%→31% w/o reload + one aria-live announcement);
      all 10 routes error-free; ⌘K palette opens/filters/navigates; /h2h?a=br deep link;
      real-Chrome visual pass (found+fixed toLocaleString() locale hydration bug)
- [x] README rewrite + LICENSE (MIT) + web/README pointer
- [x] Commit in chunks; push (auto-deploys); verify prod; trigger update.yml full=true;
      capture docs/screenshots from prod + follow-up commit

### Phase 10 — Review
- Shipped in 5 commits (tests+ci, pipeline gate, web redesign, docs, screenshots).
- Prod verified: new design live at gaffer-wc26.web.app; heat tints render (old invalid
  hex-alpha bug visibly fixed); "LIVE · Xm ago" ticks; ⌘K palette; /h2h?a= deep links.
- CI green (first run), deploy green; update.yml full=true run green in 2m51s with
  "flavor: full" + MATERIAL=true → commit+deploy. Light hourly runs will skip commit/
  build/deploy on timestamp-only churn.
- Live client refresh proven in dev (5s poll): interest-set fetch, atomic swap w/o
  reload, exactly one aria-live announcement; prod polls at 120s w/ minute-bucket buster.
- Known limits: matches.json is still group-stage-only (knockout fixtures = existing
  Phase 8 item); OG artwork only recolored (full refresh deferred w/ declined SEO track).

## Phase 11 — Knockout-results ingestion ✅
Plan: ~/.claude/plans/yes-put-it-together-peppy-snowflake.md
- [x] Data layer: shootouts.csv download/load; world_cup_2026(stage=) group/KO split
- [x] sim/knockout.py: KOMatch/KnockoutState, standings, R32 anchor mapping (learns actual
      T-slots, overriding the buggy assign_thirds allocation), pens via shootouts,
      R16+ fixpoint mapping (fixture-reveals-winner)
- [x] simulate.py: ko= conditioning (slot occupant overrides, forced winners, coin for
      drawn-pending, partial-thirds LUT so pinned teams can't re-enter elsewhere)
- [x] pipeline.py: build_matches extraction + KO rows (played/upcoming/synthesized via
      KO_SCHEDULE), meta ko counts + stage, build_bracket decided flags + proj_winner
      override, scorecard group-only filter, current_standings KO-leak fix
- [x] web: types.ts, MatchesView round chips + KO cards + pens, dynamic eyebrow,
      BracketTree decided styling, HomeHero KO stat
- [x] tests: test_knockout.py (18), TestKnockoutConditioning (5), pipeline/data extensions
      — suite 127 → 161
- [x] Verification: pytest green; real-CSV 50k run (all 26 KO rows mapped incl. GER-PAR,
      zero warnings, eliminated teams exactly 0.0%, MATERIAL=true); web build + preview
      DOM checks on /matches + /bracket + home

### Phase 11 — Review
- Real data mapped perfectly first try: 32/32 R32 slots (T74=Paraguay — the pairing
  assign_thirds got wrong), 20 winners incl. 3 pens shootouts, 4 upcoming R16 + 2 QF
  fixtures. Post-conditioning odds: England 19.4%, France 17.9%, Argentina 14.4%.
- Tests caught a real conditioning bug: pinning one T-slot didn't exclude that group
  from the best-8 machinery, so a pinned loser could re-enter via another third-place
  slot (~1% of sims). Fixed with a partial-thirds LUT over the open slots only.
- Deviations from plan: none material. "(4–2 pens)" display became "won on pens"
  (shootouts.csv has no pen score — known in plan). Kalshi scorecard now feeds on
  group rows only (ET-inclusive KO scores would misgrade 90' markets).

## Phase 12 — Knockout scorecard (KXWCADVANCE) ✅
Goal: the "vs Market" ledger only covered group games. Add knockout ties too — outcome
is win/loss (who advances), not a 3-way moneyline.
- [x] Found the market: Kalshi runs per-tie "advances" markets under series KXWCADVANCE
      (2-way, "<Team> advances", settles on who progresses incl. ET + penalties). The
      KXWCGAME KO events ("Regulation Time Moneyline") settle on the 90' result — a pens
      win reads as TIE — so they are the WRONG market for grading; not used.
- [x] data/kalshi.py: parametrized fetch_events/fetch_candles over series; added
      refresh_advance()/load_advance() → kalshi_wcadvance.json (2-way legs). refresh()
      now skips "Regulation Time" events so a KO rematch of a group pairing can't
      overwrite the group entry under the same pair_key.
- [x] compare.py: knockout rows folded into the 3-way HOME/DRAW/AWAY shape with DRAW=0.
      GAFFER P(advance) = pHome + 0.5·pDraw (model's own coin-flip-pens convention).
      Outcome = who actually advanced (penWinner if pens). One accuracy + betting path
      covers both. meta gains nGroup/nKnockout.
- [x] pipeline.py: dropped group_only filter; refreshes + passes both caches.
- [x] web: types.ts (round/pens/penWinner on LedgerRow, nGroup/nKnockout on meta),
      ScorecardView round badge + "<Team> adv." label + reworded footnote/empty-state,
      accuracy/page.tsx lede.
- [x] Verify: full pipeline --download --scorecard --kalshi-refresh --sims 50000 → 50
      scored (44 group + 6 knockout), 0 no-market; tsc clean; /accuracy DOM shows KO
      rows w/ R16·QF badges, advance bars, correct bets. R32/early-R16 correctly
      noPrediction (KO rows only entered matches.json once played, pre-Phase-11).

### Phase 12 — Review
- Coverage note: only QF-onward KO ties (Jul 6+) have a logged pre-match prediction, so
  6 of 28 played KO ties score today; the rest are honest noPrediction (same as early
  group games). France–Spain SF settled on Kalshi but martj42 hasn't posted the score,
  so it's still "upcoming" in our data — will score on next refresh.
- New raw cache model/data/raw/kalshi_wcadvance.json is untracked; commit it alongside
  the code (parallels the tracked kalshi_wcgame.json).

## Phase 12b — Fix knockout prediction date-drift join ✅
Follow-up: my Phase 12 coverage note ("only QF-onward ties have a logged pre-match
prediction") was wrong. We DO have logged pre-match predictions for 8 R16/QF ties, but
2 R16 ties (Argentina–Egypt, Switzerland–Colombia) were silently dropped: the prediction
was logged under the SCHEDULED date 2026-07-06 while the tie kicked off 2026-07-07, so
compare's exact `date|home|away` join missed → counted as noPrediction.
- [x] compare.py: `_resolve_pred()` — exact key first, else fall back to the unique logged
      entry for the same unordered pairing within ±4 days, re-orienting probs if the tie
      was logged with the teams reversed. `_pair_index()`/`_daydiff()` helpers.
- [x] tests/test_compare.py (5): KO folds into advances row, group stays 3-way, date-drift
      join, reversed-orientation flip, beyond-tolerance rejected. Suite 161 → 166.
- [x] Regenerated: knockout scored 6 → 8 (44 group + 8 KO), noPrediction 50 → 48.
Still genuinely noPrediction: all 16 R32 ties (played before KO rows existed in
matches.json, pre-Phase-11) + France–Spain SF (settled on Kalshi, martj42 score pending).
