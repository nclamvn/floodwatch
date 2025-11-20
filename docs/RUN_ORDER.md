# FloodWatch GO-LIVE RUN ORDER v1.1.1

**🎯 One-page timeline for 60-90 minute cutover**

> 📊 **Visual Aids Available:**
> - **Gantt Timeline:** `docs/FloodWatch_Deployment_Gantt.html` (print-ready, color-coded)
> - **Pre-Deployment Checklist:** `docs/FloodWatch_PreDeployment_Checklist.html` (24 items, print & sign)
> - Open in browser → Cmd/Ctrl+P → Save as PDF

---

## 📋 ROLES & ROSTER

**Assign before T-15':**

| Role | Name | Responsibility |
|------|------|----------------|
| **Decider** | __________ | GO/NO-GO decisions, rollback authorization |
| **Driver** | __________ | Execute commands, perform deployments |
| **Scribe** | __________ | Log timeline, record decisions, document issues |
| **Observer** | __________ | Watch metrics, alert on anomalies, monitor logs |

**War-room channels:**
- Video: Zoom/Google Meet (link: _____________)
- Chat: Slack #floodwatch-go-live (or Telegram group)
- Status doc: Google Doc (link: _____________)

---

## T-15' → FREEZE

**Actions:**
- [ ] **Code freeze:** No merges to `main`, no infra changes
- [ ] **Package freeze:** No `apt/yum/brew` installs
- [ ] **Open war-room:** All roles join video + chat
- [ ] **Pre-announce:** Post to internal channels:
  ```
  🚀 FloodWatch GO-LIVE starting in 15 minutes
  Expected downtime: 5-10 minutes during deployment
  War-room: [link]
  ```

**Scribe:** Log start time: _____:_____

---

## T-10' → PREFLIGHT CHECKS

**Driver executes:**

```bash
cd /opt/floodwatch
./infra/scripts/preflight.sh
```

**Expected output:**
```
✓ Disk usage: <80%
✓ Inode usage: <80%
✓ Available memory: >512MB
✓ Docker installed
✓ Docker Compose v2 installed
✓ Port 80/443 available
✓ Required directories writable
✓ .env.prod validated
✓ All pre-flight checks passed!
```

**If any check FAILS:**
- 🔴 **STOP deployment**
- Observer investigates issue
- Decider decides: fix now (if <5min) or postpone
- Scribe logs issue: _____________

**Checkpoint T-10':** _____:_____ ✅ / ❌

---

## T-5' → BACKUP

**Driver executes:**

```bash
# Create pre-deployment backup (30-60 seconds)
./infra/scripts/prod_backup.sh

# Verify backup created
ls -lh infra/backups/ | tail -1
```

**Scribe logs backup file:** `fw_backup_______________.sql.gz`

**Checkpoint T-5':** _____:_____ ✅

---

## T-0' → DEPLOY

**Driver executes:**

```bash
# 1. Start deployment script
./infra/scripts/prod_up.sh
```

**Observer watches:**
- Container pull progress
- No error messages in terminal

**Driver continues:**

```bash
# 2. Verify all containers up
docker compose -f docker-compose.prod.yml ps

# Expected output: All services show "Up"
```

**If containers fail to start:**
- 🔴 Check logs: `docker compose -f docker-compose.prod.yml logs api`
- Decider evaluates: retry or rollback

**Driver continues:**

```bash
# 3. Check disk space before migration
df -h / | awk 'NR==2 {print "Disk: "$5}'
df -i / | awk 'NR==2 {print "Inode: "$5}'

# Proceed only if both <80%

# 4. Run database migrations
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

**Expected output:**
```
INFO  [alembic.runtime.migration] Running upgrade 004 -> 005, performance_indexes
INFO  [alembic.runtime.migration] Upgrade complete
```

**If migration fails:**
- 🔴 **STOP immediately**
- Observer checks DB connection
- Decider evaluates: rollback migration or full rollback

**Checkpoint T+5':** _____:_____ ✅ / ❌

---

## T+5' → WARM-UP CACHE

**Driver executes:**

```bash
# Send 5 hits to key endpoints to prime cache
for i in {1..5}; do
  curl -sS https://floodwatch.vn/health > /dev/null
  curl -sS https://floodwatch.vn/lite > /dev/null
  sleep 1
done

# Test critical endpoints respond
for path in /health /lite /api-docs /ops; do
  echo -n "Testing $path... "
  curl -sI https://floodwatch.vn$path | grep "HTTP.*200" && echo "✓" || echo "✗"
done
```

**Expected:** All endpoints return 200 OK

**Checkpoint T+7':** _____:_____ ✅

---

## T+10' → AUTOMATED SMOKE TEST

**Driver executes:**

```bash
# Set credentials (prepare in advance!)
export API_KEY="__REPLACE_WITH_REAL_KEY__"
export ADMIN_TOKEN="__REPLACE_WITH_REAL_ADMIN_TOKEN__"

# Run automated smoke test
./infra/scripts/smoke_test.sh
```

**Expected output:**
```
[1/7] Health Endpoint ✓ PASS
[2/7] Security Headers ✓ PASS (4/4 found)
[3/7] Public API Endpoint ✓ PASS
[4/7] Lite Mode ✓ PASS
[5/7] CSV Export ✓ PASS
[6/7] Ops Dashboard ✓ PASS
[7/7] Metrics Endpoint ✓ PASS

Results: 7 passed, 0 failed
✓ All smoke tests passed!
```

**If 1 test fails:**
- 🟡 Observer investigates specific endpoint
- Decider evaluates: acceptable or blocker

**If >1 tests fail:**
- 🔴 **Rollback decision point**
- Decider chooses:
  - **Option D:** Emergency Lite-only mode (2 min, 60% capacity)
  - **Option A:** Rollback Docker images (3 min)
  - **Option B:** Rollback migration (5 min)

**Checkpoint T+12':** _____:_____ ✅ / ❌

---

## T+15' → SECURITY HEADERS VERIFICATION

**Observer checks manually:**

```bash
curl -I https://floodwatch.vn | grep -E "Strict-Transport|Content-Security|X-Frame|X-Content-Type"
```

**Expected headers present:**
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: default-src 'self'...`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`

**If headers missing:**

```bash
# Driver applies security headers config
docker compose -f docker-compose.prod.yml exec nginx bash -c "
ln -sf /etc/nginx/conf.d/security_headers.conf /etc/nginx/conf.d/security_headers.conf
nginx -s reload
"
```

**Checkpoint T+17':** _____:_____ ✅

---

## T+20' → CRON & MONITORING SETUP

### Cron Jobs

**Driver executes on host:**

```bash
# Check current crontab
crontab -l | grep floodwatch || echo "No existing cron jobs"

# Edit crontab
crontab -e
```

**Add these lines (CRON_TZ already included):**

```cron
# Set timezone for Vietnam
CRON_TZ=Asia/Ho_Chi_Minh

# KTTV scraper (every hour at :05)
5 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/kttv_scraper.py >> logs/kttv.log 2>&1

# Roads press watch (every hour at :35)
35 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/roads_press_watch.py >> logs/roads.log 2>&1

# Alerts dispatcher (every 2 minutes)
*/2 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/alerts_dispatcher.py >> logs/alerts.log 2>&1

# Daily snapshot (23:55 every day)
55 23 * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/daily_snapshot.py >> logs/snapshot.log 2>&1
```

**Verify:**

```bash
crontab -l | grep floodwatch
```

### Prometheus (if using)

**Driver executes:**

```bash
# Start Prometheus container or service
docker run -d --name prometheus -p 9090:9090 \
  -v $PWD/infra/prometheus:/etc/prometheus \
  prom/prometheus

# Check target status
curl -s http://localhost:9090/api/v1/targets | grep '"health":"up"'
```

**Observer:** Open http://localhost:9090/targets → verify `floodwatch-api` is **UP**

### Uptime Monitoring

**Scribe:** Add to UptimeRobot / Pingdom / StatusCake:
- URL: `https://floodwatch.vn/health`
- Interval: 60 seconds
- Alert if down >2 minutes

**Checkpoint T+25':** _____:_____ ✅

---

## T+30' → MINI LOAD TEST (Optional, if infrastructure idle)

**Driver executes:**

```bash
# Light smoke test with k6 (30 seconds, 5 VUs)
BASE_URL=https://api.floodwatch.vn API_KEY="__KEY__" \
k6 run ops/loadtest/k6_smoke_test.js
```

**Observer watches output:**

```
✓ status is 200
✓ response time < 200ms

checks.........................: 100.00% ✓ 150  ✗ 0
http_req_duration..............: avg=85ms p95=120ms p99=180ms
http_req_failed................: 0.00%   ✓ 0    ✗ 150
```

**Success criteria:**
- ✅ p95 latency **< 200ms**
- ✅ Error rate **< 5%**

**If p95 > 200ms or errors > 5%:**
- 🟡 Observer checks API logs for slow queries
- Decider evaluates: acceptable or switch to Lite-only

**Checkpoint T+32':** _____:_____ ✅ / ⚠️ skipped

---

## T+40' → PARTNER COMMUNICATION

**Scribe sends to partners:**

**Email template:**

```
Subject: FloodWatch v4 GO-LIVE Complete - API Access

Hi [Partner],

FloodWatch v4 is now live with improved performance and new features.

🔗 Access URLs:
- Full map: https://floodwatch.vn/map
- Lite mode (low bandwidth): https://floodwatch.vn/lite
- API docs: https://floodwatch.vn/api-docs

🔑 Your API Key: [KEY]

📊 What's New:
- 82% faster query performance
- PII auto-scrubbing (phone/email masked)
- Mobile-optimized UI
- Daily PDF snapshots
- Prometheus metrics for monitoring

📱 For field teams in low-bandwidth areas, recommend /lite mode (<50 KB/page).

Support: ops@floodwatch.vn

--FloodWatch Ops Team
```

**Internal announcement (Slack/Telegram):**

```
🚀 FloodWatch v4 GO-LIVE COMPLETE

Deployment: ✅ Success
Duration: [__] minutes (target: 60-90min)
Status: All systems operational

📊 Key Links:
- Ops Dashboard: https://floodwatch.vn/ops?token=[ADMIN_TOKEN]
- Metrics: https://floodwatch.vn/metrics?token=[ADMIN_TOKEN]
- War-room Checklist: docs/WAR_ROOM_CHECKLIST.md

🔄 Next Steps:
- Hourly health checks for 24h (see war-room roster)
- Monitor metrics for anomalies
- RCA if any issues encountered

War-room stays open for next 2 hours.
```

**Checkpoint T+45':** _____:_____ ✅

---

## T+60' → WAR-ROOM HANDOVER

**Scribe finalizes:**

- [ ] **War-room roster** assigned (3 shifts: A/B/C)
  - Shift A (06:00-14:00): __________
  - Shift B (14:00-22:00): __________
  - Shift C (22:00-06:00): __________

- [ ] **Critical links shared:**
  - `/ops` dashboard with ADMIN_TOKEN
  - `/metrics` endpoint
  - `docs/WAR_ROOM_CHECKLIST.md`
  - `infra/QUICK_REFERENCE.md`
  - `infra/ROLLBACK_PLAYBOOK.md`

- [ ] **First hourly check scheduled:**
  - Time: _____:_____
  - Assigned to: __________

- [ ] **Escalation paths confirmed:**
  - L1 (on-call): __________
  - L2 (senior eng): __________
  - L3 (decider): __________

**Checkpoint T+65':** _____:_____ ✅

---

## 24-HOUR SIGNAL DASHBOARD

**Observer monitors these signals:**

| Signal | 🟢 Green | 🟡 Yellow (escalate L2) | 🔴 Red (rollback) |
|--------|----------|-------------------------|-------------------|
| **API p95** | ≤150ms | 150-300ms (15min) | >300ms (15min) |
| **Error rate** | <1% | 1-5% (10min) | >5% (10min) |
| **Scraper lag** | <60min | 60-120min | >120min |
| **5xx errors/min** | 0-2 | 3-10 (10min) | >10 (5min) |
| **Disk usage** | <70% | 70-85% | >85% |
| **Memory usage** | <70% | 70-85% | >85% |
| **DB connections** | <50 | 50-80 | >80 (pool limit: 100) |

**Quick diagnostic commands:**

```bash
# Recent errors (last 10 min)
docker compose -f docker-compose.prod.yml logs --since 10m api | grep -Ei "ERROR|CRITICAL" | tail -20

# Scraper freshness
docker compose -f docker-compose.prod.yml logs --since 2h api | grep -E "kttv|roads" | tail -50

# Prometheus metrics snapshot
curl -s "https://floodwatch.vn/metrics?token=__ADMIN__" | egrep "http_requests_total|http_request_duration|cron_runs_total"

# Database health
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;
"
```

---

## 6 COMMON ISSUES & 1-MINUTE FIXES

### 1. CSP blocks Mapbox tiles / Cloudinary images

**Symptom:** Browser console shows `Content-Security-Policy` errors

**Fix:**
```bash
docker compose -f docker-compose.prod.yml exec nginx vi /etc/nginx/conf.d/security_headers.conf
# Edit CSP header: add domains to img-src and connect-src
# img-src 'self' data: https: *.mapbox.com *.cloudinary.com
# connect-src 'self' https: *.mapbox.com api.cloudinary.com
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 2. CORS fails for API requests

**Symptom:** `Access-Control-Allow-Origin` errors in browser

**Fix:**
```bash
# Check .env.prod CORS_ORIGINS matches actual domain
grep CORS_ORIGINS /opt/floodwatch/.env.prod
# Should be: CORS_ORIGINS=https://floodwatch.vn,https://api.floodwatch.vn
# Edit if needed, then restart API
docker compose -f docker-compose.prod.yml restart api
```

### 3. CSV export contains PII (not scrubbed)

**Symptom:** Phone numbers visible in CSV downloads

**Fix:**
```bash
# Verify PII middleware applied to /reports/export route
docker compose -f docker-compose.prod.yml logs api | grep "PII scrubbing"
# If missing, check app/main.py route has scrubbing middleware
# Restart API after fix
docker compose -f docker-compose.prod.yml restart api
```

### 4. SSL certificate fails (first-time deployment)

**Symptom:** HTTPS not working, browser shows certificate error

**Fix:**
```bash
# Ensure port 80 open and DNS propagated
curl http://floodwatch.vn/.well-known/acme-challenge/test

# Run Certbot
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d floodwatch.vn -d api.floodwatch.vn \
  --email ops@floodwatch.vn --agree-tos

# Reload Nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 5. WeasyPrint missing dependencies (PDF snapshot fails)

**Symptom:** Daily snapshot creates HTML but not PDF

**Fix (temporary):**
```bash
# Use HTML fallback (already implemented in daily_snapshot.py)
# Users can open HTML in browser and "Print to PDF"
# Fix later: install WeasyPrint dependencies
# apt-get install python3-cffi python3-brotli libpango-1.0-0 libpangocairo-1.0-0
```

### 6. Traffic spike causing high p95 latency

**Symptom:** p95 latency spikes >300ms under load

**Fix:**
```bash
# Option 1: Enable Lite-only mode (reduces load)
docker compose -f docker-compose.prod.yml exec nginx bash -c "
cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
location = /map { return 302 /lite; }
EOF
nginx -s reload
"

# Option 2: Increase Nginx rate limit burst temporarily
docker compose -f docker-compose.prod.yml exec nginx vi /etc/nginx/conf.d/ratelimit.conf
# Change: limit_req_zone ... burst=20 → burst=50
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Monitor p95, revert when stable
```

---

## FINAL CHECKLIST

**Decider sign-off:**

- [ ] All smoke tests passed
- [ ] Security headers verified
- [ ] Cron jobs configured
- [ ] Monitoring active
- [ ] Partners notified
- [ ] War-room handed over
- [ ] No 🔴 Red signals in dashboard
- [ ] Rollback plan reviewed and ready

**GO-LIVE COMPLETE:** _____:_____ ✅

**Total duration:** _____ minutes (target: 60-90min)

---

## ROLLBACK DECISION TREE

**If 🔴 Red signal appears:**

```
Is error rate >5% for 10min OR p95 >500ms for 15min?
  ├─ YES → Immediate rollback
  │   ├─ Code bug, no DB changes? → Option A (3min)
  │   ├─ Migration issue? → Option B (5min)
  │   ├─ Data corruption? → Option C (8min)
  │   └─ Full meltdown? → Option D Lite-only (2min)
  │
  └─ NO → Investigate further
      ├─ Isolated endpoint issue? → Fix + monitor
      ├─ External dependency (Mapbox/KTTV)? → Fallback mode
      └─ Resource constraint? → Scale or Lite-only
```

**Rollback authority:** Decider only (no unilateral rollbacks)

**See:** `infra/ROLLBACK_PLAYBOOK.md` for detailed procedures

---

## POST-GO-LIVE SCHEDULE

**First 24 hours:**
- Hourly health checks (use `docs/WAR_ROOM_CHECKLIST.md`)
- Scribe logs metrics every 2 hours
- Decider on-call for rollback decisions

**Days 2-5:**
- Health checks every 4 hours
- Daily standup: review metrics, discuss issues

**Day 6+:**
- Resume normal on-call rotation
- Weekly metrics review
- RCA for any incidents

---

## RELATED DOCUMENTS

- **War-room Checklist:** `docs/WAR_ROOM_CHECKLIST.md`
- **Rollback Playbook:** `infra/ROLLBACK_PLAYBOOK.md`
- **Quick Reference:** `infra/QUICK_REFERENCE.md`
- **Rollback Drill:** `docs/DRILL_PLAYBOOK.md`
- **Full GO-LIVE Checklist:** `infra/GO_LIVE_CHECKLIST.md`

---

**🚀 FloodWatch v4 GO-LIVE RUN ORDER v1.1.1**

**Last updated:** 2025-11-01
**Next review:** After first production deployment
**Owner:** Ops Team

---

*Print this page and keep it next to your keyboard during cutover* 📄🖨️
