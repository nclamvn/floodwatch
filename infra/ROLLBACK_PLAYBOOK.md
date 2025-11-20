# FloodWatch - ROLLBACK PLAYBOOK

**Target time: ≤ 10 phút từ quyết định đến hoàn tất**

---

## 🚨 TRIGGER CRITERIA

Rollback NGAY LẬP TỨC nếu:

- ⛔ **Error rate > 5%** trong 10 phút liên tục
- ⛔ **p95 latency > 500ms** trong 15 phút liên tục
- ⛔ **Database connection failures** (không kết nối được DB)
- ⛔ **KTTV scraper failed 3 lần** liên tiếp trong 3 giờ
- ⛔ **Alerts dispatcher down > 30 phút**
- ⛔ **Migration không thể rollback** (data corruption)
- ⛔ **Critical security vulnerability** discovered

Rollback **CÂN NHẮC** nếu:

- ⚠️ Error rate 1-5% trong 30 phút
- ⚠️ p95 latency 200-500ms trong 30 phút
- ⚠️ Khiếu nại người dùng > 10 trong 1 giờ
- ⚠️ Memory leak detected (memory tăng liên tục)

---

## 📋 ROLLBACK CHECKLIST

**Người thực hiện:** _______________
**Thời điểm quyết định:** _____:_____
**Lý do:** _______________

### Pre-Rollback (0-2 phút)

- [ ] **THÔNG BÁO TEAM:** Post vào Slack/Telegram war-room
  ```
  🚨 ROLLBACK INITIATED
  Reason: [error rate 8% / database down / etc]
  ETA: 10 minutes
  Status updates every 2 min
  ```

- [ ] **STOP TRAFFIC VÀO FEATURES MỚI** (nếu có thể)
  ```bash
  # Quick: Redirect /map to /lite (preserves core functionality)
  docker compose -f docker-compose.prod.yml exec nginx bash -c "
  cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
  location = /map { return 302 /lite; }
  EOF
  nginx -s reload
  "
  ```

- [ ] **BACKUP CURRENT STATE** (nếu < 30s)
  ```bash
  ./infra/scripts/prod_backup.sh
  ```

**Checkpoint 1:** _____:_____ (≤ 2 phút từ bắt đầu)

---

### Rollback Execution (2-8 phút)

**Chọn 1 trong 4 phương án dưới đây:**

---

#### OPTION A: Rollback Docker Images (Fastest - 2-3 phút)

**Dùng khi:** Code mới có bug, images cũ vẫn còn

```bash
# 1. Identify previous working tags
docker images | grep floodwatch

# 2. Update docker-compose.prod.yml or pull specific tags
docker compose -f docker-compose.prod.yml pull api:v3-stable web:v3-stable

# 3. Restart with old images
docker compose -f docker-compose.prod.yml up -d api web

# 4. Verify
curl -I https://floodwatch.vn/health
docker compose -f docker-compose.prod.yml logs --tail=50 api
```

**Thời gian:** ~3 phút
**Risk:** Low (images đã test)

- [ ] Images pulled
- [ ] Containers restarted
- [ ] Health check OK
- [ ] Logs clean

**Checkpoint 2A:** _____:_____ (≤ 5 phút từ bắt đầu)

---

#### OPTION B: Rollback Database Migration (3-5 phút)

**Dùng khi:** Migration mới gây lỗi, có thể downgrade an toàn

```bash
# 1. Check current migration
docker compose -f docker-compose.prod.yml exec api alembic current

# 2. Rollback 1 migration
docker compose -f docker-compose.prod.yml exec api alembic downgrade -1

# 3. Restart API (load new schema)
docker compose -f docker-compose.prod.yml restart api

# 4. Verify
curl -s "https://floodwatch.vn/reports?limit=1" | jq .
```

**⚠️ WARNING:**
- Check migration script có `downgrade()` function
- Backup DB trước khi downgrade
- Một số migration KHÔNG THỂ rollback (như drop column chứa data quan trọng)

- [ ] Current migration identified: _______________
- [ ] Downgrade executed
- [ ] API restarted
- [ ] Data integrity verified

**Checkpoint 2B:** _____:_____ (≤ 7 phút từ bắt đầu)

---

#### OPTION C: Restore Database Backup (5-8 phút)

**Dùng khi:** Data bị corrupt, migration không rollback được

```bash
# 1. Stop API (prevent writes during restore)
docker compose -f docker-compose.prod.yml stop api

# 2. Find latest good backup
ls -lt infra/backups/ | head -5

# 3. Restore
./infra/scripts/prod_restore.sh infra/backups/fw_backup_YYYYMMDD_HHMMSS.sql.gz

# 4. Restart all services
docker compose -f docker-compose.prod.yml up -d

# 5. Verify data
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "SELECT COUNT(*) FROM reports;"
```

**⚠️ DATA LOSS:**
- Mất data từ lúc backup đến hiện tại (tối đa 24h nếu backup hàng ngày)
- Cân nhắc kỹ trước khi chọn option này

- [ ] API stopped
- [ ] Backup file identified: _______________
- [ ] Restore completed
- [ ] Services restarted
- [ ] Data count verified

**Checkpoint 2C:** _____:_____ (≤ 10 phút từ bắt đầu)

---

#### OPTION D: Emergency Lite-Only Mode (1-2 phút)

**Dùng khi:** Full system down, cần phục vụ tối thiểu

```bash
# 1. Configure nginx to redirect /map to /lite (automated)
docker compose -f docker-compose.prod.yml exec nginx bash -c "
cat > /etc/nginx/conf.d/emergency_lite_only.conf << 'EOF'
# Emergency lite-only mode - redirect map to lite
location = /map {
    return 302 /lite;
}
location /map/ {
    return 302 /lite;
}
EOF
nginx -s reload
"

# 2. Verify /lite works and /map redirects
curl -I https://floodwatch.vn/lite
curl -I https://floodwatch.vn/map  # Should return 302 redirect

# 3. When ready to restore normal operation:
docker compose -f docker-compose.prod.yml exec nginx bash -c "
rm -f /etc/nginx/conf.d/emergency_lite_only.conf
nginx -s reload
"
```

**TRADE-OFF:**
- ✅ Users can still view reports (read-only)
- ✅ Low resource usage
- ❌ No map view
- ❌ No API access
- ❌ No new reports submission

- [ ] Nginx reconfigured
- [ ] /lite accessible
- [ ] Other endpoints return 503

**Checkpoint 2D:** _____:_____ (≤ 3 phút từ bắt đầu)

---

### Post-Rollback Verification (8-10 phút)

- [ ] **Health check green:**
  ```bash
  curl -s https://floodwatch.vn/health | jq .
  # Expected: {"status":"ok","database":"connected"}
  ```

- [ ] **Error rate dropped:**
  ```bash
  # Check logs for errors in last 5 min
  docker compose -f docker-compose.prod.yml logs --since 5m api | grep -c ERROR
  # Expected: 0 or very low
  ```

- [ ] **Latency normal:**
  ```bash
  # Test response time
  time curl -s https://floodwatch.vn/reports?limit=1 > /dev/null
  # Expected: < 500ms
  ```

- [ ] **Key features working:**
  - [ ] `/health` returns 200
  - [ ] `/lite` loads
  - [ ] `/reports` returns data (if not in lite-only mode)
  - [ ] Database queries working

- [ ] **Metrics recovering:**
  ```bash
  curl -s "https://floodwatch.vn/metrics?token=ADMIN_TOKEN" | grep http_requests_total
  ```

**Checkpoint 3:** _____:_____ (≤ 10 phút từ bắt đầu)

---

## 📢 POST-ROLLBACK COMMUNICATION

### Internal (Immediate)

**Post to war-room (Slack/Telegram):**
```
✅ ROLLBACK COMPLETE
Time: [start] -> [end] ([duration] minutes)
Method: [Option A/B/C/D]
Status: System stable / Lite-only mode
Next steps: [see below]
```

### External (Within 30 phút if public-facing)

**Status page / Social media:**
```
[RESOLVED] FloodWatch experienced technical issues from [time] to [time].
Service has been restored. We apologize for any inconvenience.
All data is safe and up-to-date.
```

**Telegram alert template:**
```
🔴 [RESOLVED] FloodWatch Incident

Thời gian: [HH:MM - HH:MM] ([duration] phút)
Tình trạng: ✅ Đã khôi phục
Phương án: Rollback [A/B/C/D]

Ảnh hưởng: [Lite-only / Full service restored]
Dữ liệu: An toàn, không mất mát

Chi tiết: [link to incident report]
```

**SMS template (for critical stakeholders):**
```
FloodWatch: Sự cố từ [HH:MM-HH:MM] đã được khắc phục.
Hệ thống hoạt động bình thường.
Chi tiết: [short link]
```

---

## 🔍 ROOT CAUSE ANALYSIS (Sau rollback)

**Deadline:** Trong vòng 2 giờ sau rollback

### 1. Thu thập evidence

```bash
# Logs từ thời điểm sự cố
docker compose -f docker-compose.prod.yml logs --since [incident_time] > /tmp/incident_logs.txt

# Metrics snapshot
curl -s "https://floodwatch.vn/metrics?token=ADMIN_TOKEN" > /tmp/metrics_snapshot.txt

# Database state
docker compose -f docker-compose.prod.yml exec db psql -U fw_prod_user -d floodwatch -c "
SELECT version();
SELECT * FROM pg_stat_activity;
SELECT * FROM pg_stat_database WHERE datname='floodwatch';
" > /tmp/db_state.txt
```

### 2. Timeline reconstruction

| Time | Event | Evidence |
|------|-------|----------|
| ___:___ | Deployment started | Git commit: _______ |
| ___:___ | First error appeared | Log: _______ |
| ___:___ | Error rate spiked | Metrics: _______ |
| ___:___ | Rollback initiated | Decision by: _______ |
| ___:___ | Rollback completed | Method: _______ |

### 3. Root cause

**What went wrong:**
_______________________________________________

**Why it wasn't caught in testing:**
_______________________________________________

**Contributing factors:**
- [ ] Code bug
- [ ] Configuration error
- [ ] Database migration issue
- [ ] Infrastructure problem
- [ ] External dependency failure
- [ ] Resource exhaustion
- [ ] Other: _______________

### 4. Prevention measures

**Immediate (trong 24h):**
- [ ] Fix the bug: _______________
- [ ] Add test case: _______________
- [ ] Update monitoring: _______________

**Short-term (trong 1 tuần):**
- [ ] Improve CI/CD: _______________
- [ ] Add safety checks: _______________
- [ ] Update documentation: _______________

**Long-term:**
- [ ] Architecture change: _______________
- [ ] Training: _______________
- [ ] Process improvement: _______________

---

## 📝 INCIDENT REPORT TEMPLATE

```markdown
# Incident Report: [YYYY-MM-DD] FloodWatch Rollback

## Summary
- **Duration:** [start time] to [end time] ([duration])
- **Impact:** [how many users affected, which features down]
- **Severity:** Critical / High / Medium
- **Rollback method:** Option [A/B/C/D]

## Timeline
- [time]: Deployment started (commit: xxx)
- [time]: First signs of trouble (error rate X%)
- [time]: Incident declared
- [time]: Rollback initiated
- [time]: Rollback completed
- [time]: Service fully restored

## Root Cause
[Detailed explanation of what caused the issue]

## Impact
- Users affected: ~X
- Requests failed: Y
- Data loss: None / [describe]
- Downtime: X minutes

## Resolution
[How we fixed it]

## Lessons Learned
**What went well:**
- Quick detection via metrics
- Rollback completed in X minutes
- Good communication

**What could be better:**
- Earlier testing of [feature]
- Better monitoring for [metric]
- Faster decision making

## Action Items
- [ ] [Person]: [Action] - Due: [date]
- [ ] [Person]: [Action] - Due: [date]

## Appendix
- Logs: [link]
- Metrics: [link]
- Code diff: [link]
```

---

## 🎓 ROLLBACK DRILL (Practice quarterly)

**Scenario:** Fake deployment breaks /reports endpoint

**Steps:**
1. Deploy "broken" code to staging
2. Detect via monitoring (should take < 5 min)
3. Declare incident
4. Execute rollback (target: < 10 min)
5. Verify recovery
6. Document learnings

**Success criteria:**
- ✅ Detection < 5 minutes
- ✅ Rollback < 10 minutes
- ✅ No data loss
- ✅ All team members know their roles

---

## 🔗 RELATED DOCUMENTS

- **Runbook:** `docs/RUNBOOK.md`
- **War-room Checklist:** `docs/WAR_ROOM_CHECKLIST.md`
- **Backup/Restore Guide:** `infra/scripts/README.md`
- **Deployment Guide:** `infra/GO_LIVE_CHECKLIST.md`

---

## ⚖️ DECISION MATRIX

| Situation | Option | RTO | Risk | Data Loss | Traffic Impact |
|-----------|--------|-----|------|-----------|----------------|
| Code bug, no DB changes | A: Rollback images | 3min | Low | None | Full restore |
| Migration broke queries | B: Rollback migration | 5min | Med | None* | Full restore |
| Data corruption | C: Restore backup | 8min | High | Yes** | Full restore |
| Full system meltdown | D: Lite-only mode | 2min | Low | N/A*** | 60% capacity (read-only) |

**Notes:**
- *If migration is reversible
- **Data from last backup to now (max 24h if daily backups)
- ***Read-only mode, no new writes accepted

**RTO = Recovery Time Objective** (time to restore service)

---

**🚨 Remember: Better to rollback fast and fix properly later than to debug in production**

**Last updated:** 2025-11-01
**Next drill:** ___/___/___
