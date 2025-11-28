# 🌊 FloodWatch - Hệ thống Giám sát Mưa Lũ

[![CI](https://github.com/yourname/floodwatch/actions/workflows/ci.yml/badge.svg)](https://github.com/yourname/floodwatch/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yourname/floodwatch/branch/main/graph/badge.svg)](https://codecov.io/gh/yourname/floodwatch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Real-time flood monitoring and alert system for Vietnam**

FloodWatch là hệ thống giám sát mưa lũ thời gian thực, tích hợp dữ liệu từ KTTV (Trung tâm Khí tượng Thủy văn Quốc gia), cộng đồng, và các nguồn dữ liệu công khai để cung cấp thông tin cảnh báo kịp thời.

---

## 🚀 Quick Start

### Prerequisites

- Docker Desktop (hoặc Docker Engine + Docker Compose)
- Node.js 20+ (nếu chạy local development)
- Python 3.11+ (nếu chạy local development)

### 1. Clone & Setup

```bash
cd ~/floodwatch

# Copy environment variables
cp .env.example .env

# IMPORTANT: Thêm Mapbox token vào .env
# Lấy token miễn phí tại: https://account.mapbox.com/auth/signup
nano .env  # Thêm NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
```

### 2. Start Services

```bash
# Chạy script tự động
chmod +x scripts/dev_up.sh
./scripts/dev_up.sh

# Hoặc chạy trực tiếp
docker compose up -d --build
```

### 3. Access Services

- 🌐 **Web UI**: http://localhost:3000
- 📊 **API Docs**: http://localhost:8000/docs
- 🔍 **Health Check**: http://localhost:8000/health
- 🗄️ **Database**: localhost:5432 (user: fw_user, pass: fw_pass)

---

## 📦 Architecture

```
floodwatch/
├── apps/
│   ├── web/              # Next.js 14 Frontend (App Router)
│   │   ├── app/          # Pages & layouts
│   │   ├── components/   # React components
│   │   └── public/       # Static assets
│   └── api/              # FastAPI Backend
│       └── app/
│           ├── main.py   # API entry point
│           ├── models/   # Database models
│           ├── routes/   # API routes
│           └── services/ # Business logic
├── infrastructure/
│   ├── sql/              # Database init scripts
│   └── docker/           # Dockerfiles
├── ops/
│   ├── cron/             # Scheduled jobs (alert ingestion)
│   └── configs/          # Configuration files
└── docker-compose.yml    # Services orchestration
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router, React 18)
- **Styling**: Tailwind CSS
- **Mapping**: MapLibre GL / react-map-gl (supports Mapbox & Goong Maps)
- **HTTP Client**: Axios

### Backend
- **Framework**: FastAPI 0.109
- **Language**: Python 3.11
- **Validation**: Pydantic v2
- **ASGI Server**: Uvicorn

### Database
- **Engine**: PostgreSQL 15
- **Spatial**: PostGIS 3.4
- **Features**: Spatial indexes (GIST), triggers, UUID

### Infrastructure
- **Containers**: Docker Compose
- **Caching**: Redis 7 (optional)
- **Monitoring**: Health checks on all services

---

## 📡 API Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### Get Reports (Alerts, SOS, Road events)
```bash
# All reports
curl "http://localhost:8000/reports"

# Filter by type
curl "http://localhost:8000/reports?type=ALERT"

# Filter by province
curl "http://localhost:8000/reports?province=Quảng%20Nam"

# Filter by time (last 6 hours)
curl "http://localhost:8000/reports?since=6h"
```

### Ingest Alerts (Internal)
```bash
curl -X POST http://localhost:8000/ingest/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "title": "Cảnh báo mưa lớn Quảng Nam",
    "province": "Quảng Nam",
    "lat": 15.57,
    "lon": 108.48,
    "level": "high",
    "source": "KTTV"
  }]'
```

### Ingest Community Report
```bash
curl -X POST http://localhost:8000/ingest/community \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Gia đình 5 người bị cô lập, cần cứu trợ",
    "lat": 16.07,
    "lon": 108.22,
    "province": "Đà Nẵng",
    "media": ["https://example.com/image.jpg"]
  }'
```

### Road Events
```bash
curl "http://localhost:8000/road-events?province=Quảng%20Trị"
```

---

## 🗺️ Map Provider Setup

FloodWatch hỗ trợ hai nhà cung cấp bản đồ:
- **Mapbox** (Global) - Dữ liệu toàn cầu, setup nhanh
- **Goong Maps** (Vietnam-optimized) - Dữ liệu Việt Nam tốt hơn (ngõ, hẻm, địa chỉ)

### Option 1: Mapbox (Recommended cho Testing)

#### Bước 1: Đăng ký Mapbox
1. Truy cập: https://account.mapbox.com/auth/signup
2. Đăng ký tài khoản miễn phí (không cần thẻ tín dụng)
3. Xác nhận email

#### Bước 2: Tạo Access Token
1. Đăng nhập Mapbox
2. Vào **Account** → **Tokens**
3. Click **Create a token**
4. Tên: `floodwatch`
5. Scopes: Chọn **Public** (mặc định)
6. Click **Create token**
7. Copy token (bắt đầu với `pk.`)

#### Bước 3: Thêm vào .env
```bash
# Trong file .env
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbG...
NEXT_PUBLIC_GOONG_API_KEY=
```

#### Free Tier Limits
- ✅ 50,000 map loads/month (~1,600/day)
- ✅ 600,000 tiles/month (~20,000/day)
- ✅ Đủ cho MVP và pilot project

---

### Option 2: Goong Maps (Recommended cho Production tại VN)

#### Ưu điểm Goong Maps
- ✅ Dữ liệu địa chỉ Việt Nam chi tiết hơn (ngõ, hẻm, số nhà)
- ✅ Tile server tại Việt Nam (latency thấp hơn)
- ✅ Hỗ trợ tên đường bằng tiếng Việt có dấu
- ✅ Phù hợp cho ứng dụng local Việt Nam

#### Bước 1: Đăng ký Goong.io
1. Truy cập: https://goong.io
2. Click **Đăng ký** → Điền thông tin doanh nghiệp/cá nhân
3. ⚠️ **Lưu ý**: Goong yêu cầu 24 giờ để duyệt tài khoản

#### Bước 2: Tạo API Key (sau khi được duyệt)
1. Đăng nhập Goong Console
2. Vào **API Keys** → **Create new key**
3. Tên: `floodwatch-prod`
4. Copy API key

#### Bước 3: Chuyển sang Goong trong .env
```bash
# Trong file .env
NEXT_PUBLIC_MAP_PROVIDER=goong    # ← Đổi từ "mapbox" sang "goong"
NEXT_PUBLIC_MAPBOX_TOKEN=pk....   # ← Giữ làm fallback (optional)
NEXT_PUBLIC_GOONG_API_KEY=your_goong_api_key_here
```

#### Bước 4: Restart Web Service
```bash
docker compose restart web
```

---

### So sánh Mapbox vs Goong

| Tiêu chí | Mapbox | Goong Maps |
|----------|--------|------------|
| **Dữ liệu VN** | Cơ bản | Chi tiết (ngõ, hẻm) |
| **Latency** | ~200-300ms | ~50-100ms |
| **Setup** | Instant | 24h approval |
| **Free tier** | 50k loads/month | Liên hệ Goong |
| **Phù hợp** | MVP, Testing | Production VN |

### Technical Details

Hệ thống sử dụng **MapLibre GL** (open-source fork of Mapbox GL) với abstraction layer để dễ dàng chuyển đổi giữa các provider. Cả hai provider đều tương thích 100% với API hiện tại.

**Map Provider Abstraction**: Xem `apps/web/lib/mapProvider.ts` để hiểu cách hệ thống tự động load provider dựa trên biến môi trường.

---

## 🔄 Data Ingestion

### Manual Test Ingestion
```bash
# Test KTTV alerts ingestion (mock data)
docker compose exec api python /app/../ops/cron/kttv_alerts.py
```

### Scheduled Ingestion (Future)
```python
# Will use APScheduler to run every 10 minutes
# ops/cron/scheduler.py (to be implemented)
```

---

## 🧪 Development

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f db
```

### Restart Services
```bash
# All services
docker compose restart

# Specific service
docker compose restart api
```

### Rebuild After Changes
```bash
# Backend changes
docker compose up -d --build api

# Frontend changes
docker compose up -d --build web

# Database schema changes
docker compose down -v  # WARNING: Deletes data!
docker compose up -d --build
```

### Database Access
```bash
# Via psql
docker compose exec db psql -U fw_user -d floodwatch

# Check PostGIS
SELECT PostGIS_Version();

# Count reports
SELECT type, COUNT(*) FROM reports GROUP BY type;
```

---

## 📊 Database Schema

### `reports` Table
```sql
- id (UUID, PK)
- type (ALERT | RAIN | ROAD | SOS | NEEDS)
- source (KTTV | NCHMF | COMMUNITY | PRESS)
- title, description
- province, district, ward
- lat, lon (coordinates)
- location (PostGIS Point geometry)
- trust_score (0.0 - 1.0)
- media (JSONB array)
- status (new | verified | merged | resolved | invalid)
- created_at, updated_at
```

### `road_events` Table
```sql
- id (UUID, PK)
- segment_name (e.g., "QL1A Đèo Hải Vân")
- status (OPEN | CLOSED | RESTRICTED)
- reason
- province, district
- lat, lon
- location (PostGIS Point geometry)
- last_verified
- source
```

### Spatial Queries
```sql
-- Find reports within 5km of a location
SELECT * FROM reports
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(108.22, 16.07), 4326)::geography,
  5000
);

-- Find reports in a bounding box
SELECT * FROM reports
WHERE ST_Within(
  location,
  ST_MakeEnvelope(107.0, 15.0, 109.0, 17.0, 4326)
);
```

---

## 🔐 Security Notes

### Environment Variables
- ⚠️ **NEVER commit `.env`** to version control
- ⚠️ Change default passwords in production
- ⚠️ Use strong `ADMIN_TOKEN` in production

### API Security (Future)
- [ ] Add API key authentication
- [ ] Rate limiting per IP
- [ ] HTTPS in production
- [ ] Sanitize user input

---

## 🚧 Roadmap

### ✅ Chặng 1 (24h) - DONE
- [x] Monorepo structure
- [x] Docker Compose setup
- [x] PostgreSQL + PostGIS
- [x] FastAPI skeleton (/health, /reports, /ingest)
- [x] Next.js with Mapbox
- [x] Mock KTTV alert ingestion

### 🔜 Chặng 2 (48h) - Next
- [ ] Community webhook form
- [ ] Map pins with clustering
- [ ] Road status page `/routes`
- [ ] Press scraper for road events

### 🔜 Chặng 3 (72h)
- [ ] Dashboard `/ops` for rescue teams
- [ ] Trust score V1 (rule-based)
- [ ] Low-bandwidth mode `/lite`
- [ ] CSV export
- [ ] Public API v1

### 🔮 Future
- [ ] Real NCHMF scraper
- [ ] NASA IMERG rainfall data
- [ ] NER for location extraction
- [ ] Telegram alerts
- [ ] Mobile app (React Native)
- [ ] ML-based trust scoring

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Make changes with clear commit messages
4. Test locally with Docker Compose
5. Submit a PR

---

## 📄 License

MIT License - See LICENSE file for details

---

## 📞 Contact & Support

- **Issues**: https://github.com/yourname/floodwatch/issues
- **Docs**: See `/docs` folder
- **Email**: your.email@example.com

---

## 🙏 Acknowledgments

- **NCHMF** (Trung tâm Khí tượng Thủy văn Quốc gia) - Weather data source
- **NASA GPM/IMERG** - Global rainfall data
- **MapLibre GL** - Open-source mapping library
- **Mapbox** - Global mapping platform
- **Goong Maps** - Vietnam-optimized mapping platform
- **PostGIS** - Spatial database extension
- **FastAPI** - Modern Python web framework
- **Next.js** - React framework

---

**Built with ❤️ for Vietnam's disaster resilience**
