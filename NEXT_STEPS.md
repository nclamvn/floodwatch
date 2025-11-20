# 🚀 BƯỚC TIẾP THEO - FloodWatch

## ✅ CHẶNG 1 HOÀN THÀNH!

Chúc mừng! Bạn đã có một dự án FloodWatch MVP hoàn chỉnh tại `~/floodwatch/`.

---

## 📋 CHECKLIST TRƯỚC KHI CHẠY

### 1. Khởi động Docker Desktop
```bash
# Kiểm tra Docker đã chạy chưa
docker --version
docker compose version

# Nếu lỗi "Cannot connect to Docker daemon":
# → Mở Docker Desktop và đợi "Engine running"
```

### 2. Lấy Mapbox Token (Miễn phí)
📍 **Hướng dẫn chi tiết:** Xem file `QUICKSTART.md`

**Quick steps:**
1. https://account.mapbox.com/auth/signup
2. Đăng ký → Xác nhận email
3. Account → Tokens → Create token
4. Copy token (bắt đầu với `pk.`)
5. Thêm vào `~/floodwatch/.env`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
   ```

### 3. Khởi động Services
```bash
cd ~/floodwatch

# Cách 1: Dùng script tự động
./scripts/dev_up.sh

# Cách 2: Chạy trực tiếp
docker compose up -d --build

# Đợi 2-3 phút để services khởi động...
```

### 4. Kiểm tra Services
```bash
# Xem trạng thái
docker compose ps

# Xem logs
docker compose logs -f

# Kiểm tra API
curl http://localhost:8000/health

# Test endpoints
./scripts/test_api.sh
```

### 5. Truy cập Web
- 🌐 **Web UI**: http://localhost:3000
- 🗺️ **Map**: http://localhost:3000/map
- 📊 **API Docs**: http://localhost:8000/docs

---

## 🧪 TEST DỮ LIỆU MOCK

```bash
# Tạo mock alerts
docker compose exec api python3 /ops/cron/kttv_alerts.py

# Xem kết quả
curl "http://localhost:8000/reports?type=ALERT"

# Test community report
curl -X POST http://localhost:8000/ingest/community \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Test từ terminal",
    "lat": 16.07,
    "lon": 108.22,
    "province": "Đà Nẵng"
  }'

# Refresh map để thấy marker mới
```

---

## 🔄 LÀM VIỆC VỚI DỰ ÁN

### Xem Logs
```bash
# All services
docker compose logs -f

# Chỉ API
docker compose logs -f api

# Chỉ Web
docker compose logs -f web

# Chỉ DB
docker compose logs -f db
```

### Restart Services
```bash
# Restart tất cả
docker compose restart

# Restart riêng lẻ
docker compose restart api
docker compose restart web
```

### Rebuild sau khi sửa code
```bash
# Backend thay đổi
docker compose up -d --build api

# Frontend thay đổi
docker compose up -d --build web

# Database schema thay đổi (⚠️ XÓA DATA!)
docker compose down -v
docker compose up -d --build
```

### Dừng Services
```bash
# Dừng nhưng giữ data
docker compose down

# Dừng và xóa tất cả (database, volumes)
docker compose down -v
```

---

## 📚 TÀI LIỆU THAM KHẢO

- **README.md** - Documentation đầy đủ về dự án
- **QUICKSTART.md** - Hướng dẫn khởi động nhanh
- **REPORT_STAGE1.md** - Báo cáo chi tiết Chặng 1
- **API Docs** - http://localhost:8000/docs (khi services chạy)

---

## 🐛 TROUBLESHOOTING

### Lỗi: Port đã được sử dụng
```bash
# Thay đổi ports trong .env
WEB_PORT=3001
API_PORT=8001
DB_PORT=5433

# Restart
docker compose down
docker compose up -d
```

### Lỗi: Web không hiển thị bản đồ
→ Kiểm tra `NEXT_PUBLIC_MAPBOX_TOKEN` trong `.env`
→ Restart web: `docker compose restart web`

### Lỗi: Database connection failed
→ Đợi 30s để Postgres khởi động
→ Xem logs: `docker compose logs db`

### Lỗi: Cannot connect to Docker daemon
→ Khởi động Docker Desktop
→ Đợi "Engine running"

---

## 🎯 CHẶNG 2 (48H) - ROADMAP

### Mục tiêu
- [ ] Database integration (SQLAlchemy + Alembic)
- [ ] Community webhook form với upload ảnh
- [ ] Map clustering + heatmap
- [ ] Trang `/routes` cho tuyến đường
- [ ] Real NCHMF scraper

### Bắt đầu Chặng 2
```bash
# Đảm bảo Chặng 1 chạy ổn
./scripts/test_api.sh

# Commit code hiện tại
cd ~/floodwatch
git init
git add .
git commit -m "🎉 Chặng 1: MVP hoàn thành"

# Sẵn sàng cho Chặng 2!
```

---

## 📞 CẦN TRỢ GIÚP?

### Lỗi kỹ thuật
1. Xem logs: `docker compose logs -f`
2. Check health: `curl http://localhost:8000/health`
3. Restart: `docker compose restart`
4. Rebuild: `docker compose up -d --build`

### Câu hỏi về dự án
- Xem README.md để hiểu architecture
- Xem REPORT_STAGE1.md để xem chi tiết implementation

---

## ✨ CHÚC MỪNG!

Bạn đã hoàn thành Chặng 1 của FloodWatch! 🎉

**Next:** Khởi động Docker Desktop → Lấy Mapbox token → Chạy `./scripts/dev_up.sh`

---

**Built with ❤️ for Vietnam's disaster resilience**
