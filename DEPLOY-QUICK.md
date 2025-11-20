# 🚀 HƯỚNG DẪN DEPLOY NHANH - THONGTINMUALU.LIVE

## ⚡ DEPLOY CHỈ 5 BƯỚC (< 10 phút)

---

### 📋 **BƯỚC 1: Chuẩn bị API Keys**

Trước khi deploy, bạn CẦN có:

#### 1.1. Tạo Admin Token mạnh
```bash
# Chạy lệnh này trên máy local
openssl rand -hex 32
# Copy kết quả, dùng cho ADMIN_TOKEN
```

#### 1.2. Tạo Database Password
```bash
# Chạy lệnh này trên máy local
openssl rand -base64 32
# Copy kết quả, dùng cho POSTGRES_PASSWORD
```

#### 1.3. Lấy API Keys
- **Telegram Bot:** Vào @BotFather → `/newbot` hoặc sử dụng bot cũ
- **MapTiler:** https://www.maptiler.com/cloud/ → API Keys → Create new key

---

### 📋 **BƯỚC 2: Sửa file .env.production**

File `.env.production` đã được tạo sẵn. Bạn CHỈ CẦN sửa 4 dòng sau:

```bash
# 1. Thay ADMIN_TOKEN (từ bước 1.1)
ADMIN_TOKEN=paste_token_here

# 2. Thay POSTGRES_PASSWORD 2 chỗ (từ bước 1.2)
POSTGRES_PASSWORD=paste_password_here
DATABASE_URL=postgresql+psycopg://postgres:paste_password_here@db:5432/floodwatch_prod

# 3. Thay TELEGRAM_BOT_TOKEN (từ bước 1.3)
TELEGRAM_BOT_TOKEN=paste_telegram_token_here

# 4. Thay MAPTILER_KEY (từ bước 1.3)
NEXT_PUBLIC_MAPTILER_KEY=paste_maptiler_key_here
```

**✅ KIỂM TRA:** Mở `.env.production`, đảm bảo 4 dòng trên đã được điền đúng!

---

### 📋 **BƯỚC 3: Upload code lên server**

#### Option A: Dùng Git (KHUYẾN NGHỊ)
```bash
# 1. Commit code (trên máy local)
git add .
git commit -m "Prepare for production deployment"
git push origin main

# 2. SSH vào server
ssh your-user@your-server-ip

# 3. Clone repository
cd /var/www
sudo git clone YOUR_REPO_URL floodwatch
cd floodwatch
sudo chown -R $USER:$USER .
```

#### Option B: Dùng SCP (nếu không có Git)
```bash
# Trên máy local, từ thư mục floodwatch
scp -r ./* your-user@your-server-ip:/var/www/floodwatch/

# Sau đó SSH vào server
ssh your-user@your-server-ip
cd /var/www/floodwatch
```

#### 3.1. Upload .env.production riêng (QUAN TRỌNG!)
```bash
# Trên máy local
scp .env.production your-user@your-server-ip:/var/www/floodwatch/
```

**⚠️ LƯU Ý:** KHÔNG commit `.env.production` vào git! Chỉ upload riêng bằng SCP.

---

### 📋 **BƯỚC 4: Deploy Docker containers**

```bash
# SSH vào server (nếu chưa SSH)
ssh your-user@your-server-ip

# Di chuyển vào thư mục project
cd /var/www/floodwatch

# Build và start containers
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Đợi 30 giây để database khởi động
sleep 30

# Chạy database migrations
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head

# Kiểm tra containers đang chạy
docker-compose -f docker-compose.prod.yml ps
```

**✅ KIỂM TRA:** Tất cả containers phải có status `Up` và `healthy`

---

### 📋 **BƯỚC 5: Cấu hình Nginx và SSL**

#### 5.1. Cài đặt Nginx (nếu chưa có)
```bash
sudo apt update
sudo apt install nginx -y
```

#### 5.2. Copy Nginx config
```bash
# Copy file config đã tạo sẵn
sudo cp /var/www/floodwatch/nginx-thongtinmualu.conf /etc/nginx/sites-available/thongtinmualu

# Enable site
sudo ln -s /etc/nginx/sites-available/thongtinmualu /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

#### 5.3. Cài đặt SSL (Let's Encrypt)
```bash
# Cài đặt certbot
sudo apt install certbot python3-certbot-nginx -y

# Lấy certificate (certbot tự động cấu hình HTTPS)
sudo certbot --nginx -d thongtinmualu.live -d www.thongtinmualu.live
```

**Certbot sẽ hỏi email và terms → nhập email và đồng ý.**

---

## ✅ **KIỂM TRA SAU KHI DEPLOY**

### Test 1: Kiểm tra containers
```bash
cd /var/www/floodwatch
docker-compose -f docker-compose.prod.yml ps

# Tất cả phải Up và healthy
```

### Test 2: Kiểm tra API
```bash
curl https://thongtinmualu.live/api/health

# Phải trả về: {"status":"ok","service":"floodwatch-api"}
```

### Test 3: Mở trình duyệt
- Truy cập: **https://thongtinmualu.live**
- Phải tự động redirect sang: **https://thongtinmualu.live/map**
- Map phải hiển thị đầy đủ với markers
- Hot News ticker chạy ở dưới cùng
- Media carousel hiển thị ảnh
- Sidebar hiển thị tin cập nhật
- Tin ghim màu đỏ ở đầu sidebar

---

## 🔍 **TROUBLESHOOTING - Nếu có lỗi**

### Lỗi 1: Container không start
```bash
# Xem logs
docker-compose -f docker-compose.prod.yml logs

# Restart
docker-compose -f docker-compose.prod.yml restart
```

### Lỗi 2: Nginx 502 Bad Gateway
```bash
# Kiểm tra backend có chạy không
curl http://localhost:3000/map
curl http://localhost:8000/health

# Xem nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Lỗi 3: Database error
```bash
# Kiểm tra database
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Chạy lại migrations
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### Lỗi 4: Map không hiển thị
- Kiểm tra `NEXT_PUBLIC_MAPTILER_KEY` trong `.env.production` có đúng không
- Kiểm tra console browser có lỗi API key không

---

## 📞 **CẦN TRỢ GIÚP?**

### Debug commands hữu ích:
```bash
# Xem tất cả logs
docker-compose -f docker-compose.prod.yml logs -f

# Xem logs của service cụ thể
docker-compose -f docker-compose.prod.yml logs web
docker-compose -f docker-compose.prod.yml logs api

# Restart toàn bộ
docker-compose -f docker-compose.prod.yml restart

# Stop và start lại từ đầu
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🎉 **XONG!**

Nếu mọi thứ OK, website của bạn giờ đang chạy tại:
**https://thongtinmualu.live/map**

- ✅ HTTPS được kích hoạt
- ✅ Map hiển thị đầy đủ
- ✅ Real-time updates (30s interval)
- ✅ Tin ghim quan trọng
- ✅ Hot news ticker
- ✅ Media carousel

---

**Thời gian deploy:** ~10 phút
**Last updated:** 2025-11-20
