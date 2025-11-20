# 🚀 Hướng dẫn Deploy FloodWatch lên Production

## Checklist trước khi deploy

- [ ] Domain đã trỏ về server (nclam.site → 188.166.248.10)
- [ ] SSL certificate đã setup (Cloudflare hoặc Let's Encrypt)
- [ ] Firewall mở port 80, 443
- [ ] Backup dữ liệu hiện tại (nếu có)

---

## Bước 1: Chuẩn bị Server

### 1.1. SSH vào server

```bash
ssh root@188.166.248.10
```

### 1.2. Cài đặt dependencies

```bash
# Update system
apt update && apt upgrade -y

# Cài Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Cài Docker Compose
apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### 1.3. Tạo directories

```bash
mkdir -p /root/floodwatch
mkdir -p /var/log/floodwatch
mkdir -p /var/backups/floodwatch
```

---

## Bước 2: Deploy Code

### 2.1. Clone repository (nếu dùng Git)

```bash
cd /root
git clone <your-repo-url> floodwatch
cd floodwatch
```

### 2.2. Hoặc upload code qua SCP

Từ máy local:
```bash
scp -r /Users/mac/floodwatch root@188.166.248.10:/root/
```

---

## Bước 3: Cấu hình Environment

### 3.1. Tạo file .env

```bash
cd /root/floodwatch
nano .env
```

Nội dung:
```env
# API Configuration
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://floodwatch:STRONG_PASSWORD_HERE@db:5432/floodwatch_prod
ADMIN_TOKEN=RANDOM_SECURE_TOKEN_HERE
CORS_ORIGINS=https://nclam.site

# Database
POSTGRES_USER=floodwatch
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
POSTGRES_DB=floodwatch_prod

# Frontend
NEXT_PUBLIC_API_URL=https://nclam.site
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoibmNsYW12biIsImEiOiJjbWhjNmNvYTkwcG5hMmxuMWMwNHJqZ3l3In0.jGIEWNBpZg7dTLEygPyhlQ

# Optional: Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Optional: Cloudinary (for image uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset
```

**⚠️ Lưu ý:**
- Thay `STRONG_PASSWORD_HERE` bằng password thật sự (dùng `openssl rand -base64 32`)
- Thay `RANDOM_SECURE_TOKEN_HERE` bằng token ngẫu nhiên

### 3.2. Generate secure passwords

```bash
# Password cho database
openssl rand -base64 32

# Admin token
openssl rand -hex 32
```

---

## Bước 4: Setup Docker Compose cho Production

### 4.1. Tạo docker-compose.prod.yml

```yaml
version: '3.9'

services:
  db:
    image: postgis/postgis:15-3.4
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ENVIRONMENT: ${ENVIRONMENT}
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      CORS_ORIGINS: ${CORS_ORIGINS}
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - internal
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`nclam.site`) && PathPrefix(`/api`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        NEXT_PUBLIC_MAPBOX_TOKEN: ${NEXT_PUBLIC_MAPBOX_TOKEN}
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    depends_on:
      api:
        condition: service_healthy
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`nclam.site`)"
      - "traefik.http.routers.web.entrypoints=websecure"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"

  # Reverse Proxy với SSL
  traefik:
    image: traefik:v2.10
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@nclam.site"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certs:/letsencrypt
    networks:
      - web

networks:
  internal:
    internal: true
  web:
    external: false

volumes:
  postgres_data:
  traefik_certs:
```

---

## Bước 5: Build & Deploy

### 5.1. Build images

```bash
cd /root/floodwatch
docker compose -f docker-compose.prod.yml build
```

### 5.2. Start services

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 5.3. Check logs

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Đợi cho đến khi thấy:
```
api-1  | 🚀 FloodWatch API v2.0.0 started successfully
web-1  | ▲ Next.js 14.1.3
web-1  | - Local:        http://localhost:3000
```

---

## Bước 6: Run Migrations & Seed Data

### 6.1. Run database migrations

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### 6.2. (Optional) Seed initial data

Nếu muốn có data mẫu:
```bash
docker compose -f docker-compose.prod.yml exec api python -c "
from app.database import get_db_context
# ... seed code here
"
```

---

## Bước 7: Setup Cron Jobs

### 7.1. Copy scripts

```bash
chmod +x /root/floodwatch/ops/*.sh
```

### 7.2. Install crontab

```bash
crontab /root/floodwatch/ops/crontab.txt
```

Hoặc edit thủ công:
```bash
crontab -e
```

### 7.3. Verify cron jobs

```bash
crontab -l
```

---

## Bước 8: Verify Deployment

### 8.1. Test endpoints

```bash
# Health check
curl https://nclam.site/health

# API
curl https://nclam.site/reports?limit=5

# Web
curl https://nclam.site
```

### 8.2. Test từ browser

Mở: **https://nclam.site/map**

Kiểm tra:
- [ ] Bản đồ hiển thị đúng
- [ ] Reports load được
- [ ] Markers hiển thị trên map
- [ ] Sidebar/bottom sheet hoạt động

---

## Bước 9: Setup Monitoring

Làm theo hướng dẫn trong `ops/MONITORING_SETUP.md`:

1. Đăng ký UptimeRobot
2. Tạo monitors cho:
   - https://nclam.site/health
   - https://nclam.site/map
3. Setup Telegram alerts

---

## Bước 10: Post-Deploy Checklist

- [ ] SSL certificate hoạt động (https://)
- [ ] API trả về data đúng
- [ ] Web frontend load nhanh
- [ ] Cron jobs chạy và log ra file
- [ ] Database backup chạy tự động
- [ ] Monitoring alerts hoạt động
- [ ] Health check endpoint trả về status OK
- [ ] Disk space đủ (ít nhất 20GB free)

---

## Rollback Plan (Nếu có vấn đề)

### Cách 1: Rollback code

```bash
cd /root/floodwatch
git checkout <previous-commit-hash>
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### Cách 2: Restore database từ backup

```bash
# Stop API
docker compose -f docker-compose.prod.yml stop api

# Restore database
gunzip < /var/backups/floodwatch/floodwatch_20250118.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U floodwatch floodwatch_prod

# Restart API
docker compose -f docker-compose.prod.yml start api
```

---

## Maintenance Tips

### Update code

```bash
cd /root/floodwatch
git pull
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### View logs

```bash
# Real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Ingestion logs
tail -f /var/log/floodwatch/ingestion.log
```

### Database access

```bash
docker compose -f docker-compose.prod.yml exec db psql -U floodwatch floodwatch_prod
```

### Restart services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart api
```

---

## Troubleshooting

### Issue: Cannot connect to database

**Solution:**
```bash
docker compose -f docker-compose.prod.yml logs db
docker compose -f docker-compose.prod.yml restart db
```

### Issue: API returns 500 errors

**Solution:**
```bash
docker compose -f docker-compose.prod.yml logs api --tail 100
# Check for Python errors, fix and rebuild
```

### Issue: Web is slow

**Solution:**
```bash
# Check if running in dev mode
docker compose -f docker-compose.prod.yml exec web env | grep NODE_ENV
# Should be: NODE_ENV=production

# If not, rebuild with production mode
docker compose -f docker-compose.prod.yml up -d --build web
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Firewall configured (ufw allow 80,443)
- [ ] SSH key-only authentication
- [ ] Docker socket not exposed
- [ ] Secrets not in Git repository
- [ ] Database not exposed to public
- [ ] CORS properly configured
- [ ] API rate limiting enabled
- [ ] Regular security updates

---

**Người deploy:** _______________
**Ngày deploy:** _______________
**Version:** v2.0.0
