# FloodWatch - ROLLBACK DRILL PLAYBOOK

**🎯 15-Minute Rollback Drill**

Practice rollback procedures in a safe staging environment to ensure team readiness for production incidents.

---

## 📋 DRILL OBJECTIVES

**Primary goals:**
- ✅ Complete rollback in **≤10 minutes** (target: 15min with debrief)
- ✅ All team members know their roles
- ✅ Communication templates tested
- ✅ No data loss during rollback
- ✅ Service restored with <1min downtime

**Success criteria:**
- Detection time: **<5 minutes** from incident start
- Decision time: **<2 minutes** from detection to rollback start
- Execution time: **<10 minutes** from rollback start to verification
- Communication: All stakeholders notified within **2 minutes** of rollback start

---

## 🗓️ DRILL SCHEDULE

**Frequency:** Quarterly (every 3 months)

**Next drill date:** ___/___/___ at _____:_____

**Mandatory attendees:**
- On-call engineers (all shifts)
- Ops team lead
- Database admin
- Product owner (observer)

**Optional attendees:**
- Frontend engineers
- QA team
- Support team

---

## 🎭 DRILL SCENARIO

### Scenario 1: Bad Migration (Most Common)

**Setup:**
1. Deploy "broken" migration to **staging** (NOT production!)
2. Migration adds slow query that causes p95 >500ms
3. Error rate climbs to 8% within 5 minutes

**Inject the issue:**

```bash
# On staging environment only!
cd /opt/floodwatch-staging

# Create intentionally slow migration
cat > apps/api/migrations/versions/999_drill_slow_query.py << 'EOF'
"""Drill: Intentionally slow query

Revision ID: 999_drill
Revises: 005_performance_indexes
"""
from alembic import op

def upgrade():
    # Add unindexed column that will be queried frequently
    op.execute("""
        ALTER TABLE reports ADD COLUMN drill_slow_field TEXT;
        UPDATE reports SET drill_slow_field = REPEAT('x', 1000);
    """)

def downgrade():
    op.execute("ALTER TABLE reports DROP COLUMN drill_slow_field;")
EOF

# Apply the "bad" migration
docker compose -f docker-compose.staging.yml exec api alembic upgrade head

# Trigger slow queries
docker compose -f docker-compose.staging.yml exec api python -c "
from app.database import get_db
db = next(get_db())
# This will be slow due to unindexed drill_slow_field
result = db.execute('SELECT * FROM reports WHERE drill_slow_field LIKE \\'%x%\\' LIMIT 1000')
print(f'Slow query executed: {result.rowcount} rows')
"
```

**Expected symptoms:**
- p95 latency jumps from ~50ms → 600ms
- Error rate: 0% → 8%
- Database CPU: 20% → 85%
- Logs show `ERROR: Query timeout` messages

---

### Scenario 2: Bad Docker Image (Second Most Common)

**Setup:**
1. Deploy Docker image with broken dependency
2. API container restarts every 30 seconds (crash loop)
3. Health check fails

**Inject the issue:**

```bash
# On staging, deploy intentionally broken image
docker tag floodwatch-api:v4-prod floodwatch-api:v4-broken

# Modify API to import non-existent package
docker compose -f docker-compose.staging.yml exec api bash -c "
echo 'import nonexistent_package' >> /app/app/main.py
"

# Restart API (will crash)
docker compose -f docker-compose.staging.yml restart api
```

**Expected symptoms:**
- API container status: `Restarting (1) X seconds ago`
- Health check: 503 Service Unavailable
- Logs: `ModuleNotFoundError: No module named 'nonexistent_package'`

---

### Scenario 3: Data Corruption (Rare but Critical)

**Setup:**
1. Accidentally delete critical index
2. Queries work but are extremely slow (sequential scans)
3. Database connections exhaust

**Inject the issue:**

```bash
# On staging only!
docker compose -f docker-compose.staging.yml exec db psql -U fw_staging_user -d floodwatch_staging -c "
DROP INDEX idx_reports_prov_type_created;
"

# Trigger queries that now require seq scans
ab -n 100 -c 10 https://staging.floodwatch.vn/reports?province=Quảng+Bình
```

**Expected symptoms:**
- p95 latency: 50ms → 2000ms
- Database connections: 10 → 95 (near pool limit)
- Logs: `EXPLAIN` shows `Seq Scan` instead of `Index Scan`

---

## ⏱️ DRILL TIMELINE (Target: 15 minutes)

### T-0' (00:00) - INCIDENT START

**Facilitator:** Inject issue (choose scenario above)

**Scribe:** Start timer, log incident start: _____:_____

---

### T+0' to T+5' (00:00-05:00) - DETECTION

**Observer role:**

1. Check monitoring dashboard
   ```bash
   curl -s "https://staging.floodwatch.vn/metrics?token=ADMIN_TOKEN" | grep http_request_duration
   ```

2. Identify anomaly:
   - p95 latency spiking
   - Error rate climbing
   - Container crash loop

3. Check logs:
   ```bash
   docker compose -f docker-compose.staging.yml logs --since 5m api | grep ERROR | tail -20
   ```

4. **Declare incident** (post to drill chat):
   ```
   🚨 INCIDENT DETECTED
   Time: [timestamp]
   Symptom: [p95 >500ms / API down / errors >5%]
   Severity: Critical
   Escalating to Decider
   ```

**Scribe:** Log detection time: _____:_____ (target: <5min)

**Success criteria:** Incident detected and declared within **5 minutes**

---

### T+5' to T+7' (05:00-07:00) - DECISION

**Decider role:**

1. Review symptoms with Observer
2. Consult rollback decision matrix:

   | Symptom | Likely cause | Recommended option |
   |---------|--------------|-------------------|
   | p95 >500ms, no container issues | Bad migration | Option B (5min) |
   | Container crash loop | Bad image | Option A (3min) |
   | Queries slow, DB at limit | Missing index/corruption | Option C (8min) or Option D (2min) |

3. **Make rollback decision:**
   ```
   🔴 ROLLBACK AUTHORIZED
   Method: Option [A/B/C/D]
   Reason: [brief description]
   Driver: Begin rollback immediately
   ```

**Scribe:** Log decision time: _____:_____ (target: <2min from detection)

**Success criteria:** Rollback decision made within **2 minutes** of detection

---

### T+7' to T+17' (07:00-17:00) - ROLLBACK EXECUTION

**Driver role:** Execute chosen rollback option

#### Option A: Rollback Docker Images (3 minutes)

```bash
cd /opt/floodwatch-staging

# 1. Identify previous working tag
docker images | grep floodwatch-api

# 2. Update to previous tag
docker tag floodwatch-api:v4-prod floodwatch-api:latest

# 3. Restart with old image
docker compose -f docker-compose.staging.yml up -d api

# 4. Verify
docker compose -f docker-compose.staging.yml ps
curl -I https://staging.floodwatch.vn/health
```

**Scribe:** Log execution steps with timestamps

**Target:** Complete in **3 minutes**

---

#### Option B: Rollback Database Migration (5 minutes)

```bash
cd /opt/floodwatch-staging

# 1. Check current migration
docker compose -f docker-compose.staging.yml exec api alembic current

# 2. Rollback 1 migration
docker compose -f docker-compose.staging.yml exec api alembic downgrade -1

# 3. Verify downgrade
docker compose -f docker-compose.staging.yml exec api alembic current

# 4. Restart API
docker compose -f docker-compose.staging.yml restart api

# 5. Test queries
curl -s "https://staging.floodwatch.vn/reports?limit=1" | jq .
```

**Scribe:** Log execution steps with timestamps

**Target:** Complete in **5 minutes**

---

#### Option C: Restore Database Backup (8 minutes)

```bash
cd /opt/floodwatch-staging

# 1. Stop API to prevent writes
docker compose -f docker-compose.staging.yml stop api

# 2. Find latest backup
ls -lt infra/backups/staging/ | head -5

# 3. Restore backup
./infra/scripts/staging_restore.sh infra/backups/staging/fw_staging_backup_latest.sql.gz

# 4. Restart all services
docker compose -f docker-compose.staging.yml up -d

# 5. Verify data integrity
docker compose -f docker-compose.staging.yml exec db psql -U fw_staging_user -d floodwatch_staging -c "
SELECT COUNT(*) FROM reports;
SELECT MAX(created_at) FROM reports;
"
```

**Scribe:** Log execution steps with timestamps

**Target:** Complete in **8 minutes**

---

#### Option D: Emergency Lite-Only Mode (2 minutes)

```bash
cd /opt/floodwatch-staging

# 1. Enable Lite-only mode
docker compose -f docker-compose.staging.yml exec nginx bash -c "
cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
location = /map { return 302 /lite; }
location /map/ { return 302 /lite; }
EOF
nginx -s reload
"

# 2. Verify /lite works
curl -I https://staging.floodwatch.vn/lite

# 3. Verify /map redirects
curl -I https://staging.floodwatch.vn/map | grep "302"
```

**Scribe:** Log execution steps with timestamps

**Target:** Complete in **2 minutes**

---

### T+17' (17:00) - VERIFICATION

**Observer role:**

1. **Run smoke test:**
   ```bash
   API_KEY=__STAGING_KEY__ ADMIN_TOKEN=__STAGING_ADMIN__ \
   BASE_URL=https://staging.floodwatch.vn \
   ./infra/scripts/smoke_test.sh
   ```

2. **Check metrics:**
   ```bash
   curl -s "https://staging.floodwatch.vn/metrics?token=ADMIN_TOKEN" | \
   egrep "http_request_duration|http_requests_total"
   ```

3. **Verify p95 latency recovered:**
   ```bash
   # Should be back to normal (<150ms)
   docker compose -f docker-compose.staging.yml logs --since 2m api | grep "request_duration"
   ```

4. **Confirm no errors:**
   ```bash
   docker compose -f docker-compose.staging.yml logs --since 5m api | grep -c ERROR
   # Expected: 0 or very low
   ```

**Scribe:** Log verification results: _____:_____

**Success criteria:**
- ✅ Health check: 200 OK
- ✅ p95 latency: <150ms
- ✅ Error rate: <1%
- ✅ Key endpoints responding

---

### T+17' to T+20' (17:00-20:00) - COMMUNICATION

**Scribe role:** Send post-rollback communications

**Internal (Slack/Telegram):**

```
✅ DRILL ROLLBACK COMPLETE

Scenario: [Bad migration / Bad image / Data corruption]
Detection time: [X] minutes
Decision time: [Y] minutes
Execution time: [Z] minutes
Total time: [T] minutes

Method: Option [A/B/C/D]
Status: ✅ System restored / ⚠️ Lite-only mode

Verification:
- Health check: ✅ / ❌
- p95 latency: [X]ms (target: <150ms)
- Error rate: [X]% (target: <1%)
- Data integrity: ✅ / ❌

Next: 5-minute debrief
```

**External (if this were real):**

```
[RESOLVED] FloodWatch Drill - Rollback Test

This was a scheduled drill to test our rollback procedures.
All systems are operating normally.

Duration: [X] minutes
Impact: Staging environment only (no production impact)
```

**Scribe:** Log communication time: _____:_____

---

## 📊 DRILL SCORECARD

**Fill out after drill:**

| Metric | Target | Actual | ✅/❌ |
|--------|--------|--------|------|
| Detection time | <5 min | _____ min | ___ |
| Decision time | <2 min | _____ min | ___ |
| Execution time | <10 min | _____ min | ___ |
| Total time | <15 min | _____ min | ___ |
| Health check pass | Yes | Yes / No | ___ |
| p95 latency | <150ms | _____ ms | ___ |
| Error rate | <1% | _____ % | ___ |
| Data integrity | No loss | OK / Issues | ___ |

**Overall score:** _____ / 8 (target: 8/8)

---

## 💬 DEBRIEF (5 minutes)

**Facilitator leads discussion:**

### What went well?

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

### What could be improved?

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

### Action items

| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| _______________ | _____ | ___/___/___ | High/Med/Low |
| _______________ | _____ | ___/___/___ | High/Med/Low |
| _______________ | _____ | ___/___/___ | High/Med/Low |

### Lessons learned

**Documentation updates needed:**
- [ ] Update `ROLLBACK_PLAYBOOK.md` with new findings
- [ ] Update `RUN_ORDER.md` with clearer instructions
- [ ] Update `QUICK_REFERENCE.md` with missing commands
- [ ] Create new runbook entry for discovered issue

**Training needed:**
- [ ] Team member _____ needs training on Docker rollback
- [ ] Team member _____ needs training on DB migration rollback
- [ ] All team: Review rollback decision matrix

**Process improvements:**
- [ ] Add monitoring alert for [metric] (currently missing)
- [ ] Improve detection time with [tool/technique]
- [ ] Automate [manual step]

---

## 🎓 DRILL VARIATIONS

### Drill 2: Communication Under Pressure

**Focus:** Test communication templates and escalation paths

**Scenario:** Critical rollback needed at 2 AM

**Additions:**
- Practice paging on-call engineer
- Test SMS/Telegram alert templates
- Practice external stakeholder communication
- Simulate decider unavailable (backup decider must step in)

---

### Drill 3: Degraded Rollback

**Focus:** Handle rollback when primary method unavailable

**Scenario:** Need to rollback but backup is corrupted

**Challenge:**
- Option A (image rollback) attempted but old image deleted
- Option B (migration rollback) attempted but `downgrade()` has bug
- Must fall back to Option D (Lite-only) and manually fix

---

### Drill 4: Multi-Component Failure

**Focus:** Rollback affecting multiple services

**Scenario:** Both API and database need rollback

**Challenge:**
- Migration broke both schema and application code
- Need to rollback API image AND database migration
- Coordination required (order matters: DB first, then API)

---

## 📅 DRILL CALENDAR

**Q1 Drill (Jan-Mar):** Scenario 1 (Bad Migration) - Basic rollback
**Q2 Drill (Apr-Jun):** Scenario 2 (Bad Image) - Container rollback
**Q3 Drill (Jul-Sep):** Scenario 3 (Data Corruption) - Backup restore
**Q4 Drill (Oct-Dec):** Random scenario chosen 24h before drill

**Rotate roles each quarter** so everyone practices Driver, Observer, Scribe, Decider

---

## ✅ PRE-DRILL CHECKLIST

**1 week before:**
- [ ] Schedule drill (calendar invites sent)
- [ ] Confirm staging environment ready
- [ ] Verify backups exist
- [ ] Test rollback scripts on local dev

**1 day before:**
- [ ] Remind all attendees
- [ ] Share drill scenario (if not surprise drill)
- [ ] Prepare facilitator notes
- [ ] Set up monitoring dashboard

**30 minutes before:**
- [ ] Open video call
- [ ] Share screen (staging dashboard)
- [ ] Confirm all roles assigned
- [ ] Start timer/stopwatch ready

---

## 📝 POST-DRILL REPORT TEMPLATE

```markdown
# FloodWatch Rollback Drill Report

**Date:** ___/___/___
**Scenario:** [Bad migration / Bad image / Data corruption]
**Participants:**
- Decider: _____________
- Driver: _____________
- Observer: _____________
- Scribe: _____________

## Summary

[2-3 sentence summary of drill outcome]

## Timeline

| Time | Event | Duration |
|------|-------|----------|
| T+0 | Incident injected | - |
| T+[X] | Incident detected | [X] min |
| T+[Y] | Rollback decision | [Y-X] min |
| T+[Z] | Rollback complete | [Z-Y] min |
| T+[T] | Verification done | [T-Z] min |

**Total time:** [T] minutes (target: <15min)

## Metrics

- Detection: [X]min (target: <5min) ✅/❌
- Decision: [Y]min (target: <2min) ✅/❌
- Execution: [Z]min (target: <10min) ✅/❌
- Total: [T]min (target: <15min) ✅/❌

## What Went Well

1. _______________
2. _______________
3. _______________

## What Could Be Improved

1. _______________
2. _______________
3. _______________

## Action Items

1. [Priority] [Action] - Owner: _____ - Due: ___/___/___
2. [Priority] [Action] - Owner: _____ - Due: ___/___/___

## Lessons Learned

_______________________________________________

## Next Drill

**Date:** ___/___/___
**Scenario:** _______________
**Focus area:** _______________

## Attachments

- Drill logs: [link]
- Metrics screenshots: [link]
- Communication samples: [link]
```

---

## 🔗 RELATED DOCUMENTS

- **Rollback Playbook:** `infra/ROLLBACK_PLAYBOOK.md`
- **Run Order:** `docs/RUN_ORDER.md`
- **War-room Checklist:** `docs/WAR_ROOM_CHECKLIST.md`
- **Quick Reference:** `infra/QUICK_REFERENCE.md`

---

## 🎯 DRILL SUCCESS DEFINITION

**Gold standard (all must be true):**
- ✅ Total time <15 minutes
- ✅ No data loss
- ✅ Service restored fully or degraded gracefully (Lite-only)
- ✅ All roles executed correctly
- ✅ Communication templates used
- ✅ Post-drill report completed within 24 hours

**Silver standard (acceptable):**
- ✅ Total time <20 minutes
- ✅ Minor data loss (acceptable for drill)
- ✅ Service restored with help from facilitator
- ✅ Most roles executed correctly
- ✅ Some communication delays

**Needs improvement (repeat drill in 2 weeks):**
- ❌ Total time >20 minutes
- ❌ Unable to restore service without significant help
- ❌ Critical steps missed
- ❌ Communication breakdown

---

**🎭 Remember: The drill is supposed to be stressful! That's the point.**

**Better to fail in drill than in production.**

**Last updated:** 2025-11-01
**Next review:** After each quarterly drill
