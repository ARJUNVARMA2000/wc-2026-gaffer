# Deploying GAFFER

Monorepo: `model/` (Python pipeline) + `web/` (Next.js, static-exported). Hosted on
**Firebase Hosting** (GCP).

**Live site:** https://gaffer-wc26.web.app
**Project:** `agentic-ai-487000` · **Hosting site:** `gaffer-wc26`

## Manual deploy (works with your gcloud login — no extra setup)

```bash
# 1. refresh the numbers
cd model
PYTHONPATH=src python -m wc_model.pipeline --download --refresh-values --sims 50000
# 2. build the static site
cd ../web && npm run build
# 3. deploy  (uses gcloud Application Default Credentials)
cd .. && firebase deploy --only hosting:gaffer-wc26 --project agentic-ai-487000
```

The static site reads `web/public/data/*.json` at build time, so step 1 must run before
step 2. `next.config.ts` has `output: "export"`, producing `web/out/` which Firebase serves.

## Automated refresh + deploy (GitHub Action)

`.github/workflows/update.yml` runs every 6 hours: refresh data → commit → build → deploy.
The deploy step only runs if a `FIREBASE_SERVICE_ACCOUNT` secret is present. To enable it,
authorize a CI service account **once**:

```bash
PROJ=agentic-ai-487000
SA="gaffer-deployer@${PROJ}.iam.gserviceaccount.com"
gcloud iam service-accounts create gaffer-deployer --project=$PROJ --display-name="GAFFER CI deployer"
gcloud projects add-iam-policy-binding $PROJ \
  --member="serviceAccount:${SA}" --role="roles/firebasehosting.admin" --condition=None
gcloud iam service-accounts keys create key.json --iam-account=$SA
gh secret set FIREBASE_SERVICE_ACCOUNT < key.json    # repo: ARJUNVARMA2000/wc-2026-gaffer
rm key.json                                          # don't keep the key on disk
```

(Equivalent one-shot: `firebase init hosting:github` wires the same secret automatically.)

After that, the site refreshes itself every 6 hours. Trigger on demand:
GitHub → Actions → "Update forecast" → Run workflow.

## Cost

Free. Firebase Hosting Spark (free) tier: 10 GB storage, 360 MB/day transfer — far beyond a
small static site's needs. GitHub Actions: the job is ~1-2 min, 4×/day, well under the free
allowance. No paid tier required unless traffic gets large.

## Custom domain (optional)

Firebase console → Hosting → Add custom domain (e.g. a domain you own). Free SSL, ~15 min to
provision. The current `*.web.app` URL is permanent regardless.
