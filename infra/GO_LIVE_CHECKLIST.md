# FloodWatch GO-LIVE CHECKLIST

**Ngày triển khai:** _____________
**Người thực hiện:** _____________
**Giờ bắt đầu (H-0):** _____________

> 💡 **QUICK START:**
> - **Execute:** `docs/RUN_ORDER.md` (1-page timeline, optimized for execution)
> - **Visualize:** `docs/FloodWatch_Deployment_Gantt.html` (interactive timeline, print-ready)
> - **Pre-check:** `docs/FloodWatch_PreDeployment_Checklist.html` (24 items, fillable PDF)
> - This document: Comprehensive planning reference

---

## PRE-DEPLOYMENT (D-1 đến H-1)

### Môi trường
- [ ] `.env.prod` đã điền đầy đủ:
  - [ ] `ADMIN_TOKEN` (minimum 32 chars)
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `CORS_ORIGINS` (domain chính thức)
  - [ ] `NEXT_PUBLIC_MAPBOX_TOKEN`
  - [ ] `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - [ ] `TELEGRAM_BOT_TOKEN` (optional)
  - [ ] `WEBHOOK_SECRET` cho alerts

### Infrastructure
- [ ] DNS đã trỏ đến IP máy chủ
- [ ] Port 80/443 đã mở (firewall rules)
- [ ] SSL certificate ready (Let's Encrypt hoặc existing)
- [ ] Quyền ghi cho directories:
  - [ ] `infra/backups/`
  - [ ] `logs/`
  - [ ] `ops/snapshots/`

### Docker Images
- [ ] Build và tag images:
  ```bash
  docker build -t floodwatch-api:v4-prod ./apps/api
  docker build -t floodwatch-web:v4-prod ./apps/web
  ```
- [ ] Test images locally trước khi push

### Optional
- [ ] WeasyPrint dependencies installed (cho PDF snapshots)
- [ ] k6 installed (cho load testing)

---

## DEPLOYMENT (H-0 → H+20')

### 0. Pre-flight checks
- [ ] Run pre-flight validation:
  ```bash
  cd /opt/floodwatch
  ./infra/scripts/preflight.sh
  ```
  **Result:** All checks passed ✅ / Issues: _______________

### 1. Deploy containers
- [ ] Run deployment script:
  ```bash
  cd /opt/floodwatch
  ./infra/scripts/prod_up.sh
  ```
  **Giờ bắt đầu:** _____:_____

- [ ] Verify containers running:
  ```bash
  docker compose -f docker-compose.prod.yml ps
  ```
  **Kết quả:** All containers "Up" ✅ / Issues: _______________

- [ ] Warm-up cache (5 hits to prime the application):
  ```bash
  for i in {1..5}; do
    curl -sS https://floodwatch.vn/health > /dev/null
    curl -sS https://floodwatch.vn/lite > /dev/null
    sleep 1
  done
  ```
  **Cache warmed:** ✅

### 2. Database migrations
- [ ] Check disk space before migration:
  ```bash
  df -h / | awk 'NR==2 {print "Disk usage: "$5}'
  df -i / | awk 'NR==2 {print "Inode usage: "$5}'
  ```
  **Disk/Inode:** _____% / _____% (proceed if <80%) ✅

- [ ] Run migrations:
  ```bash
  docker compose -f docker-compose.prod.yml exec api alembic upgrade head
  ```
  **Migration đến:** 005_performance_indexes ✅ / Error: _______________

- [ ] Verify indexes created:
  ```bash
  docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "\di"
  ```
  **5 indexes:** idx_reports_prov_type_created, idx_reports_verified, idx_reports_trust_score, idx_road_events_prov_status, idx_reports_export ✅

### 3. Seed data
- [ ] Generate API keys:
  ```bash
  docker compose -f docker-compose.prod.yml exec api python ops/scripts/seed_api_keys.py
  ```
  **API keys generated:** _____________

### 4. SSL Certificate (first time)
- [ ] Request Let's Encrypt certificate:
  ```bash
  docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot -w /var/www/certbot \
    -d floodwatch.vn -d api.floodwatch.vn \
    --email ops@floodwatch.vn --agree-tos
  ```
  **Certificate obtained:** ✅ / Skip (already exists): ☐

- [ ] Reload Nginx:
  ```bash
  docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
  ```

**Deployment hoàn thành:** _____:_____ (Thời gian: _____ phút)

---

## SMOKE TEST (H+20' → H+35')

**Domain:** https://floodwatch.vn
**API domain:** https://api.floodwatch.vn

### Automated smoke test (recommended)
```bash
export API_KEY="YOUR_API_KEY"
export ADMIN_TOKEN="YOUR_ADMIN_TOKEN"
./infra/scripts/smoke_test.sh
```
**All tests passed:** ✅ / Manual tests required: ☐

---

### Manual tests (if automated script unavailable)

### Test 1: Health check
```bash
curl -I https://floodwatch.vn/health
```
- [ ] **Status:** 200 OK
- [ ] **Response body:** `{"status":"ok","database":"connected"}`
- **Kết quả:** ✅ / ❌ _____________

### Test 2: Security headers
```bash
curl -I https://floodwatch.vn
```
- [ ] **CORS:** `Access-Control-Allow-Origin` present
- [ ] **HSTS:** `Strict-Transport-Security` present
- [ ] **CSP:** `Content-Security-Policy` present
- [ ] **X-Frame-Options:** `SAMEORIGIN`
- [ ] **X-Content-Type-Options:** `nosniff`
- **Kết quả:** ✅ / ❌ _____________

### Test 3: Public API with key
```bash
curl -H "X-API-Key: YOUR_KEY" "https://api.floodwatch.vn/api/v1/reports?limit=5"
```
- [ ] **Status:** 200 OK
- [ ] **Response:** JSON with `data` array
- [ ] **PII scrubbed:** Phone numbers show as `***-****-***`
- **Kết quả:** ✅ / ❌ _____________

### Test 3: Lite mode
```bash
curl -I https://floodwatch.vn/lite
```
- [ ] **Status:** 200 OK
- [ ] **Content-Type:** text/html
- **Kết quả:** ✅ / ❌ _____________

### Test 4: CSV export
```bash
curl -s "https://floodwatch.vn/reports/export?format=csv&since=24h" | head -5
```
- [ ] **Status:** 200 OK
- [ ] **Headers present:** id,created_at,type,province...
- [ ] **PII scrubbed in data**
- **Kết quả:** ✅ / ❌ _____________

### Test 5: Ops dashboard (admin)
```bash
curl -I "https://floodwatch.vn/ops?token=YOUR_ADMIN_TOKEN"
```
- [ ] **Status:** 200 OK
- [ ] **HTML table visible** (check in browser)
- **Kết quả:** ✅ / ❌ _____________

### Test 6: Metrics endpoint
```bash
curl -s "https://floodwatch.vn/metrics?token=YOUR_ADMIN_TOKEN" | head -20
```
- [ ] **Status:** 200 OK
- [ ] **Contains:** `http_requests_total`, `reports_total`
- **Kết quả:** ✅ / ❌ _____________

**Smoke test hoàn thành:** _____:_____ ✅ / Issues: _______________

---

## CRON JOBS SETUP (H+35' → H+45')

### Method 1: Docker exec crontab
```bash
docker compose -f docker-compose.prod.yml exec api crontab -e
```

### Method 2: Host crontab (recommended)
```bash
crontab -e
```

**Add these lines:**
```cron
# Set timezone (critical for scheduled tasks)
CRON_TZ=Asia/Ho_Chi_Minh

# KTTV scraper (mỗi giờ lúc :05)
5 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/kttv_scraper.py >> logs/kttv.log 2>&1

# Roads press watch (mỗi giờ lúc :35)
35 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/roads_press_watch.py >> logs/roads.log 2>&1

# Alerts dispatcher (mỗi 2 phút)
*/2 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/alerts_dispatcher.py >> logs/alerts.log 2>&1

# Daily snapshot (23:55 hàng ngày)
55 23 * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/daily_snapshot.py >> logs/snapshot.log 2>&1
```

**Checklist:**
- [ ] KTTV scraper configured
- [ ] Roads press watch configured
- [ ] Alerts dispatcher configured
- [ ] Daily snapshot configured

**Verify cron:**
```bash
crontab -l | grep floodwatch
```

**Cron setup hoàn thành:** _____:_____ ✅

---

## MONITORING SETUP (H+45' → H+60')

### Prometheus
- [ ] Copy example config:
  ```bash
  cp infra/prometheus/prometheus.yml.example infra/prometheus/prometheus.yml
  cp infra/prometheus/alerts.yml.example infra/prometheus/alerts.yml
  ```

- [ ] Edit `prometheus.yml`:
  - Replace `REPLACE_WITH_ADMIN_TOKEN` with real token
  - Update `targets: ['floodwatch.vn:443']`

- [ ] Start Prometheus:
  ```bash
  # Option 1: Docker
  docker run -d -p 9090:9090 \
    -v $PWD/infra/prometheus:/etc/prometheus \
    prom/prometheus

  # Option 2: System service (if installed)
  sudo systemctl start prometheus
  ```

- [ ] Verify: http://localhost:9090/targets
  - [ ] `floodwatch-api` target UP ✅

### Uptime Monitoring
- [ ] Add endpoint to uptime service:
  - URL: `https://floodwatch.vn/health`
  - Interval: 60s
  - Alert if down >2 minutes

- [ ] Service used: _______________

### Log Collection
- [ ] Tail logs in tmux/screen:
  ```bash
  # API logs
  docker compose -f docker-compose.prod.yml logs -f --tail=100 api

  # Nginx logs
  docker compose -f docker-compose.prod.yml logs -f --tail=100 nginx
  ```

**Monitoring hoàn thành:** _____:_____ ✅

---

## LOAD TEST (H+60' → H+75')

**⚠️ Chỉ chạy nếu đã có traffic nhẹ hoặc staging environment**

```bash
# Smoke test (safe, 5 VUs)
BASE_URL=https://api.floodwatch.vn API_KEY=YOUR_KEY \
k6 run ops/loadtest/k6_smoke_test.js
```

**Kết quả:**
- p95 latency: _____ ms (target: <200ms)
- Error rate: _____ % (target: <5%)
- Status: ✅ PASS / ❌ FAIL

**Nếu PASS, chạy load test nhẹ:**
```bash
# 10 RPS for 1 minute (very light)
BASE_URL=https://api.floodwatch.vn API_KEY=YOUR_KEY \
k6 run --vus 10 --duration 1m ops/loadtest/k6_reports_scenario.js
```

**Kết quả:**
- p95 latency: _____ ms (target: <150ms)
- Error rate: _____ % (target: <1%)
- Status: ✅ PASS / ❌ FAIL

**Load test hoàn thành:** _____:_____ ✅ / Skipped: ☐

---

## CÔNG BỐ (H+75' → H+90')

### Public Links
- [ ] Map view: https://floodwatch.vn/map
- [ ] Lite mode: https://floodwatch.vn/lite
- [ ] API docs: https://floodwatch.vn/api-docs

### Partner Communication
- [ ] Share API keys với đối tác
- [ ] Send API documentation
- [ ] Provide `/lite` link for low-bandwidth users

### Internal Documentation
- [ ] Share Ops dashboard link: https://floodwatch.vn/ops?token=...
- [ ] Share Metrics link: https://floodwatch.vn/metrics?token=...
- [ ] Distribute War-room checklist to team

### Public Announcement
- [ ] Post helpcard to community channels
- [ ] Notify emergency response teams
- [ ] Social media announcement (if applicable)

**Công bố hoàn thành:** _____:_____ ✅

**TOTAL GO-LIVE TIME:** _____ phút

---

## POST-DEPLOYMENT VERIFICATION (H+90' → H+120')

### Check Metrics (every hour for first 24h)

**Lần 1 - H+2h:**
- API p95: _____ ms (target: ≤150ms)
- Error rate: _____ % (target: <1%)
- New reports (2h): _____ (expected: varies)
- Scraper last run: _____ minutes ago (target: <60min)
- Status: 🟢 / 🟡 / 🔴

**Lần 2 - H+4h:**
- API p95: _____ ms
- Error rate: _____ %
- New reports (2h): _____
- Scraper last run: _____ minutes ago
- Status: 🟢 / 🟡 / 🔴

**Lần 3 - H+8h:**
- API p95: _____ ms
- Error rate: _____ %
- New reports (2h): _____
- Scraper last run: _____ minutes ago
- Status: 🟢 / 🟡 / 🔴

### Check Logs
```bash
# Any errors in last hour?
docker compose -f docker-compose.prod.yml logs --since 1h api | grep ERROR

# Scraper success?
docker compose -f docker-compose.prod.yml logs --since 1h api | grep kttv_scraper

# Webhook deliveries?
docker compose -f docker-compose.prod.yml logs --since 1h api | grep alerts_dispatcher
```

### Database Health
```bash
# Connection count
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "SELECT count(*) FROM pg_stat_activity;"

# Slow queries
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "SELECT query, mean_exec_time FROM pg_stat_statements WHERE mean_exec_time > 100 ORDER BY mean_exec_time DESC LIMIT 5;"
```

---

## ROLLBACK TRIGGER CRITERIA

**Immediate rollback nếu:**
- [ ] Error rate >5% trong 10 phút
- [ ] p95 latency >500ms trong 15 phút
- [ ] Database connection failures
- [ ] KTTV scraper failed 3 lần liên tiếp
- [ ] Alerts dispatcher down >30 phút

**Rollback executed:** ☐ No / ☐ Yes at _____:_____

**Rollback reason:** _______________________________________________

---

## WAR-ROOM ROSTER (5 ngày đầu)

| Ca | Giờ | Người trực | Contact |
|----|-----|------------|---------|
| A | 06:00-14:00 | __________ | _______ |
| B | 14:00-22:00 | __________ | _______ |
| C | 22:00-06:00 | __________ | _______ |

**Handover location:** `docs/WAR_ROOM_CHECKLIST.md`

---

## SIGN-OFF

**Go-live completed:** ☐ Yes ☐ No ☐ Partial

**Issues encountered:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Follow-up actions:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Signed by:** _______________ **Date:** ___/___/___

**Approved by:** _______________ **Date:** ___/___/___

---

## QUICK COMMANDS REFERENCE

```bash
# View logs
./infra/scripts/prod_logs.sh api
./infra/scripts/prod_logs.sh nginx

# Restart service
docker compose -f docker-compose.prod.yml restart api

# Run backup
./infra/scripts/prod_backup.sh

# Check database
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch

# Test scraper manually
docker compose -f docker-compose.prod.yml exec api python ops/cron/kttv_scraper.py

# Check metrics
curl -s "https://floodwatch.vn/metrics?token=ADMIN_TOKEN" | grep http_requests_total
```

---

## 📚 RELATED DOCUMENTS

**Before deployment:**
- **📋 Run Order (1-page timeline):** `docs/RUN_ORDER.md` - Start here for step-by-step deployment
- **✅ Preflight script:** `infra/scripts/preflight.sh` - Run before deployment
- **🧪 Smoke test script:** `infra/scripts/smoke_test.sh` - Automated testing

**During deployment:**
- **🚀 Quick Reference:** `infra/QUICK_REFERENCE.md` - Copy-paste commands
- **📊 War-room Checklist:** `docs/WAR_ROOM_CHECKLIST.md` - Hourly health checks

**Emergency procedures:**
- **🔴 Rollback Playbook:** `infra/ROLLBACK_PLAYBOOK.md` - 4 rollback options (2-10 min)
- **⚡ Runbook:** `docs/RUNBOOK.md` - Incident response procedures

**Training & preparation:**
- **🎭 Rollback Drill:** `docs/DRILL_PLAYBOOK.md` - Practice 15-min rollback quarterly
- **📖 Helpcard (public):** `docs/HELPCARD_PUBLIC.md` - User guide for rescue teams

**Configuration files:**
- **🔒 Security headers:** `infra/nginx/conf.d/security_headers.conf`
- **📜 Log rotation:** `infra/logrotate/floodwatch`

---

**Document version:** 1.1.1
**Last updated:** 2025-11-01
