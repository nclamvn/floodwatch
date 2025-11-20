# 🔍 Hướng dẫn Setup Monitoring cho FloodWatch

## Mục tiêu
Đảm bảo hệ thống **không chết âm thầm** khi có mưa lũ thật sự xảy ra.

---

## 1. Giám sát Uptime với UptimeRobot (Free)

### Bước 1: Đăng ký tài khoản
1. Truy cập: https://uptimerobot.com
2. Đăng ký free account (hỗ trợ 50 monitors)

### Bước 2: Tạo monitors

#### Monitor 1: API Health Check
- **Type:** HTTP(s)
- **URL:** `https://nclam.site/health`
- **Monitoring Interval:** 5 minutes
- **Alert When:** Down
- **Alert Contacts:** Email của bạn

**Expected Response:**
```json
{
  "status": "ok",
  "service": "floodwatch-api",
  "database": "connected"
}
```

#### Monitor 2: Web Frontend
- **Type:** HTTP(s)
- **URL:** `https://nclam.site/map`
- **Monitoring Interval:** 5 minutes
- **Keyword to check:** `Theo dõi mưa lũ`

#### Monitor 3: API Response Time
- **Type:** HTTP(s)
- **URL:** `https://nclam.site/reports?limit=1`
- **Alert When:** Response time > 2000ms

### Bước 3: Cài đặt alert channels

**Email Notification:**
- Mặc định đã có qua email đăng ký

**Telegram Notification (Recommended):**
1. Tạo bot Telegram:
   - Nhắn `/start` với @BotFather
   - Tạo bot mới: `/newbot`
   - Lưu token
2. Lấy Chat ID của bạn:
   - Nhắn tin với bot vừa tạo
   - Truy cập: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Tìm `chat.id`
3. Trong UptimeRobot:
   - Vào Settings → Alert Contacts
   - Add Telegram integration
   - Nhập bot token và chat ID

---

## 2. Log Monitoring (Tùy chọn nâng cao)

### Cách 1: Log qua file trên server

```bash
# Xem log real-time
tail -f /var/log/floodwatch/ingestion.log

# Xem log errors
grep ERROR /var/log/floodwatch/*.log

# Thống kê số reports đã ingest hôm nay
grep "Successfully ingested" /var/log/floodwatch/kttv.log | wc -l
```

### Cách 2: Tích hợp BetterStack (Free tier: 1GB/month)

1. Đăng ký: https://betterstack.com/logs
2. Tạo source → Docker logs
3. Cài agent trên server:

```bash
curl -X POST https://in.logs.betterstack.com/...
```

4. Config docker-compose để forward logs:

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        tag: "floodwatch-api"
```

---

## 3. Database Health Check

### Script kiểm tra tự động

Tạo file `/root/floodwatch/ops/health_check.sh`:

```bash
#!/bin/bash
# Health check tổng hợp

PROJECT_DIR="/root/floodwatch"
cd "$PROJECT_DIR"

echo "=== FloodWatch Health Check ==="
echo "Time: $(date)"
echo ""

# 1. Check containers
echo "📦 Container Status:"
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo ""

# 2. Check database
echo "💾 Database Status:"
docker compose exec -T db pg_isready -U postgres
echo ""

# 3. Check API
echo "🔌 API Health:"
curl -sf http://localhost:8000/health | jq .
echo ""

# 4. Check recent data
echo "📊 Recent Reports (last 1 hour):"
docker compose exec -T db psql -U postgres -d floodwatch_prod -c \
  "SELECT COUNT(*) FROM reports WHERE created_at > NOW() - INTERVAL '1 hour';"
echo ""

# 5. Check disk space
echo "💿 Disk Usage:"
df -h / | grep -v Filesystem
echo ""

echo "=== Health Check Complete ==="
```

Chạy thủ công: `./ops/health_check.sh`

Hoặc thêm vào cron (mỗi giờ):
```cron
0 * * * * /root/floodwatch/ops/health_check.sh >> /var/log/floodwatch/health.log 2>&1
```

---

## 4. Alert Rules

### Kịch bản cần alert ngay:

1. **API down > 5 phút**
   - UptimeRobot sẽ tự động alert

2. **Database connection failed**
   - Trong health check endpoint đã check

3. **Không có data mới trong 2 giờ**
   - Có thể viết script check:
   ```bash
   # Kiểm tra xem có report nào trong 2h qua không
   RECENT_COUNT=$(docker compose exec -T db psql -U postgres -d floodwatch_prod -tAc \
     "SELECT COUNT(*) FROM reports WHERE created_at > NOW() - INTERVAL '2 hours';")

   if [ "$RECENT_COUNT" -eq 0 ]; then
       echo "WARNING: No new reports in last 2 hours!" | \
         mail -s "FloodWatch Data Alert" admin@example.com
   fi
   ```

4. **Disk space < 20%**
   - Trong health_check.sh đã có

---

## 5. Dashboard Monitoring (Tùy chọn)

Nếu muốn dashboard đẹp mắt, có thể dùng:

### Grafana + Prometheus (Free, self-hosted)

**Metrics cần track:**
- API response time (p50, p95, p99)
- Request rate (requests/minute)
- Error rate (%)
- Database query time
- Number of active reports
- Ingest success rate

**Setup nhanh:**
1. Thêm vào docker-compose.yml:
```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./ops/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

2. Access Grafana: `http://nclam.site:3001`

---

## 6. Checklist Setup Nhanh (30 phút)

- [ ] Đăng ký UptimeRobot
- [ ] Tạo 3 monitors (Health / Map / API)
- [ ] Cài Telegram alert
- [ ] Test alert bằng cách stop API container
- [ ] Tạo script health_check.sh
- [ ] Chạy thử health check
- [ ] Đọc log hàng ngày trong 1 tuần đầu

---

## 7. Runbook - Khi có Alert

### Alert: "API is down"

1. SSH vào server:
   ```bash
   ssh root@188.166.248.10
   ```

2. Check containers:
   ```bash
   cd /root/floodwatch
   docker compose ps
   ```

3. Nếu API stopped:
   ```bash
   docker compose logs api --tail 50
   docker compose restart api
   ```

4. Nếu database có vấn đề:
   ```bash
   docker compose logs db --tail 50
   docker compose restart db
   ```

5. Check lại health:
   ```bash
   curl http://localhost:8000/health
   ```

### Alert: "No new data in 2 hours"

1. Check ingestion logs:
   ```bash
   tail -50 /var/log/floodwatch/kttv.log
   tail -50 /var/log/floodwatch/roads.log
   ```

2. Chạy thử ingestion thủ công:
   ```bash
   ./ops/run_ingestion.sh kttv
   ```

3. Nếu fail, check:
   - API endpoint có accessible không?
   - Nguồn dữ liệu (nchmf.gov.vn) có down không?

---

## 8. Contact & Escalation

**Level 1 (Tự resolve):**
- Restart containers
- Check logs
- Run health check

**Level 2 (Cần support):**
- Post vào Slack/Telegram team channel
- Tag @dev-team

**Level 3 (Urgent - Hệ thống chết hoàn toàn):**
- Call hotline: XXX-XXX-XXXX

---

**Cập nhật lần cuối:** 18/11/2025
