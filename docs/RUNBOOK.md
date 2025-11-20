# FloodWatch Operations Runbook 📚

**Version:** 1.0
**Last Updated:** 2025-10-31
**Audience:** Operations team, on-call engineers

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Common Incidents](#common-incidents)
3. [Monitoring & Health Checks](#monitoring--health-checks)
4. [Disaster Recovery](#disaster-recovery)
5. [Scaling & Performance](#scaling--performance)
6. [External Dependencies](#external-dependencies)

---

## Quick Reference

### Emergency Contacts

- **On-call Lead:** [Phone/Telegram]
- **Database Admin:** [Contact]
- **Infrastructure:** [Contact]
- **Product Owner:** [Contact]

### Critical URLs

- **Production:** https://floodwatch.vn
- **API Health:** https://floodwatch.vn/health
- **Ops Dashboard:** https://floodwatch.vn/ops?token=[ADMIN_TOKEN]
- **Metrics:** https://floodwatch.vn/metrics (requires admin token)

### Quick Commands

```bash
# SSH to production server
ssh deploy@floodwatch.vn

# View logs
cd /opt/floodwatch
./infra/scripts/prod_logs.sh api
./infra/scripts/prod_logs.sh web
./infra/scripts/prod_logs.sh nginx

# Check service status
docker-compose -f docker-compose.prod.yml ps

# Restart a service
docker-compose -f docker-compose.prod.yml restart api

# Database backup NOW
./infra/scripts/prod_backup.sh
```

---

## Common Incidents

### 1. KTTV/Press Scraper Failing ⚠️

**Symptoms:**
- Cron logs show `❌ Error fetching` or `No data found`
- `/ops` dashboard shows no new ALERT reports for > 2 hours
- Alerts dispatcher shows "No new reports"

**Diagnosis:**

```bash
# Check KTTV scraper logs
cd /opt/floodwatch/ops/cron
tail -100 /var/log/floodwatch_kttv.log

# Run manually to see errors
python kttv_alerts.py
```

**Root Causes:**

1. **Website structure changed (DOM selectors outdated)**
   - KTTV/news sites frequently redesign
   - CSS selectors in code no longer match

2. **Website blocking our User-Agent**
   - Rate limiting from news site
   - IP blocklist

3. **Network/DNS issues**
   - Timeout connecting to news sites
   - DNS resolution failure

**Solution:**

**Quick Fix (enable fallback):**
```bash
# KTTV scraper has mock fallback - already enabled
# Check if fallback is working:
grep "mock" /var/log/floodwatch_kttv.log
```

**Permanent Fix:**
```bash
# 1. Check if site is accessible
curl -I https://nchmf.gov.vn

# 2. Inspect current selectors
cat ops/cron/selectors.json

# 3. Update selectors if needed
# Visit site in browser, inspect elements, update JSON
nano ops/cron/selectors.json

# 4. Test scraper manually
cd ops/cron
python kttv_alerts.py

# 5. If working, restart cron
# (cron will pick up changes on next run)
```

**Prevention:**
- Set up daily automated test of scraper
- Monitor for 0 new alerts > 3 hours during flood season
- Maintain contact with KTTV for API access (future)

---

### 2. Mapbox Quota Exceeded 📍

**Symptoms:**
- `/map` page shows blank tiles or error
- Browser console: `401 Unauthorized` on Mapbox tiles
- User reports: "Map not loading"

**Diagnosis:**

```bash
# Check Mapbox usage
# Log into https://account.mapbox.com
# Navigate to Statistics > API Usage
# Check "Map Loads" for current month
```

**Root Cause:**
- Free tier: 50,000 map loads/month
- During heavy flood events, traffic spikes
- Quota reached mid-month

**Solution:**

**Immediate (Switch to OSM tiles):**

```bash
# 1. Update environment variable
echo "NEXT_PUBLIC_USE_OSM=true" >> .env.prod

# 2. Rebuild web service
docker-compose -f docker-compose.prod.yml build web
docker-compose -f docker-compose.prod.yml restart web

# 3. Verify map loads with OpenStreetMap tiles
# Visit https://floodwatch.vn/map
```

**Code change (if env var not ready):**

Edit `apps/web/components/MapView.tsx`:
```typescript
// Change from:
mapStyle: "mapbox://styles/mapbox/streets-v12"

// To:
mapStyle: {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256
    }
  },
  layers: [{
    id: 'osm-tiles',
    type: 'raster',
    source: 'osm-tiles'
  }]
}
```

**Long-term:**
- Upgrade to Mapbox Pro ($5/month for 100k loads)
- Implement tile caching with Cloudflare
- Add "Lite mode" link prominently for low-data users

---

### 3. Database Growing Too Large 💾

**Symptoms:**
- Disk usage > 80%
- Query performance degrading (p95 > 200ms)
- Backup files exceeding storage limits

**Diagnosis:**

```bash
# Check disk usage
df -h

# Check database size
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT
  pg_size_pretty(pg_database_size('floodwatch')) as db_size,
  pg_size_pretty(pg_total_relation_size('reports')) as reports_size,
  pg_size_pretty(pg_total_relation_size('deliveries')) as deliveries_size;
"

# Count old reports
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days') as old_reports
FROM reports;
"
```

**Root Cause:**
- Reports accumulating indefinitely
- No TTL (time-to-live) policy
- High volume during flood season

**Solution:**

**Immediate (Archive old data):**

```bash
# 1. Backup first!
./infra/scripts/prod_backup.sh

# 2. Archive reports older than 30 days to separate table
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch <<EOF
-- Create archive table
CREATE TABLE IF NOT EXISTS reports_archive (LIKE reports INCLUDING ALL);

-- Move old reports
INSERT INTO reports_archive
SELECT * FROM reports
WHERE created_at < NOW() - INTERVAL '30 days';

-- Verify count
SELECT COUNT(*) FROM reports_archive;

-- Delete from main table (do this carefully!)
DELETE FROM reports
WHERE created_at < NOW() - INTERVAL '30 days';

-- VACUUM to reclaim space
VACUUM FULL reports;
EOF

# 3. Check disk space reclaimed
df -h
```

**Automated (set up TTL cron):**

```bash
# Add to crontab
0 3 * * 0 /opt/floodwatch/ops/scripts/archive_old_reports.sh >> /var/log/floodwatch_archive.log 2>&1
```

Create `ops/scripts/archive_old_reports.sh`:
```bash
#!/bin/bash
# Archive reports older than 30 days, run weekly

docker-compose -f docker-compose.prod.yml exec -T db psql -U fw_prod_user -d floodwatch <<EOF
-- Move to archive
INSERT INTO reports_archive
SELECT * FROM reports
WHERE created_at < NOW() - INTERVAL '30 days'
AND id NOT IN (SELECT id FROM reports_archive);

-- Delete archived
DELETE FROM reports
WHERE created_at < NOW() - INTERVAL '30 days';

-- Vacuum
VACUUM reports;
EOF

echo "Archive completed at $(date)"
```

**Prevention:**
- Monitor disk usage weekly
- Set up alerts for disk > 70%
- Consider partitioning by month (future)

---

### 4. Restore from Backup 🔄

**When to Restore:**
- Accidental data deletion
- Database corruption
- Migration failure
- Testing disaster recovery

**Procedure:**

**WARNING:** This will overwrite current data!

```bash
# 1. Identify backup file
ls -lh /opt/floodwatch/infra/backups/

# 2. Stop API to prevent new writes
docker-compose -f docker-compose.prod.yml stop api

# 3. Restore database
./infra/scripts/prod_restore.sh /opt/floodwatch/infra/backups/floodwatch_20251031_020000.sql.gz

# Confirm when prompted: yes

# 4. Verify data
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT COUNT(*), MAX(created_at) FROM reports;
"

# 5. Restart API
docker-compose -f docker-compose.prod.yml start api

# 6. Test health check
curl https://floodwatch.vn/health
```

**Rollback if restore fails:**
```bash
# Restore from previous backup
./infra/scripts/prod_restore.sh /opt/floodwatch/infra/backups/floodwatch_PREVIOUS.sql.gz
```

---

### 5. Webhook Delivery Failures 📡

**Symptoms:**
- `/deliveries` shows high failure rate (>10%)
- Subscriber organizations report missing alerts
- Logs show "failed after 3 attempts"

**Diagnosis:**

```bash
# Check failed deliveries
curl -s "https://floodwatch.vn/deliveries?token=$ADMIN_TOKEN&status=failed&since=6h" | jq

# Check alerts dispatcher logs
tail -100 /var/log/floodwatch_alerts.log | grep "failed"
```

**Root Causes:**

1. **Subscriber endpoint down**
   - Their webhook URL unreachable
   - Timeout (>5s)

2. **Invalid signature**
   - HMAC mismatch
   - Secret changed without updating subscription

3. **Network issues**
   - DNS failure
   - Firewall blocking our IP

**Solution:**

**Verify endpoint manually:**
```bash
# Test webhook with sample payload
curl -X POST https://subscriber-webhook-url.com/alerts \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=test" \
  -d '{
    "event": "alert",
    "timestamp": "2025-10-31T10:00:00Z",
    "report": {"id": "test"}
  }'
```

**Retry failed deliveries:**
```bash
# Reset failed deliveries to pending (they'll retry)
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
UPDATE deliveries
SET status = 'pending', attempts = 0, last_error = NULL
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '6 hours';
"

# Manually run dispatcher
cd /opt/floodwatch/ops/cron
python alerts_dispatcher.py
```

**Contact subscriber:**
```
Subject: FloodWatch Webhook Delivery Failure

We've been unable to deliver alerts to your webhook endpoint:
- URL: [callback_url]
- Failures: [count] in last 6 hours
- Last error: [last_error]

Please verify:
1. Endpoint is accessible
2. HMAC signature validation is correct
3. Firewall allows our IP: [server_ip]

Test your endpoint: [include curl command]
```

---

### 6. High API Error Rate 🚨

**Symptoms:**
- `/metrics` shows error rate > 5%
- Users report "500 Internal Server Error"
- Logs show exceptions

**Diagnosis:**

```bash
# Check API logs for errors
./infra/scripts/prod_logs.sh api | grep ERROR | tail -50

# Check structured logs
docker-compose -f docker-compose.prod.yml logs --tail=100 api | grep '"level":"error"'

# Check specific endpoints
curl -s "https://floodwatch.vn/metrics?token=$ADMIN_TOKEN" | grep error
```

**Common Errors:**

**Database Connection Pool Exhausted:**
```
Error: "FATAL: remaining connection slots are reserved"
```

Solution:
```bash
# Check connection count
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT count(*) FROM pg_stat_activity;
"

# Increase pool size (temporary)
docker-compose -f docker-compose.prod.yml exec api python -c "
from sqlalchemy import create_engine
# Edit main.py to increase pool_size from 5 to 20
"

# Restart API
docker-compose -f docker-compose.prod.yml restart api
```

**Timeout on Heavy Queries:**
```
Error: "statement timeout"
```

Solution:
```bash
# Identify slow queries
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Add indexes (see PR-18)
# Increase statement_timeout for heavy operations
```

---

## Monitoring & Health Checks

### Daily Health Check Routine

**Run every morning (or before shift):**

```bash
# 1. Overall health
curl -s https://floodwatch.vn/health | jq

# 2. API response time
time curl -s "https://floodwatch.vn/api/v1/reports?limit=1" > /dev/null

# 3. Database connections
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"

# 4. Disk space
df -h | grep -E '(Filesystem|/dev/)'

# 5. Recent errors (last 1 hour)
./infra/scripts/prod_logs.sh api | grep ERROR | tail -20

# 6. Backup status
ls -lht /opt/floodwatch/infra/backups/ | head -5

# 7. Recent reports
curl -s "https://floodwatch.vn/reports?limit=5" | jq '.data[].created_at'
```

### Key Metrics to Watch

| Metric | Green | Yellow | Red | Action |
|--------|-------|--------|-----|--------|
| API p95 latency | <100ms | 100-200ms | >200ms | Check indexes |
| Error rate | <1% | 1-5% | >5% | Check logs |
| Disk usage | <70% | 70-85% | >85% | Archive data |
| Backup age | <24h | 24-48h | >48h | Check cron |
| SOS/6h | varies | - | 0 for >6h | Check scrapers |
| Webhook success | >95% | 90-95% | <90% | Contact subscribers |

---

## Disaster Recovery

### Full System Failure

**Symptoms:**
- All services down
- Cannot access website
- SSH works but containers stopped

**Recovery:**

```bash
# 1. Check what's running
docker-compose -f docker-compose.prod.yml ps

# 2. Start all services
docker-compose -f docker-compose.prod.yml up -d

# 3. Check logs for errors
./infra/scripts/prod_logs.sh

# 4. If database corrupted, restore from backup
# (see section 4 above)

# 5. Run migrations if needed
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head

# 6. Verify health
curl https://floodwatch.vn/health
```

### Nginx/SSL Issues

**Certificate Expired:**

```bash
# Renew certificate manually
docker-compose -f docker-compose.prod.yml run --rm certbot renew

# Reload nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Verify
curl -I https://floodwatch.vn
```

---

## Scaling & Performance

### Vertical Scaling (Increase Resources)

**When to scale:**
- Consistent high CPU (>80%)
- Memory pressure (swap usage)
- Slow API responses despite optimizations

**Procedure:**

```bash
# 1. Check current resource usage
docker stats

# 2. Edit docker-compose.prod.yml
# Add resource limits:
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

# 3. Recreate service
docker-compose -f docker-compose.prod.yml up -d --force-recreate api
```

### Horizontal Scaling (Multiple API Instances)

**Future:** Load balance multiple API containers

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
```

---

## External Dependencies

### Mapbox

- **Free Tier:** 50,000 map loads/month
- **Check Usage:** https://account.mapbox.com
- **Fallback:** OpenStreetMap tiles (see incident #2)

### Cloudinary

- **Free Tier:** 25GB storage, 25GB bandwidth/month
- **Check Usage:** https://cloudinary.com/console
- **Fallback:** Disable uploads temporarily, show message

### Telegram Bot

- **Setup:** BotFather (@BotFather)
- **Token:** `TELEGRAM_BOT_TOKEN` in `.env.prod`
- **Test:** `/start` command in bot
- **Troubleshooting:** Verify bot token, check chat IDs in `alerts_map.json`

---

## Appendix

### Useful SQL Queries

**Count reports by type (last 24h):**
```sql
SELECT type, COUNT(*)
FROM reports
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type;
```

**Top provinces by SOS reports:**
```sql
SELECT province, COUNT(*) as sos_count
FROM reports
WHERE type = 'SOS'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY province
ORDER BY sos_count DESC
LIMIT 10;
```

**Webhook delivery success rate:**
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM deliveries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Log Locations

```
/var/log/floodwatch_kttv.log        - KTTV scraper
/var/log/floodwatch_roads.log       - Roads scraper
/var/log/floodwatch_alerts.log      - Alerts dispatcher
/var/log/floodwatch_backup.log      - Database backups
/var/log/nginx/access.log           - Nginx access
/var/log/nginx/error.log            - Nginx errors
```

### Emergency Shutdown

**Only in extreme cases (security breach, etc.):**

```bash
# Stop all services immediately
docker-compose -f docker-compose.prod.yml down

# Block all traffic
sudo iptables -A INPUT -p tcp --dport 80 -j DROP
sudo iptables -A INPUT -p tcp --dport 443 -j DROP

# Notify team
# Contact security team
# Investigate breach
```

---

**Document Owner:** Operations Team
**Review Schedule:** Monthly, or after major incidents
**Feedback:** Submit updates via PR to this document
