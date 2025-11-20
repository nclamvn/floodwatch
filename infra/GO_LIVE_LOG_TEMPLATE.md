# FloodWatch – Go-Live Log (Real-Time)

**Date:** ____ / **Start (H-0):** __:__ / **Driver:** ____ / **Scribe:** ____ / **Decider:** ____

## Step 0 – Preflight
- Command: `./infra/scripts/preflight.sh`
- Result: ✅ PASS / ❌ FAIL
- Notes (errors/warnings): ______________________________________
- Time: __:__

## Step 1 – Bring up stack
- Command: `./infra/scripts/prod_up.sh`
- Containers: api □ web □ db □ nginx □ certbot □
- Time: __:__

## Step 2 – Migrations
- Command: `docker compose -f docker-compose.prod.yml exec -T api alembic upgrade head`
- Head: `005_performance_indexes` ✅
- Time: __:__

## Step 3 – Seed API Key
- Output (key id / X-API-Key): ______________________
- Time: __:__

## Step 4 – Warm-up
- /health (5x): codes ______
- /lite (5x): codes ______
- /api/v1/reports (5x): codes ______
- Time: __:__

## Step 5 – Smoke tests (7/7 required)
- Command: `API_KEY=... ADMIN_TOKEN=... ./infra/scripts/smoke_test.sh`
- Result: __/7 PASS
- Issues & fixes: __________________________________
- Time: __:__

## Step 6 – Cron setup
- `crontab -l | grep floodwatch`: __________________________________
- Time: __:__

## Step 7 – Security headers
- HSTS / CSP / XFO / XCTO / Referrer-Policy: ✅/❌
- Time: __:__

## Gate Decision
- Proceed to public announce: ✅ / Hold & Fix: ❌
- Decider: ______   Time: __:__

## Announce
- Links shared: /map □ /lite □ /api-docs □
- Stakeholders notified: □
- Time: __:__

## Post-deploy checks (H+60')
- p95 latency: ____ ms  /  Error rate: ____ %
- Scraper last run: ____ min
- Status: 🟢 / 🟡 / 🔴
