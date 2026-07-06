# Lessons

- **Never round-trip source files through PowerShell 5.1 text cmdlets.**
  `Get-Content -Raw` (no -Encoding) reads UTF-8 files as ANSI/cp1252 and
  `Set-Content -Encoding utf8` writes BOM — together they mojibake every
  non-ASCII char (— → â€”, · → Â·). Use the Edit tool for source edits; if a
  scripted sweep is unavoidable, use Python/Node with explicit utf-8.
  Repair recipe: strip ﻿, then text.encode('cp1252').decode('utf-8').
- **PS 5.1 `ConvertTo-Json` wraps arrays** from ConvertFrom-Json as
  `{"value": [...], "Count": n}` — corrupts JSON files. Use Node/Python for
  JSON edits.
- **`toLocaleString()` without a locale is a hydration bug** in SSR/SSG apps:
  server formats with the OS locale (en-IN → "2,00,000"), browser with the
  user's. Always pass an explicit locale ("en-US") in anything server-rendered.
- **This machine's headless preview browser produces no frames**: rAF never
  fires, IntersectionObserver never fires, document.hidden=true, focus events
  don't dispatch. Framer animations/whileInView/screenshots can't be verified
  there — verify logic via DOM/a11y/network in preview, visuals via
  claude-in-chrome (real Chrome).
- **Agent-tool output files (tasks/*.output) are 0 bytes** — only Workflow
  results persist to disk. Make agent prompts self-contained; don't rely on
  passing another agent's output file path.
- **Learn the bracket from data, don't trust modelled allocations.** FIFA's
  third-place → R32 assignment has degrees of freedom our assign_thirds solver
  resolves differently than FIFA did (predicted GER–BIH, reality GER–PAR).
  Anything reconstructable from played results (pairings, standings, winners)
  should be ingested, with the model only filling what reality hasn't decided.
- **When conditioning a Monte Carlo on partial reality, remove the conditioned
  entity from every OTHER random pathway too.** Pinning Sweden into T74 without
  excluding group F's third from the best-8 assignment let "eliminated" Sweden
  re-enter through T77/T85 in ~1% of sims. Grep for every place the entity can
  be sampled, not just the slot you're forcing.
- **martj42 dataset semantics**: KO fixture rows appear (NA scores) as soon as
  pairings are known and carry real date/city; scores include extra time but
  NOT penalties — drawn KO matches are decided in the separate shootouts.csv
  (winner only, no pen score). Any per-match grading vs 90-minute markets must
  exclude KO rows (an ET win looks like a 90' win in the data).
- **Generic frame-wide filters rot when the data grows**: current_standings and
  matches.json both iterated "all 2026 WC rows" assuming group-stage-only; the
  first played KO row would have polluted group standings. Route every consumer
  through one stage-split helper (world_cup_2026(stage=)) instead of local
  same-group checks.
