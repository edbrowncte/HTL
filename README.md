
# Cloudflare Worker - No Terminal Deploy - 10 min

You have Cloudflare, no local terminal - this is dashboard-only deploy.

## Step 1: Create KV namespaces (30 sec)
Dash.cloudflare.com -> Workers & Pages -> KV -> Create namespace
- Name: htl-cache -> Create
- Name: lengths-cache -> Create

## Step 2: Create Worker (2 min)
Workers & Pages -> Create Application -> Create Worker -> Name: htl-oracle -> Deploy
-> Edit Code -> Delete all -> Paste worker.js from this zip -> Save and Deploy

## Step 3: Bind KVs (1 min)
Worker -> Settings -> Variables -> KV Namespace Bindings -> Add binding
- Variable name: HTL_KV -> Select htl-cache
- Variable name: LENGTHS_KV -> Select lengths-cache
-> Save

## Step 4: Set Secrets (1 min) - No code exposure
Settings -> Variables -> Encrypt -> Add variable
- OANDA_TOKEN = your practice token
- CRON_SECRET = random 32 chars
- OANDA_ENV = practice
-> Save

## Step 5: Add Cron Trigger (30 sec) - 24/7 persistence
Settings -> Triggers -> Add Cron Trigger
- Cron: */5 * * * * (every 5 min)
-> Add

Now Worker runs every 5 min forever, 1 pair per run to stay under 10ms free limit.
Full 28 pairs cycle = 140 min. Upgrade to Workers Paid $5/mo for 50ms limit = 4 pairs per run = 35 min cycle.

## Step 6: Test
https://htl-oracle.YOUR_SUBDOMAIN.workers.dev/api/health -> {"ok":true}
https://htl-oracle.YOUR_SUBDOMAIN.workers.dev/api/trigger?secret=YOUR_CRON_SECRET -> triggers one pair now
https://htl-oracle.YOUR_SUBDOMAIN.workers.dev/api/global -> after few crons, shows schedules

## Step 7: Frontend - No Terminal - Drag & Drop
Workers & Pages -> Create Application -> Pages -> Upload assets
- Drag & drop Oanda-HTL-Complete-Eval-With-Admin-Length-Optimizer.html
- Rename to index.html
- Deploy -> you get https://your-frontend.pages.dev

In that HTML, change API URL:
const API = 'https://htl-oracle.YOUR_SUBDOMAIN.workers.dev';

## Step 8: Admin Lengths
Upload your optimal lengths JSON via:
curl -X POST https://htl-oracle.YOUR_SUBDOMAIN.workers.dev/api/admin/lengths?secret=YOUR_SECRET -d @htl-optimal-lengths.json
Or add endpoint in worker.js for admin upload (already in snippet file)

## 10ms limit handling
Free Workers = 10ms CPU per invocation. This worker processes 1 pair per cron (about 8ms).
Paid Workers $5/mo = 50ms CPU, can do 4 pairs per cron. Change scheduled() loop to process 4 pairs.

## NFT Gate (next)
Add Alchemy check in fetch() for /api/global:
const hasNFT = await fetch(`https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/isSpamContract?contractAddress=YOUR_CONTRACT`)...
But start open, add gate after first customer.

## Cost
- Workers Free: 100k req/day free, KV 1GB free
- Workers Paid $5/mo: 10M req, 50ms CPU, better for 28 pairs
- Cron Triggers free

Deploy in 10 min, no terminal.
