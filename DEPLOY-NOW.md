# 🚀 DEPLOY SIÊU NHANH - 3 BƯỚC DUY NHẤT!

## ⚡ CHỈ CẦN 3 BƯỚC (< 5 phút)

---

## **BƯỚC 1: Tạo API Keys** (2 phút)

### 1.1. Tạo Admin Token và DB Password
```bash
# Chạy 2 lệnh này, copy kết quả
openssl rand -hex 32
openssl rand -base64 32
```

### 1.2. Lấy API Keys
- **Telegram:** @BotFather → `/mybot` → copy token
- **MapTiler:** https://www.maptiler.com/cloud/ → API Keys → copy key

---

## **BƯỚC 2: Sửa .env.production** (1 phút)

Mở file `.env.production` và **CHỈ SỬA 4 DÒNG**:

```bash
ADMIN_TOKEN=paste_cai_32_ky_tu_tu_openssl_rand_hex_32
POSTGRES_PASSWORD=paste_cai_password_tu_openssl_rand_base64_32
DATABASE_URL=postgresql+psycopg://postgres:paste_lai_cai_password_do@db:5432/floodwatch_prod
TELEGRAM_BOT_TOKEN=paste_telegram_token
NEXT_PUBLIC_MAPTILER_KEY=paste_maptiler_key
```

**✅ LƯU FILE!**

---

## **BƯỚC 3: Chạy Script Deploy** (2 phút)

### Trên Server:
```bash
# Upload toàn bộ folder lên server
scp -r /Users/mac/floodwatch user@your-server:/var/www/

# SSH vào server
ssh user@your-server

# Vào thư mục
cd /var/www/floodwatch

# CHẠY SCRIPT (tự động làm hết)
./deploy.sh
```

**XONG! Script sẽ tự động:**
- ✅ Build Docker images
- ✅ Start containers
- ✅ Chạy database migrations
- ✅ Kiểm tra health

---

## **SAU KHI SCRIPT CHẠY XONG:**

### Cài Nginx & SSL (1 phút):
```bash
# Copy nginx config
sudo cp nginx-thongtinmualu.conf /etc/nginx/sites-available/thongtinmualu
sudo ln -s /etc/nginx/sites-available/thongtinmualu /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Cài SSL (tự động, chỉ cần nhập email)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d thongtinmualu.live -d www.thongtinmualu.live
```

---

## ✅ **HOÀN THÀNH!**

Truy cập: **https://thongtinmualu.live**

→ Tự động vào: **https://thongtinmualu.live/map**

---

## 🔧 **NẾU CÓ LỖI:**

```bash
# Xem logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart
docker-compose -f docker-compose.prod.yml restart

# Stop và chạy lại
docker-compose -f docker-compose.prod.yml down
./deploy.sh
```

---

**TỔNG THỜI GIAN:** < 5 phút
**CHỈ CẦN:** Sửa .env.production → Chạy ./deploy.sh → Cài SSL

🎉 **XONG!**
