# Deploying GAFFER

The repo is a monorepo: `model/` (Python pipeline) + `web/` (Next.js site). The site is
deployed on Vercel; a scheduled GitHub Action refreshes the data and pushes, which triggers
a Vercel rebuild.

## One-time: connect Vercel (free Hobby tier)

1. Go to https://vercel.com/new and **Import** the GitHub repo `wc-2026-gaffer`.
2. **Set Root Directory to `web`** (Vercel → project → Settings → General → Root Directory).
   This is the only non-default setting. Framework auto-detects as **Next.js**.
3. Build command `next build` and output are auto-detected. No env vars needed.
4. Deploy. Vercel will redeploy automatically on every push to `main`.

Why this works: the static site reads `web/public/data/*.json` at build time. The scheduled
job regenerates that JSON, commits it, and pushes — Vercel rebuilds with the fresh numbers.

## Automatic refresh (already wired)

`.github/workflows/update.yml` runs every 6 hours (and on manual dispatch):
- re-downloads the latest international results,
- re-scrapes Transfermarkt squad values,
- recomputes ratings + runs 50k simulations,
- commits the new JSON and pushes → Vercel redeploys.

It uses the built-in `GITHUB_TOKEN` (no secrets to configure). To run it on demand:
GitHub → Actions → "Update forecast" → Run workflow.

## Manual refresh / deploy

```bash
cd model
PYTHONPATH=src python -m wc_model.pipeline --download --refresh-values --sims 50000
cd ..
git commit -am "data: manual refresh" && git push   # triggers Vercel redeploy
```

## Cost

Free. Vercel Hobby covers a static Next.js site (non-commercial). GitHub Actions: the job is
~3 min, 4×/day ≈ 360 min/month — under the 2,000 free minutes for private repos (unlimited for
public). Only commercial use would require Vercel Pro ($20/mo).
