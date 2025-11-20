# 🗺️ FloodWatch Feature Roadmap

**Mục tiêu:** Xây dựng hệ thống cảnh báo mưa lũ thông minh cho Việt Nam với kiến trúc có thể mở rộng.

**Nguyên tắc:**
- ✅ **Làm ngay**: Tính năng dễ tích hợp, giá trị cao cho prototype
- 🔒 **Giữ chỗ**: Định nghĩa schema/API để sau này mở rộng không phải refactor

---

## Kiến trúc 5 tầng

```
┌─────────────────────────────────────────────────────────┐
│  Tầng 4: Tính năng nâng cao (Route tránh ngập, Admin)  │
├─────────────────────────────────────────────────────────┤
│  Tầng 3: Cảnh báo & UX (GPS, Subscriptions, Alerts)    │
├─────────────────────────────────────────────────────────┤
│  Tầng 2: Risk Engine (Chấm điểm rủi ro theo khu vực)   │
├─────────────────────────────────────────────────────────┤
│  Tầng 1: Dữ liệu thiên tai (Hazard Events)             │
├─────────────────────────────────────────────────────────┤
│  Tầng 0: Hạ tầng (MapLibre, PostGIS, API, Workers)     │
└─────────────────────────────────────────────────────────┘
```

---

## Tầng 0: Hạ tầng & Bản đồ

### ✅ ĐÃ CÓ / ĐANG CHẠY

- [x] MapLibre GL + abstraction layer (Mapbox/Goong)
- [x] GPS tracking + "Vị trí của tôi"
- [x] User location marker + radius circle (3km default)
- [x] PostgreSQL + PostGIS
- [x] FastAPI backend
- [x] Next.js 14 frontend
- [x] Docker Compose setup

### 🔧 NÊN LÀM NGAY

**Priority: HIGH** - Foundation cho các tầng trên

#### 1. Database Migration System
```bash
# Thêm Alembic migrations
alembic init alembic/
alembic revision --autogenerate -m "Add hazard_events table"
```

#### 2. Background Worker Service
```yaml
# docker-compose.yml
services:
  worker:
    build: ./apps/api
    command: python workers/alert_engine.py
    depends_on:
      - db
      - api
```

**Files cần tạo:**
- `workers/alert_engine.py` - Main worker loop
- `workers/base.py` - Worker base class

### 🔒 GIỮ CHỖ CHO SAU

#### Schema `geo` (Dữ liệu địa lý chuẩn)

```sql
-- Giữ chỗ: Chưa cần đổ data, chỉ định nghĩa structure
CREATE SCHEMA geo;

-- Locations: Điểm chuẩn (trạm đo, hồ chứa, landmark)
CREATE TABLE geo.locations (
  id UUID PRIMARY KEY,
  type VARCHAR(50), -- 'dam', 'station', 'landmark'
  name VARCHAR(255),
  location GEOMETRY(Point, 4326),
  metadata JSONB
);

-- Admin areas: Biên giới hành chính
CREATE TABLE geo.admin_areas (
  id UUID PRIMARY KEY,
  level VARCHAR(20), -- 'province', 'district', 'ward'
  name VARCHAR(255),
  boundary GEOMETRY(MultiPolygon, 4326),
  parent_id UUID REFERENCES geo.admin_areas(id)
);
```

**Note:** Chưa import shapefile, chỉ cần có bảng.

---

## Tầng 1: Dữ liệu Thiên Tai (Hazard Data)

### 🔧 LÀM NGAY - MỨC TỐI THIỂU

**Priority: CRITICAL** - Core data model cho toàn bộ hệ thống

#### 1. Bảng `hazard_events`

```sql
CREATE TYPE hazard_type AS ENUM (
  'heavy_rain',      -- Mưa lớn
  'flood',           -- Lũ lụt
  'dam_release',     -- Xả hồ
  'landslide',       -- Sạt lở
  'storm',           -- Bão
  'tide_surge'       -- Triều cường
);

CREATE TYPE severity_level AS ENUM (
  'green',   -- Bình thường
  'yellow',  -- Chú ý
  'orange',  -- Nguy hiểm
  'red'      -- Cực kỳ nguy hiểm
);

CREATE TABLE hazard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  type hazard_type NOT NULL,
  severity severity_level NOT NULL DEFAULT 'yellow',

  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Location (POINT or POLYGON)
  location GEOMETRY NOT NULL,
  radius_km FLOAT,  -- Impact radius (if location is POINT)

  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,

  -- Source tracking
  source VARCHAR(100), -- 'kttv', 'press', 'social', 'manual'
  source_url TEXT,
  raw_payload JSONB,  -- Original data for debugging

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_hazard_location ON hazard_events USING GIST(location);
CREATE INDEX idx_hazard_time ON hazard_events(starts_at, ends_at);
CREATE INDEX idx_hazard_severity ON hazard_events(severity) WHERE is_active = TRUE;
```

#### 2. API Endpoints

**File:** `apps/api/app/routes/hazards.py`

```python
# Admin/Internal endpoints (tạm thời)
POST   /api/hazards              # Tạo hazard event (manual/admin)
GET    /api/hazards              # List hazards (filters: bbox, type, severity)
GET    /api/hazards/:id          # Chi tiết 1 hazard
PATCH  /api/hazards/:id          # Update hazard
DELETE /api/hazards/:id          # Xóa hazard

# Query params:
# - bbox: "lat1,lng1,lat2,lng2"
# - type: "heavy_rain,flood"
# - severity: "orange,red"
# - active_at: ISO timestamp (default: now)
```

**Request body example:**
```json
{
  "type": "dam_release",
  "severity": "orange",
  "title": "Xả lũ hồ Hòa Bình 2000m³/s",
  "description": "Dự kiến xả từ 14h ngày 15/11",
  "location": {
    "type": "Point",
    "coordinates": [105.3394, 20.8142]
  },
  "radius_km": 20,
  "starts_at": "2025-11-15T14:00:00+07:00",
  "ends_at": "2025-11-16T02:00:00+07:00",
  "source": "manual"
}
```

#### 3. Frontend Integration

**File:** `apps/web/components/HazardLayer.tsx`

```tsx
// Vẽ hazard events lên map
<Source id="hazards" type="geojson" data={hazardsGeoJSON}>
  <Layer
    id="hazard-fill"
    type="circle"
    paint={{
      'circle-radius': ['get', 'radius_pixels'],
      'circle-color': [
        'match',
        ['get', 'severity'],
        'red', '#EF4444',
        'orange', '#F97316',
        'yellow', '#EAB308',
        '#22C55E'
      ],
      'circle-opacity': 0.3
    }}
  />
</Source>
```

### 🔒 GIỮ CHỖ CHO SAU

#### Ingestion Workers

**Cấu trúc thư mục:**
```
workers/
├── ingest/
│   ├── __init__.py
│   ├── kttv_scraper.py      # 🔒 Giữ chỗ: Scrape KTTV
│   ├── press_scraper.py     # 🔒 Giữ chỗ: Báo chí
│   └── social_monitor.py    # 🔒 Giữ chỗ: Mạng xã hội
├── alert_engine.py
└── base.py
```

**Note:** Chỉ tạo folder + file rỗng với docstring, chưa code logic.

---

## Tầng 2: Risk Engine (Chấm điểm rủi ro)

### 🔧 GIỮ CHỖ + MOCK DATA ĐỂ TEST UI

**Priority: MEDIUM** - UI cần risk scores, nhưng logic phức tạp làm sau

#### 1. Bảng `area_risk_scores`

```sql
CREATE TABLE area_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to admin area (hoặc grid cell)
  admin_area_id UUID REFERENCES geo.admin_areas(id),

  -- Risk assessment
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  risk_level severity_level,

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,

  -- Explanation (human-readable + machine-readable)
  explanation TEXT,
  factors JSONB, -- {"rainfall_24h": 150, "river_level": 8.5, ...}

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_version VARCHAR(20) -- 'v1.0', 'v2.0' for tracking
);

CREATE INDEX idx_risk_location ON area_risk_scores(admin_area_id);
CREATE INDEX idx_risk_validity ON area_risk_scores(valid_from, valid_to);
```

#### 2. API Endpoints

```python
GET /api/risks/point?lat=16.07&lng=108.22    # Risk tại tọa độ
GET /api/risks/area/:admin_area_id           # Risk theo khu vực hành chính
GET /api/risks/heatmap?bbox=...              # GeoJSON risk heatmap
```

**Response example:**
```json
{
  "location": {"lat": 16.07, "lng": 108.22},
  "risk_score": 75,
  "risk_level": "orange",
  "explanation": "Mưa lớn kéo dài 48h + triều cường + địa hình thấp",
  "factors": {
    "rainfall_24h_mm": 180,
    "rainfall_72h_mm": 320,
    "river_level_m": 2.1,
    "terrain_elevation_m": 1.5,
    "historical_flood_count": 3
  },
  "valid_until": "2025-11-20T00:00:00+07:00"
}
```

#### 3. Mock Data Script

**File:** `scripts/seed_risk_scores.py`

```python
# Tạo mock data cho 5-10 tỉnh miền Trung
# Để test UI hiển thị risk zones
```

### 🔒 ĐỂ LÀM SAU (LOGIC NẶNG)

**Risk Calculation Engine:**
```python
# workers/risk_calculator.py - 🔒 Giữ chỗ

class RiskCalculator:
    def calculate_area_risk(self, area_id: UUID) -> RiskScore:
        """
        Tính risk_score dựa trên:
        1. Rainfall data (24h, 72h)
        2. River water levels
        3. Terrain (elevation, slope)
        4. Historical flood data
        5. Tide predictions (vùng ven biển)

        TODO: Implement với data thật
        """
        pass
```

---

## Tầng 3: Cảnh Báo & UX

### Phase 3.1: Alert Subscriptions

**Priority: HIGH** - Dễ làm, giá trị cao

#### 1. Bảng `alert_subscriptions`

```sql
CREATE TABLE alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification (flexible: support multiple channels)
  user_id UUID,  -- FK to users table (if we add auth later)
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  telegram_chat_id BIGINT,

  -- Location to monitor
  location GEOMETRY(Point, 4326) NOT NULL,
  radius_km FLOAT NOT NULL DEFAULT 3,

  -- Alert preferences
  alert_types hazard_type[] DEFAULT ARRAY['flood', 'heavy_rain', 'dam_release'],
  min_severity severity_level DEFAULT 'yellow',

  -- Notification channels
  notify_via VARCHAR(50)[] DEFAULT ARRAY['telegram'], -- 'email', 'sms', 'telegram', 'push'

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (
    contact_email IS NOT NULL OR
    contact_phone IS NOT NULL OR
    telegram_chat_id IS NOT NULL OR
    user_id IS NOT NULL
  )
);

CREATE INDEX idx_subscription_location ON alert_subscriptions USING GIST(location);
CREATE INDEX idx_subscription_active ON alert_subscriptions(is_active) WHERE is_active = TRUE;
```

#### 2. API Endpoints

```python
POST   /api/alerts/subscribe      # Đăng ký cảnh báo
GET    /api/alerts/subscriptions  # List subscriptions của user
PATCH  /api/alerts/subscriptions/:id  # Update preferences
DELETE /api/alerts/subscriptions/:id  # Hủy đăng ký
```

**Request body:**
```json
{
  "contact_email": "user@example.com",
  "telegram_chat_id": 123456789,
  "location": {
    "type": "Point",
    "coordinates": [108.22, 16.07]
  },
  "radius_km": 5,
  "alert_types": ["flood", "heavy_rain", "dam_release"],
  "min_severity": "orange",
  "notify_via": ["telegram", "email"]
}
```

#### 3. UI Component

**File:** `apps/web/components/AlertSubscribeButton.tsx`

```tsx
// Hiện sau khi user click "Locate Me"
<button onClick={handleSubscribe}>
  📍 Đăng ký cảnh báo cho vùng {radius}km quanh đây
</button>
```

**Flow:**
1. User click "Locate Me" → có GPS location
2. Hiện nút "Đăng ký cảnh báo"
3. Click → Modal với form:
   - Radius slider (1-10km)
   - Checkboxes: Lũ, Mưa lớn, Xả hồ, Sạt lở
   - Contact: Email / Telegram username
4. Submit → `POST /api/alerts/subscribe`

---

### Phase 3.2: Alert Engine (Worker)

**Priority: HIGH** - Core logic, nhưng bắt đầu đơn giản

#### 1. Worker Service

**File:** `workers/alert_engine.py`

```python
"""
Alert Engine - Matching hazards with subscriptions

Chạy mỗi 5-10 phút:
1. Lấy hazard_events active, severity >= yellow
2. Query subscriptions trong bán kính ảnh hưởng (PostGIS)
3. Ghi vào alert_notifications
4. Gửi thông báo qua Telegram/Email
"""

import asyncio
from datetime import datetime, timedelta
from app.db import get_session
from sqlalchemy import text

async def run_alert_matching():
    """Match hazards with subscriptions using PostGIS"""

    query = text("""
        SELECT
            s.id as subscription_id,
            s.contact_email,
            s.telegram_chat_id,
            h.id as hazard_id,
            h.title,
            h.severity,
            ST_Distance(
                s.location::geography,
                h.location::geography
            ) / 1000 as distance_km
        FROM alert_subscriptions s
        CROSS JOIN hazard_events h
        WHERE s.is_active = TRUE
          AND h.is_active = TRUE
          AND h.starts_at <= NOW() + INTERVAL '6 hours'
          AND (h.ends_at IS NULL OR h.ends_at >= NOW())
          AND h.type = ANY(s.alert_types)
          AND h.severity >= s.min_severity
          AND ST_DWithin(
              s.location::geography,
              h.location::geography,
              (s.radius_km + COALESCE(h.radius_km, 0)) * 1000
          )
          -- Avoid duplicate notifications (not sent in last 6h)
          AND NOT EXISTS (
              SELECT 1 FROM alert_notifications n
              WHERE n.subscription_id = s.id
                AND n.hazard_id = h.id
                AND n.sent_at > NOW() - INTERVAL '6 hours'
          )
    """)

    async with get_session() as session:
        result = await session.execute(query)
        matches = result.fetchall()

        for match in matches:
            await send_alert(match)
            await log_notification(match)

async def send_alert(match):
    """Send via Telegram/Email"""
    # TODO: Implement
    print(f"🔔 Alert: {match.title} → {match.contact_email or match.telegram_chat_id}")

async def log_notification(match):
    """Log to alert_notifications table"""
    # TODO: Implement
    pass

if __name__ == "__main__":
    while True:
        asyncio.run(run_alert_matching())
        await asyncio.sleep(300)  # 5 minutes
```

#### 2. Bảng `alert_notifications`

```sql
CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subscription_id UUID REFERENCES alert_subscriptions(id),
  hazard_id UUID REFERENCES hazard_events(id),

  -- Notification delivery
  channel VARCHAR(20), -- 'telegram', 'email', 'sms'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,

  -- Message content (for logging)
  message_text TEXT,

  -- Tracking
  read_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_notification_subscription ON alert_notifications(subscription_id);
CREATE INDEX idx_notification_sent ON alert_notifications(sent_at);
```

---

### Phase 3.3: In-App Alert UX

**Priority: MEDIUM** - UI polish

#### 1. Alert Banner Component

**File:** `apps/web/components/AlertBanner.tsx`

```tsx
// Hiển thị ở top màn hình nếu user location trong vùng위험
export default function AlertBanner() {
  const { userLocation } = useLocation()
  const [currentRisk, setCurrentRisk] = useState(null)

  useEffect(() => {
    if (userLocation) {
      fetch(`/api/risks/point?lat=${lat}&lng=${lng}`)
        .then(r => r.json())
        .then(setCurrentRisk)
    }
  }, [userLocation])

  if (!currentRisk || currentRisk.risk_level === 'green') return null

  return (
    <div className={`alert-banner ${currentRisk.risk_level}`}>
      <span className="icon">⚠️</span>
      <strong>Cảnh báo {LEVELS[currentRisk.risk_level]}</strong>
      <p>{currentRisk.explanation}</p>
      <button>Xem chi tiết</button>
    </div>
  )
}
```

#### 2. Nearby Alerts Panel

**File:** `apps/web/components/NearbyAlertsPanel.tsx`

```tsx
// Panel bên cạnh map
export default function NearbyAlertsPanel() {
  const { userLocation } = useLocation()
  const [nearbyHazards, setNearbyHazards] = useState([])

  useEffect(() => {
    if (userLocation) {
      // Lấy hazards trong bán kính 10km
      const bbox = calculateBBox(userLocation, 10)
      fetch(`/api/hazards?bbox=${bbox}`)
        .then(r => r.json())
        .then(data => setNearbyHazards(data.data))
    }
  }, [userLocation])

  return (
    <aside className="nearby-alerts-panel">
      <h3>Cảnh báo quanh bạn (10km)</h3>
      {nearbyHazards.map(h => (
        <AlertCard key={h.id} hazard={h} />
      ))}
    </aside>
  )
}
```

#### 3. User Alerts Page

**File:** `apps/web/app/alerts/page.tsx`

```tsx
// Route: /alerts - Dashboard cảnh báo của user
export default function MyAlertsPage() {
  return (
    <div>
      <h1>Cảnh báo của tôi</h1>

      <section>
        <h2>Đăng ký hiện tại</h2>
        <SubscriptionsList />
      </section>

      <section>
        <h2>Lịch sử cảnh báo</h2>
        <NotificationsHistory />
      </section>
    </div>
  )
}
```

---

## Tầng 4: Tính năng Nâng cao (Giữ chỗ)

**Priority: LOW** - Chỉ cần đặt tên + structure

### 4.1 Safe Route Planning

**Endpoint:** `POST /api/routes/safe`

**Request:**
```json
{
  "origin": {"lat": 16.07, "lng": 108.22},
  "destination": {"lat": 16.05, "lng": 108.25},
  "avoid_hazards": ["flood", "landslide"],
  "avoid_risk_level": "orange"
}
```

**Response:**
```json
{
  "route": {
    "type": "LineString",
    "coordinates": [...]
  },
  "distance_km": 5.2,
  "estimated_time_minutes": 15,
  "warnings": [
    "Tuyến đường qua khu vực cảnh báo vàng tại km 2.3"
  ]
}
```

**Files giữ chỗ:**
- `apps/api/app/routes/routing.py` - 🔒 Empty
- `apps/web/app/routes/page.tsx` - 🔒 Placeholder UI

---

### 4.2 Community Crowdsourcing

**Bảng:** `community_flood_reports`

```sql
-- 🔒 Giữ chỗ: Người dân gửi ảnh + thông tin ngập
CREATE TABLE community_flood_reports (
  id UUID PRIMARY KEY,
  location GEOMETRY(Point, 4326),
  water_depth_cm INTEGER,
  photo_url TEXT[],
  description TEXT,
  reported_by_contact VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoint:** `POST /api/community/report-flood` - 🔒 Giữ chỗ

---

### 4.3 Admin Dashboard

**Route:** `/dashboard/admin` - 🔒 Giữ chỗ

**Features:**
- Tạo/edit hazard events thủ công
- Xem thống kê alert subscriptions
- Monitor alert delivery rates
- Export data (CSV/GeoJSON)

**Files:**
- `apps/web/app/dashboard/admin/page.tsx` - 🔒 Placeholder
- Role-based access (cần auth system)

---

## Implementation Timeline

### Sprint 1: Foundation (Tuần 1-2)
- ✅ Tầng 0 đã hoàn thành
- 🔧 Tầng 1: `hazard_events` + API + UI layer

### Sprint 2: Alert System (Tuần 3-4)
- 🔧 Tầng 3.1: `alert_subscriptions` + API
- 🔧 Tầng 3.2: Alert engine worker (simple version)
- 🔧 Tầng 3.3: UI components (banner + panel)

### Sprint 3: Risk Engine (Tuần 5-6)
- 🔒 Tầng 2: Schema + mock data
- 🔧 Risk API endpoints
- 🔧 Heatmap visualization

### Future Sprints
- 🔒 Tầng 4: Tính năng nâng cao
- 🔒 Ingestion workers (KTTV, press)
- 🔒 ML-based risk scoring

---

## Key Decision Points

### 1. Authentication
**Hiện tại:** Không cần auth, dùng email/telegram_chat_id
**Sau này:** JWT + user accounts (optional)

### 2. Real-time Updates
**Hiện tại:** Polling mỗi 60s
**Sau này:** WebSocket / Server-Sent Events

### 3. Data Sources
**Hiện tại:** Manual input + scraping basic
**Sau này:** API integration với KTTV, NASA IMERG, tide APIs

---

## Success Metrics

### Phase 1 (MVP)
- [ ] 10+ hazard events trên bản đồ
- [ ] 50+ alert subscriptions
- [ ] Alert engine chạy stable 24/7
- [ ] <5s response time cho mọi API

### Phase 2 (Production)
- [ ] 1000+ active subscriptions
- [ ] 95%+ alert delivery rate
- [ ] <1h latency từ hazard xảy ra → user nhận alert
- [ ] Risk scores cover 100% lãnh thổ

---

## Technical Debt & Guardrails

### Tránh

❌ Hardcode severity thresholds (dùng config)
❌ N+1 queries khi load map markers
❌ Lưu geometry dưới dạng text thay vì PostGIS types
❌ Alert logic nằm trong API routes (phải tách worker)

### Best Practices

✅ Migrations cho mọi DB changes
✅ API versioning (`/api/v1/...`)
✅ Monitoring cho worker (health checks, Sentry)
✅ Rate limiting cho public APIs
✅ GeoJSON response caching

---

**Document version:** 1.0
**Last updated:** 2025-11-19
**Maintained by:** Dev Team
