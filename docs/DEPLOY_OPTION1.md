# FloodWatch Deployment Guide - Option 1 (API-First)

**Estimated Time:** 2-3 hours
**Recommended For:** Nhanh nhất để đưa hệ thống lên production

---

## Prerequisites

- Ubuntu 22.04+ server (2 CPU, 4GB RAM minimum)
- Domain đã trỏ DNS (ví dụ: `floodwatch.vn`)
- Root/sudo access

---

## Step-by-Step Deployment

### 1. Setup Server (30 phút)

```bash
# SSH vào server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y git docker.io docker-compose nginx certbot python3-certbot-nginx

# Enable Docker
systemctl enable docker
systemctl start docker

# Clone repo
cd /opt
git clone https://github.com/your-org/floodwatch.git
cd floodwatch
```

### 2. Generate Configuration (10 phút)

```bash
cd /opt/floodwatch

# Generate .env.prod
./infra/scripts/generate_secrets.sh

# Edit với thông tin thực tế
nano .env.prod
```

**Điền các giá trị sau:**

```bash
# Database
POSTGRES_USER=floodwatch_prod
POSTGRES_PASSWORD=[generated - giữ nguyên]
POSTGRES_DB=floodwatch_prod

# Admin
ADMIN_TOKEN=[generated - LƯU LẠI TOKEN NÀY]

# Mapbox (REQUIRED)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoibmNsYW12biIsImEiOiJjbWhjNmNvYTkwcG5hMmxuMWMwNHJqZ3l3In0.jGIEWNBpZg7dTLEygPyhlQ

# Cloudinary (Optional - nếu có upload ảnh)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset

# API URL (thay your-domain.com)
NEXT_PUBLIC_API_URL=https://floodwatch.vn

# Telegram (Optional - nếu có bot)
TELEGRAM_BOT_TOKEN=
```

**Save file:** `Ctrl+O`, Enter, `Ctrl+X`

### 3. Configure Nginx (15 phút)

```bash
# Tạo config
nano /etc/nginx/sites-available/floodwatch
```

Paste nội dung sau (thay `your-domain.com`):

```nginx
# API Backend
server {
    listen 80;
    server_name floodwatch.vn;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:8002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Web Frontend
server {
    listen 80;
    server_name www.floodwatch.vn;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Activate và test:**

```bash
ln -s /etc/nginx/sites-available/floodwatch /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4. SSL Certificate (10 phút)

```bash
# Lấy Let's Encrypt certificate
certbot --nginx -d floodwatch.vn -d www.floodwatch.vn

# Chọn:
# 1. Email của bạn
# 2. Agree to terms: Yes
# 3. Redirect HTTP to HTTPS: 2 (Yes)

# Auto-renew
systemctl enable certbot.timer
systemctl start certbot.timer
```

### 5. Deploy Application (30 phút)

```bash
cd /opt/floodwatch

# Deploy
./infra/scripts/deploy_production.sh

# Chờ containers khởi động (2-3 phút)
docker compose -f docker-compose.prod.yml ps

# Kết quả mong đợi:
# db-1   Running (healthy)
# api-1  Running (healthy)
# web-1  Running (healthy)
```

### 6. Run Migrations (5 phút)

```bash
# Apply database migrations
docker compose -f docker-compose.prod.yml exec api \
  alembic upgrade head

# Verify
docker compose -f docker-compose.prod.yml exec db \
  psql -U floodwatch_prod -d floodwatch_prod -c "\dt"

# Kỳ vọng thấy tables: reports, road_events, api_keys, subscriptions, etc.
```

### 7. Load Seed Data (Optional - 5 phút)

```bash
# Nếu muốn data demo ban đầu
docker compose -f docker-compose.prod.yml exec api \
  alembic upgrade 006

# Verify
curl https://floodwatch.vn/api/v1/reports?limit=3
```

### 8. Test Endpoints (10 phút)

```bash
# Health check
curl https://floodwatch.vn/health

# Kỳ vọng:
# {"status":"healthy","db":"connected","timestamp":"..."}

# Test POST community report
curl -X POST https://floodwatch.vn/ingest/community \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "SOS",
    "text": "Test deployment - xin xóa",
    "lat": 16.0544,
    "lon": 108.2022,
    "province": "Đà Nẵng"
  }'

# Kỳ vọng:
# {"status":"success","report_id":"...","trust_score":0.5,...}

# Verify trên web
curl https://floodwatch.vn/api/v1/reports?limit=1
```

### 9. Open Website (2 phút)

Mở browser:

- **API Docs:** https://floodwatch.vn/
- **Map:** https://www.floodwatch.vn/map
- **Routes:** https://www.floodwatch.vn/routes

Kỳ vọng thấy:
- Map hiển thị bình thường
- Sidebar có "X báo cáo"
- Markers trên map (nếu đã load seed data)

---

## Verification Checklist

```bash
# Chạy smoke test
cd /opt/floodwatch
./infra/scripts/smoke_test.sh

# Kỳ vọng: ✅ PASS tất cả tests
```

**Manual checks:**

- [ ] https://floodwatch.vn/health → HTTP 200
- [ ] https://www.floodwatch.vn/map → Map hiển thị
- [ ] POST /ingest/community → HTTP 200
- [ ] POST /ingest/road-event → HTTP 200
- [ ] SSL certificate valid (không warning browser)
- [ ] Logs không có ERROR: `docker compose -f docker-compose.prod.yml logs api`

---

## Post-Deployment

### Monitor Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# API only
docker compose -f docker-compose.prod.yml logs -f api

# Web only
docker compose -f docker-compose.prod.yml logs -f web
```

### Setup Log Rotation

```bash
# Copy logrotate config
cp infra/logrotate/floodwatch /etc/logrotate.d/
logrotate -f /etc/logrotate.d/floodwatch
```

### Setup Monitoring (Optional)

```bash
# UptimeRobot
# Add monitor: https://floodwatch.vn/health
# Interval: 5 minutes

# Prometheus (nếu có)
# Add target: https://floodwatch.vn/metrics
```

---

## Sharing with Partners

### API Documentation

Gửi link cho partners/integrators:

```
📚 API Documentation:
https://floodwatch.vn/

🔗 Endpoints:
- POST https://floodwatch.vn/ingest/community
- POST https://floodwatch.vn/ingest/road-event
- POST https://floodwatch.vn/ingest/alerts

📖 Full Guide:
https://github.com/your-org/floodwatch/blob/main/docs/API_INGESTION_GUIDE.md
```

### Test Data

Cung cấp file test để partners thử:

```bash
# test_community.json
{
  "type": "SOS",
  "text": "Gia đình cần cứu trợ khẩn cấp",
  "lat": 16.0544,
  "lon": 108.2022,
  "province": "Đà Nẵng",
  "district": "Hòa Vang"
}

# Test command
curl -X POST https://floodwatch.vn/ingest/community \
  -H 'Content-Type: application/json' \
  -d @test_community.json
```

---

## Troubleshooting

### Issue 1: Containers không start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs db
docker compose -f docker-compose.prod.yml logs api

# Common fix: reset volumes
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

### Issue 2: SSL certificate failed

```bash
# Xác nhận DNS đã trỏ đúng
dig floodwatch.vn +short
# Kỳ vọng: IP của server

# Thử lại certbot
certbot --nginx -d floodwatch.vn -d www.floodwatch.vn --force-renewal
```

### Issue 3: Map không hiển thị

```bash
# Check NEXT_PUBLIC_MAPBOX_TOKEN trong .env.prod
grep MAPBOX /opt/floodwatch/.env.prod

# Restart web container
docker compose -f docker-compose.prod.yml restart web
```

### Issue 4: POST endpoint trả về 500

```bash
# Check API logs
docker compose -f docker-compose.prod.yml logs api | tail -50

# Verify database connection
docker compose -f docker-compose.prod.yml exec api \
  python -c "from app.database import engine; print(engine.url)"
```

---

## Maintenance

### Daily

```bash
# Check logs for errors
docker compose -f docker-compose.prod.yml logs api | grep ERROR

# Monitor disk usage
df -h
```

### Weekly

```bash
# Backup database
./infra/scripts/prod_backup.sh

# Review metrics
curl https://floodwatch.vn/metrics
```

### Monthly

```bash
# Update dependencies (nếu có security patches)
cd /opt/floodwatch
git pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## Scaling (When Needed)

### Scenario 1: Traffic cao (>10k requests/hour)

```bash
# Add nginx caching
# Edit /etc/nginx/sites-available/floodwatch
# Thêm:
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;

location /api/v1/reports {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_pass http://localhost:8002;
}
```

### Scenario 2: Database slow

```bash
# Add read replica
# Xem: docs/SCALING_GUIDE.md (tạo sau nếu cần)
```

---

## Success Metrics (Tuần đầu)

Track các metrics sau:

| Metric | Target | Check |
|--------|--------|-------|
| Uptime | > 99% | UptimeRobot |
| API p95 latency | < 200ms | `/metrics` |
| Error rate | < 1% | Logs |
| Reports ingested | > 0/day | Dashboard |

---

## Next Steps

Sau khi deploy thành công:

1. **Week 1:** Invite partners để test API
2. **Week 2:** Tích hợp mobile app / KTTV webhook
3. **Week 3:** Monitor & optimize based on real traffic

**Congratulations! 🎉 Hệ thống đã live với dữ liệu real-time.**

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Production URL:** https://floodwatch.vn
**Admin Token:** _____________ (LƯU MẬT)
