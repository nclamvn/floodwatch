# 🚀 HƯỚNG DẪN DEPLOYMENT - FLOODWATCH

Tài liệu hướng dẫn deploy FloodWatch lên production để công khai cho nhiều người truy cập.

---

## 📋 MỤC LỤC

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Chuẩn bị trước khi deploy](#chuẩn-bị-trước-khi-deploy)
3. [Cấu hình môi trường](#cấu-hình-môi-trường)
4. [Deploy lên server](#deploy-lên-server)
5. [Kiểm tra sau khi deploy](#kiểm-tra-sau-khi-deploy)
6. [Monitoring và bảo trì](#monitoring-và-bảo-trì)
7. [Troubleshooting](#troubleshooting)

---

## 🖥️ YÊU CẦU HỆ THỐNG

### Server Requirements
- **OS:** Ubuntu 20.04+ hoặc CentOS 8+
- **RAM:** Tối thiểu 4GB (khuyến nghị 8GB+)
- **CPU:** 2 cores (khuyến nghị 4+ cores)
- **Disk:** 50GB+ SSD
- **Network:** Băng thông ổn định, IP tĩnh

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Nginx (cho reverse proxy)
- Certbot (cho SSL/TLS)
- Git (để clone code)

### Domain & DNS
- Tên miền đã đăng ký (VD: floodwatch.vn)
- DNS đã trỏ về IP server
- SSL certificate (sẽ tạo tự động bằng Let's Encrypt)

---

## 🔧 CHUẨN BỊ TRƯỚC KHI DEPLOY

### 1. Tạo lại tất cả API Keys

**🚨 QUAN TRỌNG:** Các API key trong file `.env` hiện tại đã bị lộ, PHẢI tạo lại trước khi deploy!

#### Telegram Bot Token
1. Mở Telegram, tìm `@BotFather`
2. Gửi `/revoke` để thu hồi token cũ
3. Gửi `/newbot` hoặc chọn bot hiện tại
4. Lưu token mới

#### MapTiler API Key
1. Đăng nhập https://www.maptiler.com/cloud/
2. Vào **API Keys**
3. Xóa key cũ
4. Tạo key mới với domain production
5. Lưu key mới

#### Mapbox Token (nếu dùng)
1. Đăng nhập https://account.mapbox.com/
2. Vào **Access tokens**
3. Revoke token cũ
4. Tạo token mới
5. Lưu token mới

### 2. Tạo Admin Token mạnh

```bash
# Tạo token ngẫu nhiên 32 ký tự
openssl rand -hex 32
```

Lưu token này, sẽ dùng cho `.env.production`

### 3. Tạo mật khẩu Database mạnh

```bash
# Tạo password ngẫu nhiên
openssl rand -base64 32
```

---

## ⚙️ CẤU HÌNH MÔI TRƯỜNG

### 1. Tạo file .env.production

```bash
# Copy template
cp .env.production.template .env.production

# Edit file
nano .env.production
```

### 2. Điền thông tin vào .env.production

```bash
# CRITICAL - Đổi các giá trị này!
ADMIN_TOKEN=<your-strong-admin-token-from-step-2>
POSTGRES_PASSWORD=<your-strong-db-password>
TELEGRAM_BOT_TOKEN=<new-telegram-token>
NEXT_PUBLIC_MAPTILER_KEY=<new-maptiler-key>
NEXT_PUBLIC_MAPBOX_TOKEN=<new-mapbox-token>

# Application Config
ENVIRONMENT=production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-domain.com/api
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Database
POSTGRES_DB=floodwatch_prod
DATABASE_URL=postgresql+psycopg://postgres:<password>@db:5432/floodwatch_prod
```

### 3. Xác minh .env.production không commit vào git

```bash
# Kiểm tra .gitignore
cat .gitignore | grep ".env.production"

# Nếu chưa có, thêm vào
echo ".env.production" >> .gitignore
```

---

## 🚀 DEPLOY LÊN SERVER

### Bước 1: Chuẩn bị server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Bước 2: Clone code

```bash
# Clone repository (hoặc copy code qua SCP/FTP)
cd /var/www
sudo git clone <your-repo-url> floodwatch
cd floodwatch

# Set permissions
sudo chown -R $USER:$USER .
```

### Bước 3: Upload .env.production

```bash
# Copy .env.production từ máy local lên server
# Sử dụng SCP hoặc FTP
scp .env.production user@your-server:/var/www/floodwatch/
```

### Bước 4: Build và chạy production

```bash
cd /var/www/floodwatch

# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Bước 5: Chạy database migrations

```bash
# Chờ database khởi động (30 giây)
sleep 30

# Run migrations
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### Bước 6: Cấu hình Nginx

```bash
# Install Nginx
sudo apt install nginx -y

# Create config
sudo nano /etc/nginx/sites-available/floodwatch
```

Nội dung file `/etc/nginx/sites-available/floodwatch`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS (sau khi có SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/floodwatch /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Bước 7: Cài đặt SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot sẽ tự động cấu hình nginx cho HTTPS
```

---

## ✅ KIỂM TRA SAU KHI DEPLOY

### 1. Kiểm tra services đang chạy

```bash
docker-compose -f docker-compose.prod.yml ps
```

Tất cả services phải ở trạng thái `Up` và `healthy`.

### 2. Kiểm tra logs

```bash
# Check all logs
docker-compose -f docker-compose.prod.yml logs --tail=100

# Check specific service
docker-compose -f docker-compose.prod.yml logs web
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs db
```

### 3. Test các tính năng chính

Mở trình duyệt và test:

- [ ] **Homepage:** https://your-domain.com
- [ ] **Map:** https://your-domain.com/map
  - [ ] Map hiển thị đúng
  - [ ] Markers xuất hiện
  - [ ] Clustering hoạt động
  - [ ] Popup hiển thị khi click marker
- [ ] **News Ticker:** Có hiển thị ở dưới cùng
- [ ] **Media Carousel:** Có hiển thị với ảnh
- [ ] **Sidebar:** Hiển thị tin cập nhật
- [ ] **My Location:** Button hoạt động
- [ ] **Layer Control:** Toggle layers hoạt động
- [ ] **Legend:** Mở/đóng được, click ngoài đóng popup
- [ ] **Mobile:** Test trên điện thoại

### 4. Test API Health

```bash
# Health check
curl https://your-domain.com/api/health

# Should return:
# {"status":"ok","service":"floodwatch-api","version":"2.0.0",...}
```

### 5. Test Security Headers

```bash
curl -I https://your-domain.com

# Kiểm tra response headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000
```

---

## 📊 MONITORING VÀ BẢO TRÌ

### 1. Setup Monitoring

#### Prometheus + Grafana (optional nhưng khuyến nghị)

```bash
# Metrics endpoint đã có sẵn
curl https://your-domain.com/api/metrics
```

#### Uptime Monitoring

Đăng ký dịch vụ free như:
- https://uptimerobot.com
- https://www.pingdom.com
- https://www.statuscake.com

Monitor endpoint: `https://your-domain.com/api/health`

### 2. Log Rotation

```bash
# Cấu hình Docker log rotation
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

### 3. Backup Database

```bash
# Tạo backup script
nano /usr/local/bin/backup-floodwatch-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/floodwatch"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker-compose -f /var/www/floodwatch/docker-compose.prod.yml exec -T db \
  pg_dump -U postgres floodwatch_prod | gzip > $BACKUP_DIR/floodwatch_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /usr/local/bin/backup-floodwatch-db.sh

# Add to crontab (chạy hàng ngày 2AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-floodwatch-db.sh") | crontab -
```

### 4. Update & Maintenance

```bash
# Pull latest code
cd /var/www/floodwatch
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Run migrations if needed
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head
```

---

## 🔍 TROUBLESHOOTING

### Vấn đề 1: Container không start được

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart specific service
docker-compose -f docker-compose.prod.yml restart web
```

### Vấn đề 2: Database connection error

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Check DATABASE_URL in .env.production
cat .env.production | grep DATABASE_URL

# Reset database password if needed
docker-compose -f docker-compose.prod.yml exec db psql -U postgres
# postgres=# ALTER USER postgres WITH PASSWORD 'new-password';
```

### Vấn đề 3: Nginx 502 Bad Gateway

```bash
# Check backend is running
curl http://localhost:3003
curl http://localhost:8002/health

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Vấn đề 4: CORS errors

```bash
# Verify CORS_ORIGINS in .env.production
cat .env.production | grep CORS_ORIGINS

# Should match your domain
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Restart API to apply changes
docker-compose -f docker-compose.prod.yml restart api
```

### Vấn đề 5: SSL certificate issues

```bash
# Renew certificate
sudo certbot renew --dry-run
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

---

## 🔐 SECURITY CHECKLIST

Trước khi mở cho công chúng:

- [ ] Đã tạo lại tất cả API keys
- [ ] ADMIN_TOKEN là random string 32+ ký tự
- [ ] Mật khẩu database mạnh
- [ ] .env.production không commit vào git
- [ ] CORS_ORIGINS chỉ chứa domain production
- [ ] SSL certificate đã cài đặt (HTTPS)
- [ ] Security headers được thêm vào API
- [ ] Firewall chỉ mở port 22, 80, 443
- [ ] SSH dùng key, không dùng password
- [ ] Regular security updates enabled
- [ ] Backup database tự động
- [ ] Monitoring và alerting đã setup

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề khi deploy:

1. Kiểm tra logs: `docker-compose logs`
2. Kiểm tra health: `curl /api/health`
3. Restart services: `docker-compose restart`
4. Tham khảo troubleshooting section ở trên

---

**Good luck with your deployment! 🚀**

Last updated: 2025-11-20
