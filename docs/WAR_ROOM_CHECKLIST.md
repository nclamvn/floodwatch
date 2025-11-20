# 🚨 FloodWatch War Room Checklist

**Purpose:** Quick reference for on-call shifts during flood season
**Print this and keep at war room station**

---

## Shift Handover (Every 8 hours)

### Ca A (06:00–14:00) | Ca B (14:00–22:00) | Ca C (22:00–06:00)

**Outgoing shift:**
- [ ] Brief incoming shift on current situation
- [ ] Report any incidents/alerts in last 8 hours
- [ ] Note any ongoing issues
- [ ] Update metrics board (see below)

**Incoming shift:**
- [ ] Review metrics board
- [ ] Check health dashboard
- [ ] Verify crons running
- [ ] Test critical paths

---

## Every Hour: Quick Health Check (5 minutes)

```bash
# Copy-paste this block every hour
curl -s https://floodwatch.vn/health | jq && \
curl -s "https://floodwatch.vn/api/v1/reports?limit=1" > /dev/null && \
echo "✅ System healthy at $(date)"
```

- [ ] Health check passed
- [ ] API responding <2s
- [ ] No 5xx errors in logs

---

## Metrics Board (Update every 2 hours)

| Metric | Target | Current | Status | Notes |
|--------|--------|---------|--------|-------|
| SOS ≥0.8 (last 6h) | Track | ____ | ⬜ | |
| ROAD=CLOSED (active) | Track | ____ | ⬜ | |
| Webhook success rate | >95% | ___% | ⬜ | |
| API p95 latency | <150ms | ___ms | ⬜ | |
| Error rate | <1% | ___% | ⬜ | |
| Disk usage | <80% | ___% | ⬜ | |
| Mapbox quota used | <80% | ___% | ⬜ | |
| Last backup | <24h | ___ ago | ⬜ | |

**Legend:** ✅ Green | ⚠️ Yellow | 🚨 Red

---

## Alert Thresholds (When to Escalate)

### 🟢 Normal (Monitor)
- SOS reports: 0-10/6h
- Webhook success: 95-100%
- API p95: <100ms
- Error rate: <1%

### 🟡 Elevated (Increase Monitoring)
- SOS reports: 10-30/6h
- Webhook success: 90-95%
- API p95: 100-200ms
- Error rate: 1-5%
- Disk usage: 70-85%

**Actions:**
- [ ] Check logs for patterns
- [ ] Notify team lead
- [ ] Prepare to scale

### 🔴 Critical (Immediate Action)
- SOS reports: >30/6h (flash flood)
- Webhook success: <90%
- API p95: >200ms
- Error rate: >5%
- Disk usage: >85%
- No new reports >3h (scraper down)

**Actions:**
- [ ] Execute incident response (see Runbook)
- [ ] Notify all hands
- [ ] Start incident log

---

## Common Quick Fixes (Copy-Paste Ready)

### Fix 1: KTTV Scraper Down
```bash
# Enable mock fallback (already on), verify working
ssh deploy@floodwatch.vn
cd /opt/floodwatch
./infra/scripts/prod_logs.sh | grep "kttv.*mock"
```

### Fix 2: Mapbox Quota Exceeded
```bash
# Switch to OSM tiles immediately
echo "NEXT_PUBLIC_USE_OSM=true" >> .env.prod
docker-compose -f docker-compose.prod.yml restart web
# Verify: visit /map, tiles should load from OpenStreetMap
```

### Fix 3: API Slow/Timeout
```bash
# Check active queries
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
"
# If stuck query found, kill it: SELECT pg_terminate_backend(PID);
```

### Fix 4: Disk Full (Emergency)
```bash
# Archive old reports NOW
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
DELETE FROM reports WHERE created_at < NOW() - INTERVAL '60 days';
VACUUM FULL reports;
"
df -h  # Verify space reclaimed
```

### Fix 5: Webhooks Failing
```bash
# Retry all failed deliveries from last 6h
docker-compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
UPDATE deliveries SET status='pending', attempts=0 WHERE status='failed' AND created_at > NOW() - INTERVAL '6 hours';
"
# Run dispatcher manually
cd /opt/floodwatch/ops/cron && python alerts_dispatcher.py
```

### Fix 6: Database Backup Failed
```bash
# Run backup manually
cd /opt/floodwatch
./infra/scripts/prod_backup.sh
# Verify file created
ls -lh infra/backups/ | head -3
```

---

## Escalation Path

**Level 1 - On-call Engineer (You)**
- Handle routine incidents
- Apply quick fixes
- Monitor metrics

**Level 2 - Team Lead**
- Contact for elevated alerts (yellow)
- Approve major changes
- Decision on scaling

**Level 3 - All Hands**
- Critical incidents (red)
- System-wide failures
- Data corruption

**Contact:**
- On-call: [Phone/Telegram]
- Team Lead: [Phone/Telegram]
- Emergency: [Group chat]

---

## Shift Routine

### Start of Shift
- [ ] Review handover notes
- [ ] Check metrics board
- [ ] Run health check
- [ ] Verify all crons running:
  ```bash
  ps aux | grep -E "kttv|roads|alerts" | grep python
  ```
- [ ] Check last backup time
- [ ] Review open incidents (if any)

### Every Hour
- [ ] Run health check (see above)
- [ ] Scan logs for errors:
  ```bash
  ./infra/scripts/prod_logs.sh api | grep ERROR | tail -10
  ```

### Every 2 Hours
- [ ] Update metrics board
- [ ] Check Mapbox quota: https://account.mapbox.com
- [ ] Check Cloudinary usage: https://cloudinary.com/console
- [ ] Verify webhook delivery rate:
  ```bash
  curl -s "https://floodwatch.vn/deliveries?token=$ADMIN_TOKEN&since=2h" | jq '.data | map(.status) | group_by(.) | map({status: .[0], count: length})'
  ```

### Every 4 Hours
- [ ] Review full incident log
- [ ] Check disk space:
  ```bash
  df -h | grep -E '/dev/'
  ```
- [ ] Verify database connection count:
  ```bash
  docker-compose -f docker-compose.prod.yml exec db psql -c "SELECT count(*) FROM pg_stat_activity;"
  ```

### End of Shift
- [ ] Complete handover form
- [ ] Brief incoming shift (verbal + written)
- [ ] Update incident log
- [ ] Note any trends/patterns observed

---

## High-Traffic Event Protocol (Typhoon/Flash Flood)

**Trigger:** Forecast predicts major event OR SOS reports >30/6h

### D-1 (Day Before)
- [ ] Full database backup
- [ ] Increase cron frequency:
  - KTTV: every 30 min (from 1h)
  - Roads: every 30 min (from 1h)
  - Alerts: every 1 min (from 2 min)
- [ ] Check quotas: Mapbox, Cloudinary (upgrade if needed)
- [ ] Notify team: all hands on deck
- [ ] Test failover to OSM tiles
- [ ] Prepare war room: coffee ☕, charts 📊, contacts 📞

### H-2 (2 Hours Before)
- [ ] Final health check
- [ ] Verify all systems green
- [ ] Set alerts to max sensitivity
- [ ] Double-check backup cron active

### H-0 (Event Start)
- [ ] Announce on channels: "FloodWatch LIVE"
- [ ] Post `/lite` link for low-bandwidth users
- [ ] Monitor metrics every 30 min
- [ ] Be ready for Mapbox quota → OSM switch

### H+2 (2 Hours After Peak)
- [ ] Review p95 latency (should be <200ms)
- [ ] Check webhook failure rate (should be <10%)
- [ ] Adjust trust score thresholds if needed
- [ ] Archive processed reports if disk >80%

### H+24 (Post-Event)
- [ ] Generate post-mortem report
- [ ] Run full backup
- [ ] Reset cron to normal frequency
- [ ] Thank the team 🙏

---

## Quick Diagnostics

### "Map not loading"
1. Check browser console (F12) for errors
2. Verify Mapbox token: `echo $NEXT_PUBLIC_MAPBOX_TOKEN`
3. Check quota: https://account.mapbox.com
4. Fallback to OSM (see Fix #2)

### "No reports showing"
1. Check `/health` endpoint
2. Verify scrapers running: `ps aux | grep python`
3. Check database: `SELECT COUNT(*) FROM reports;`
4. Review scraper logs for errors

### "Webhooks not received"
1. Check deliveries status: `curl .../deliveries?since=1h`
2. Verify dispatcher running: `ps aux | grep alerts_dispatcher`
3. Test subscriber endpoint manually (curl)
4. Check HMAC signature matching

### "API very slow"
1. Check database query times: `pg_stat_statements`
2. Verify indexes exist (see PR-18)
3. Check connection pool: `pg_stat_activity`
4. Restart API if needed (last resort)

---

## Incident Log Template

```
=== INCIDENT LOG ===
Date/Time: __________ | Shift: A/B/C | On-call: __________

Severity: 🟢 Green | 🟡 Yellow | 🔴 Red

Description:


Root Cause:


Actions Taken:
1.
2.
3.

Outcome:


Prevention:


Follow-up Required: Yes/No
If yes:

Escalated to: __________
Resolved at: __________
Duration: __________
```

---

## Emergency Hotlines

- **Technical Support:** [Phone]
- **Infrastructure:** [Phone]
- **Database Admin:** [Phone]
- **Product Owner:** [Phone]
- **Emergency Services (Floods):** 113, 114

---

## Success Criteria (Daily)

At end of day, shift is successful if:

- ✅ No incidents escalated to Level 3
- ✅ All metrics stayed in green/yellow
- ✅ 100% uptime (or <15min downtime)
- ✅ Webhook delivery >90%
- ✅ All backups completed
- ✅ No data loss
- ✅ Team communicated proactively

---

**Print Version:** Black & white friendly
**Last Updated:** 2025-10-31
**Feedback:** Update this doc after any incident!
