# 🚀 FloodWatch Deployment Guide - nclam.site

**Domain:** nclam.site (GoDaddy)
**Estimated Time:** 2-3 hours
**Target:** Production deployment with real-time data

---

## ⚠️ Thông Tin Cần Thiết

Trước khi bắt đầu, cung cấp:

- [ ] **Server IP Address:** `___.___.___.___`
- [ ] **SSH Username:** (root hoặc ubuntu?)
- [ ] **OS Confirmed:** Ubuntu 22.04+ (hoặc version khác?)

**Sau khi có 3 thông tin trên, tôi sẽ generate các lệnh pre-filled cho bạn.**

---

## 📋 Deployment Architecture

```
┌─────────────────────────────────────┐
│     nclam.site (GoDaddy DNS)        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│    Your Server (Ubuntu 22.04+)      │
│  ┌──────────────────────────────┐   │
│  │   Nginx (Reverse Proxy)      │   │
│  │   - SSL/HTTPS (Let's Encrypt)│   │
│  │   - nclam.site → API (8002)  │   │
│  │   - www.nclam.site → Web     │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │   Docker Containers          │   │
│  │   - db (PostgreSQL+PostGIS)  │   │
│  │   - api (FastAPI)            │   │
│  │   - web (Next.js)            │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🌐 URLs After Deployment

- **API Backend:** https://nclam.site
  - Health: https://nclam.site/health
  - Docs: https://nclam.site/
  - Ingest: https://nclam.site/ingest/community

- **Web Frontend:** https://www.nclam.site
  - Map: https://www.nclam.site/map
  - Routes: https://www.nclam.site/routes
  - Report: https://www.nclam.site/report

---

## 📝 Step 1: GoDaddy DNS Setup (10 minutes)

### Login to GoDaddy

1. Đăng nhập: https://dcc.godaddy.com/
2. Vào **Domains** → Click `nclam.site`
3. Scroll xuống **DNS Management**

### Add DNS Records

**Xóa các records cũ (nếu có) và thêm mới:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `YOUR_SERVER_IP` | 600 |
| A | www | `YOUR_SERVER_IP` | 600 |
| CNAME | api | nclam.site | 600 |

**Example:**
```
A     @     123.45.67.89    600
A     www   123.45.67.89    600
CNAME api   nclam.site      600
```

### Verify DNS (Wait 5-10 minutes)

```bash
# Kiểm tra DNS đã trỏ đúng chưa
dig nclam.site +short
dig www.nclam.site +short

# Kỳ vọng: Trả về IP của server
```

⚠️ **Quan trọng:** Chờ DNS propagate (5-30 phút) trước khi chạy certbot (bước SSL)

---

## 📝 Step 2: Server Preparation (30 minutes)

Sau khi có **Server IP**, tôi sẽ generate các lệnh này với thông tin đã điền:

```bash
# SSH vào server
ssh YOUR_USER@YOUR_SERVER_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose

# Install Nginx & Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Install Git
sudo apt install -y git

# Verify installations
docker --version
docker-compose --version
nginx -v
certbot --version
```

---

## 📝 Step 3: Clone & Configure (15 minutes)

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/your-org/floodwatch.git
# (Hoặc nếu đã có local, scp lên server)

cd /opt/floodwatch

# Generate secrets
sudo ./infra/scripts/generate_secrets.sh

# Copy và edit .env.prod
sudo cp .env.prod .env.prod.backup
```

### Edit .env.prod

```bash
sudo nano .env.prod
```

**Điền các giá trị sau:**

```bash
# Database (giữ nguyên generated)
POSTGRES_USER=floodwatch_prod
POSTGRES_PASSWORD=<GENERATED - DO NOT CHANGE>
POSTGRES_DB=floodwatch_prod
DATABASE_URL=postgresql://floodwatch_prod:<PASSWORD>@db:5432/floodwatch_prod

# Admin Token (LƯU LẠI TOKEN NÀY)
ADMIN_TOKEN=<GENERATED - SAVE THIS>

# API URL (QUAN TRỌNG - Thay đổi)
NEXT_PUBLIC_API_URL=https://nclam.site

# Mapbox (Đã có)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoibmNsYW12biIsImEiOiJjbWhjNmNvYTkwcG5hMmxuMWMwNHJqZ3l3In0.jGIEWNBpZg7dTLEygPyhlQ

# Cloudinary (Optional - nếu có)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=

# Environment
ENVIRONMENT=production
```

**Save:** `Ctrl+O`, Enter, `Ctrl+X`

---

## 📝 Step 4: Nginx Configuration (10 minutes)

```bash
# Tạo nginx config cho nclam.site
sudo nano /etc/nginx/sites-available/nclam.site
```

**Paste nội dung sau:**

```nginx
# API Backend (nclam.site)
server {
    listen 80;
    server_name nclam.site api.nclam.site;

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

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Web Frontend (www.nclam.site)
server {
    listen 80;
    server_name www.nclam.site;

    location / {
        proxy_pass http://localhost:3002;
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
```

**Activate và test:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/nclam.site /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Verify nginx is running
sudo systemctl status nginx
```

---

## 📝 Step 5: SSL Certificate (10 minutes)

⚠️ **Chỉ chạy sau khi DNS đã propagate (dig nclam.site trả về IP đúng)**

```bash
# Get Let's Encrypt SSL certificate
sudo certbot --nginx -d nclam.site -d www.nclam.site -d api.nclam.site

# Làm theo hướng dẫn:
# 1. Nhập email
# 2. Agree to terms: Yes (Y)
# 3. Share email: No (N)
# 4. Redirect HTTP to HTTPS: Yes (2)

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

---

## 📝 Step 6: Deploy Application (30 minutes)

```bash
cd /opt/floodwatch

# Deploy
sudo ./infra/scripts/deploy_production.sh

# Chờ containers start (2-3 phút)
sudo docker-compose -f docker-compose.prod.yml ps

# Kết quả mong đợi:
# NAME               STATUS
# floodwatch-db-1    Up (healthy)
# floodwatch-api-1   Up (healthy)
# floodwatch-web-1   Up (healthy)
```

### Run Database Migrations

```bash
# Apply migrations
sudo docker-compose -f docker-compose.prod.yml exec api \
  alembic upgrade head

# Load seed data (optional - 8 demo reports)
sudo docker-compose -f docker-compose.prod.yml exec api \
  alembic upgrade 006
```

---

## 📝 Step 7: Verification (10 minutes)

### Test Health Endpoint

```bash
# From server
curl https://nclam.site/health

# Expected response:
# {"status":"ok","service":"floodwatch-api","version":"2.0.0","database":"connected"}
```

### Test POST Endpoint

```bash
# Test community report
curl -X POST https://nclam.site/ingest/community \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "SOS",
    "text": "Test deployment - xin xóa",
    "lat": 16.0544,
    "lon": 108.2022,
    "province": "Đà Nẵng"
  }'

# Expected:
# {"status":"success","report_id":"...","trust_score":0.5,...}
```

### Test Web UI

Mở browser và truy cập:

1. **API Docs:** https://nclam.site/
2. **Map:** https://www.nclam.site/map
3. **Routes:** https://www.nclam.site/routes

✅ **Checklist:**
- [ ] Map hiển thị bình thường (Mapbox)
- [ ] Sidebar có "X báo cáo"
- [ ] SSL certificate valid (khóa xanh)
- [ ] Không có console errors

---

## 📝 Step 8: Run Smoke Test

```bash
cd /opt/floodwatch
sudo ./infra/scripts/smoke_test.sh
```

**Expected:** ✅ ALL TESTS PASS

---

## 🎉 Deployment Complete!

### Your URLs

- 🌐 **Website:** https://www.nclam.site/map
- 🔧 **API:** https://nclam.site/health
- 📚 **Docs:** https://nclam.site/

### Next Steps

1. **Share API với partners:**
   ```
   API Endpoint: https://nclam.site/ingest/community
   Documentation: docs/API_INGESTION_GUIDE.md
   Test Files: examples/api_test/*.json
   ```

2. **Setup Monitoring:**
   - Add to UptimeRobot: https://nclam.site/health
   - Check logs: `sudo docker-compose -f docker-compose.prod.yml logs -f api`

3. **Real Data (Optional - sau khi deploy):**
   - Setup KTTV webhook → https://nclam.site/ingest/alerts
   - Mobile app → https://nclam.site/ingest/community
   - News scraper → https://nclam.site/ingest/road-event

---

## 🔧 Maintenance Commands

```bash
# View logs
sudo docker-compose -f docker-compose.prod.yml logs -f api
sudo docker-compose -f docker-compose.prod.yml logs -f web

# Restart services
sudo docker-compose -f docker-compose.prod.yml restart api
sudo docker-compose -f docker-compose.prod.yml restart web

# Backup database
sudo ./infra/scripts/prod_backup.sh

# Update code (nếu có changes)
cd /opt/floodwatch
sudo git pull
sudo docker-compose -f docker-compose.prod.yml build --no-cache
sudo docker-compose -f docker-compose.prod.yml up -d
```

---

## 🆘 Troubleshooting

### Issue: DNS không resolve

```bash
# Check DNS
dig nclam.site +short
dig www.nclam.site +short

# Nếu không trả về IP → chờ propagate (5-30 phút)
# Hoặc clear GoDaddy cache: contact support
```

### Issue: Certbot failed

```bash
# Verify nginx config
sudo nginx -t

# Verify DNS trỏ đúng
curl -I http://nclam.site

# Try again with verbose
sudo certbot --nginx -d nclam.site -d www.nclam.site --dry-run -v
```

### Issue: Containers không start

```bash
# Check logs
sudo docker-compose -f docker-compose.prod.yml logs db
sudo docker-compose -f docker-compose.prod.yml logs api

# Reset và retry
sudo docker-compose -f docker-compose.prod.yml down -v
sudo docker-compose -f docker-compose.prod.yml up -d
```

### Issue: Map không hiển thị

```bash
# Check Mapbox token
sudo grep MAPBOX /opt/floodwatch/.env.prod

# Restart web
sudo docker-compose -f docker-compose.prod.yml restart web

# Check web logs
sudo docker-compose -f docker-compose.prod.yml logs web
```

---

## 📞 Ready to Deploy?

**Cung cấp cho tôi:**

1. **Server IP:** `___.___.___.___`
2. **SSH User:** `root` hoặc `ubuntu`?
3. **OS:** Ubuntu 22.04+ (confirmed?)

→ Tôi sẽ tạo **one-line deployment script** với tất cả commands pre-filled!

---

**Deployment Date:** _____________
**Server IP:** _____________
**Admin Token:** _____________ (LƯU MẬT)
**SSL Valid Until:** _____________ (Auto-renews)
