
# HTL - GitHub -> Cloudflare - No Terminal

This repo is ready for Cloudflare dashboard deploy.

## Option A: Cloudflare Worker (Recommended for 24/7 cron)

1. Dash.cloudflare.com -> Workers & Pages -> Create Application -> Create Worker -> Connect to GitHub -> Select edbrowncte/HTL
2. It will auto-detect worker.js
3. After first deploy, go to Worker Settings:
   - Variables -> KV Bindings: Add HTL_KV and LENGTHS_KV (create KVs first in KV section)
   - Variables -> Add Secrets: OANDA_TOKEN, CRON_SECRET, OANDA_ENV=practice
   - Triggers -> Add Cron */5 * * * *
4. Redeploy

## Option B: Cloudflare Pages (Frontend + Functions)

1. Dash.cloudflare.com -> Workers & Pages -> Create Application -> Pages -> Connect to GitHub -> edbrowncte/HTL
2. Build settings: Framework preset = None, Build command = (leave empty), Output directory = public
3. After deploy, add KV bindings in Pages Settings -> Functions -> KV Bindings
4. Add secrets in Pages Settings -> Environment variables (Encrypt)

## Files in this repo

- worker.js = Cloudflare Worker with scheduled cron (1 pair per run to stay under 10ms free)
- public/index.html = Your Complete-Eval app + hidden Admin panel (?admin=edbrown2024)
- public/admin.html = Standalone Admin Length Optimizer
- functions/api/ = Pages Functions alternative

## Your Admin Panel

Open https://YOUR_WORKER.workers.dev or https://YOUR_PAGES.pages.dev/?admin=edbrown2024

Scan Length Matrix -> Export JSON -> POST to /api/admin/lengths

## Make repo private after deploy

After Cloudflare connects, you can make GitHub repo private - Cloudflare keeps deploy key.
