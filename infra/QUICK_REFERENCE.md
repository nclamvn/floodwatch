# FloodWatch - Quick Reference Commands

**🚨 Emergency commands for on-call engineers**

---

## 🚀 DEPLOYMENT

```bash
# Full deployment
cd /opt/floodwatch
./infra/scripts/prod_up.sh

# Migrate database
docker compose -f docker-compose.prod.yml exec api alembic upgrade head

# Restart specific service
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart web
docker compose -f docker-compose.prod.yml restart nginx

# Warm-up cache after deployment
for i in {1..5}; do
  curl -sS https://floodwatch.vn/health > /dev/null
  curl -sS https://floodwatch.vn/lite > /dev/null
  sleep 1
done
```

---

## 📊 MONITORING

```bash
# View logs (live)
./infra/scripts/prod_logs.sh api       # API logs
./infra/scripts/prod_logs.sh nginx     # Nginx logs
./infra/scripts/prod_logs.sh db        # Database logs

# Tail specific cron logs
tail -f logs/kttv.log                  # KTTV scraper
tail -f logs/roads.log                 # Roads press watch
tail -f logs/alerts.log                # Alerts dispatcher
tail -f logs/snapshot.log              # Daily snapshots

# Check container status
docker compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats --no-stream

# Check metrics
curl -s "https://floodwatch.vn/metrics?token=ADMIN_TOKEN" | head -50
```

---

## 🔍 DEBUGGING

```bash
# API errors in last hour
docker compose -f docker-compose.prod.yml logs --since 1h api | grep ERROR

# Check slow queries
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;"

# Database connections
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;"

# Check disk space
df -h

# Check scraper last run
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT MAX(created_at) as last_report, source
FROM reports
GROUP BY source;"
```

---

## 🔧 FIXES

```bash
# Restart API (if hanging)
docker compose -f docker-compose.prod.yml restart api

# Clear API cache (if stale data)
docker compose -f docker-compose.prod.yml exec api rm -rf __pycache__

# Reload Nginx config
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Force scraper run (manual)
docker compose -f docker-compose.prod.yml exec api python ops/cron/kttv_scraper.py

# Force alerts dispatch
docker compose -f docker-compose.prod.yml exec api python ops/cron/alerts_dispatcher.py

# Generate snapshot manually
docker compose -f docker-compose.prod.yml exec api python ops/cron/daily_snapshot.py
```

---

## 💾 BACKUP & RESTORE

```bash
# Manual backup
./infra/scripts/prod_backup.sh

# List backups
ls -lh infra/backups/

# Restore from backup
./infra/scripts/prod_restore.sh infra/backups/fw_backup_20251101_230000.sql.gz

# Copy backup to remote
scp infra/backups/fw_backup_*.sql.gz backup-server:/backups/
```

---

## 🚨 ROLLBACK

```bash
# Method 1: Rollback last migration
docker compose -f docker-compose.prod.yml exec api alembic downgrade -1

# Method 2: Restore from backup
./infra/scripts/prod_restore.sh infra/backups/<latest>.sql.gz

# Method 3: Revert to previous image
docker compose -f docker-compose.prod.yml pull api:previous-tag
docker compose -f docker-compose.prod.yml up -d api

# Method 4: Emergency /lite-only mode (fastest rollback: ~30 seconds)
# Redirect all /map requests to /lite (preserves core functionality)
docker compose -f docker-compose.prod.yml exec nginx bash -c "
cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
location = /map {
    return 302 /lite;
}
location /map/ {
    return 302 /lite;
}
EOF
nginx -s reload
"

# Revert to normal (remove emergency config)
docker compose -f docker-compose.prod.yml exec nginx bash -c "
rm -f /etc/nginx/conf.d/emergency_lite_only.conf
nginx -s reload
"
```

---

## 🧪 TESTING

```bash
# Health check
curl -I https://floodwatch.vn/health

# Smoke test
k6 run ops/loadtest/k6_smoke_test.js

# Load test (light)
BASE_URL=https://api.floodwatch.vn API_KEY=xxx \
k6 run --vus 10 --duration 1m ops/loadtest/k6_reports_scenario.js

# Test scraper
docker compose -f docker-compose.prod.yml exec api python ops/cron/kttv_scraper.py

# Check PII scrubbing
curl "https://floodwatch.vn/reports?limit=1" | jq '.data[0].description'
# Should see: ***-****-*** instead of phone numbers
```

---

## 🔐 SECURITY

```bash
# Rotate admin token (after changing .env.prod)
docker compose -f docker-compose.prod.yml restart api

# Generate new API key
docker compose -f docker-compose.prod.yml exec api python -c "
import secrets
print(secrets.token_urlsafe(32))
"

# Check failed login attempts (if you add auth)
docker compose -f docker-compose.prod.yml logs nginx | grep "401\|403"

# SSL certificate renewal (auto, but manual if needed)
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 📈 PERFORMANCE

```bash
# Run performance analysis
docker compose -f docker-compose.prod.yml exec api python ops/scripts/analyze_performance.py

# Check index usage
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;"

# VACUUM database
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "VACUUM ANALYZE;"

# Check table sizes
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

## 🎯 WAR-ROOM QUICK CHECKS (Every hour)

```bash
# 1. API Health
curl -s https://floodwatch.vn/health | jq .

# 2. Recent errors
docker compose -f docker-compose.prod.yml logs --since 1h api | grep -c ERROR

# 3. Scraper lag
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT
  source,
  MAX(created_at) as last_report,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as lag_minutes
FROM reports
GROUP BY source;"

# 4. New reports queue
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT status, COUNT(*)
FROM reports
WHERE created_at > NOW() - INTERVAL '6 hours'
GROUP BY status;"

# 5. Metrics snapshot
curl -s "https://floodwatch.vn/metrics?token=ADMIN_TOKEN" | grep -E "http_requests_total|reports_total" | tail -10
```

---

## 🔥 EMERGENCY CONTACTS

| Issue | Contact | Action |
|-------|---------|--------|
| Database down | DBA team | Check `docs/RUNBOOK.md` → "Database Connection Failures" |
| High traffic | DevOps | Scale horizontally or enable rate limiting |
| KTTV scraper failing | Backend team | Check `docs/RUNBOOK.md` → "KTTV Scraper Failure" |
| SSL certificate expiry | Ops | Run `certbot renew` |
| Mapbox quota exceeded | Frontend team | Switch to OSM tiles (see RUNBOOK) |

---

## 📚 DOCUMENTATION LINKS

- **Runbook:** `docs/RUNBOOK.md`
- **War-room Checklist:** `docs/WAR_ROOM_CHECKLIST.md`
- **Performance Notes:** `docs/PERF_NOTES.md`
- **Load Testing:** `docs/LOAD_TESTING.md`
- **Metrics Guide:** `docs/METRICS.md`
- **Privacy Policy:** `docs/PRIVACY.md`

---

## 🎓 TRAINING RESOURCES

```bash
# Practice rollback (staging)
# 1. Deploy v4
# 2. Make breaking change
# 3. Practice rollback in <10 minutes

# Practice backup/restore
# 1. Create backup
# 2. Drop test table
# 3. Restore and verify

# Practice incident response
# Scenario: KTTV scraper failing
# 1. Detect via metrics
# 2. Check logs
# 3. Manual run
# 4. Fix root cause
# 5. Verify recovery
# Time target: <15 minutes
```

---

**🔖 Bookmark this page for quick access during incidents**

**Last updated:** 2025-11-01
