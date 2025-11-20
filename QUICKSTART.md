# 🚀 Quick Start Guide

## Bước 1: Cài đặt Docker Desktop

**Nếu chưa có Docker:**
1. Tải Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Cài đặt và khởi động Docker Desktop
3. Đợi Docker Desktop hiển thị "Engine running"

**Kiểm tra Docker đã chạy:**
```bash
docker --version
docker compose version
```

---

## Bước 2: Lấy Mapbox Token (Miễn phí)

1. Truy cập: https://account.mapbox.com/auth/signup
2. Đăng ký tài khoản (email + password, không cần thẻ)
3. Xác nhận email
4. Vào **Account** → **Tokens** → **Create a token**
5. Tên: `floodwatch`
6. Click **Create token**
7. **Copy token** (bắt đầu với `pk.`)

---

## Bước 3: Cấu hình môi trường

```bash
cd ~/floodwatch

# Chỉnh sửa .env và thêm Mapbox token
nano .env

# Tìm dòng này:
# NEXT_PUBLIC_MAPBOX_TOKEN=

# Thay bằng:
# NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbG...
```

**Lưu file** (Ctrl+O, Enter, Ctrl+X trong nano)

---

## Bước 4: Khởi động FloodWatch

```bash
cd ~/floodwatch

# Khởi động tất cả services
./scripts/dev_up.sh

# Hoặc chạy trực tiếp
docker compose up -d --build
```

**Đợi 2-3 phút** cho services khởi động lần đầu...

---

## Bước 5: Kiểm tra Services

```bash
# Xem trạng thái
docker compose ps

# Xem logs
docker compose logs -f
```

**Truy cập:**
- 🌐 Web UI: http://localhost:3000
- 📊 API Docs: http://localhost:8000/docs
- 🔍 Health: http://localhost:8000/health

---

## Bước 6: Test dữ liệu Mock

```bash
# Tạo mock alerts
docker compose exec api python3 /ops/cron/kttv_alerts.py

# Kiểm tra API
curl http://localhost:8000/reports
```

---

## 🛑 Dừng Services

```bash
docker compose down

# Hoặc xóa cả dữ liệu
docker compose down -v
```

---

## ❓ Troubleshooting

### Lỗi "Cannot connect to Docker daemon"
→ Khởi động Docker Desktop và đợi "Engine running"

### Web không hiển thị bản đồ
→ Kiểm tra `NEXT_PUBLIC_MAPBOX_TOKEN` trong `.env`

### Port đã được sử dụng (3000, 8000, 5432)
→ Thay đổi ports trong `.env`:
```
WEB_PORT=3001
API_PORT=8001
DB_PORT=5433
```

### Database connection error
→ Đợi thêm 30s để Postgres khởi động:
```bash
docker compose logs db
```

---

## 📞 Cần trợ giúp?

Xem chi tiết trong **README.md** hoặc:
- Check logs: `docker compose logs -f`
- Restart: `docker compose restart`
- Rebuild: `docker compose up -d --build`
