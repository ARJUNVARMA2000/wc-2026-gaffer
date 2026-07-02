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
