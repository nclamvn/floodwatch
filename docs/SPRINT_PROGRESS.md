# FloodWatch - Sprint Progress Tracker

> **Cập nhật**: 2025-11-19
> **Người thực hiện**: Development Team
> **Mục tiêu**: MVP Prototype - Early Warning System for Vietnam

---

## 🎯 Tổng Quan Roadmap (5 Tầng)

```
┌─────────────────────────────────────────────────────────────┐
│ Tầng 4: Nâng cao (🔒 Giữ chỗ)                               │
│ • Safe Routes + Community Reports + Admin Dashboard        │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│ Tầng 2: Risk Engine (🔒 Giữ chỗ kiến trúc)                  │
│ • area_risk_scores (tính điểm rủi ro khu vực)              │
│ • Historical data analysis                                 │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│ Tầng 3: Alert System (📋 Sprint 2-3 - Sắp làm)              │
│ • alert_subscriptions: User đăng ký cảnh báo               │
│ • alert_engine: Worker match hazard ↔ subscription         │
│ • Notification channels (email, Telegram, in-app)          │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│ Tầng 1: Hazard Events (✅ Sprint 1 - HOÀN THÀNH)            │
│ • Database: hazard_events table (PostGIS)                  │
│ • API: CRUD + spatial filtering                            │
│ • UI: HazardLayer + Admin form (đang làm)                  │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────────────────────────────────────────┐
│ Tầng 0: Hạ tầng & GPS (✅ ĐÃ XONG)                          │
│ • MapLibre + Goong Maps support                            │
│ • GPS location tracking                                    │
│ • User location marker + radius circle                     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Sprint 1: Hazard Events Layer (19/11/2025)

### Mục tiêu
Xây dựng **hệ thống quản lý sự kiện thiên tai** (mưa lớn, lũ, xả hồ, sạt lở, bão, triều cường) làm nền tảng cho toàn bộ tính năng cảnh báo.

### Đã hoàn thành (Backend)

#### 1. Database Schema ✅
**File**: `/apps/api/migrations/versions/008_hazard_events.py`

- ✅ Bảng `hazard_events` với PostGIS support
- ✅ ENUM types:
  - `hazard_type`: 6 loại (heavy_rain, flood, dam_release, landslide, storm, tide_surge)
  - `severity_level`: 5 mức (info, low, medium, high, critical)
- ✅ Spatial indexes (GIST) cho query theo vị trí
- ✅ Time-based indexes cho filter event đang hoạt động
- ✅ Triggers tự động: update timestamp + extract lat/lon

**Schema highlights**:
```sql
CREATE TABLE hazard_events (
  id UUID PRIMARY KEY,
  type hazard_type NOT NULL,              -- Loại thiên tai
  severity severity_level NOT NULL,       -- Mức độ nghiêm trọng
  location GEOGRAPHY(Point, 4326) NOT NULL, -- Vị trí (PostGIS)
  radius_km FLOAT,                        -- Bán kính ảnh hưởng
  starts_at TIMESTAMPTZ NOT NULL,         -- Thời gian bắt đầu
  ends_at TIMESTAMPTZ,                    -- Thời gian kết thúc
  source VARCHAR(100) NOT NULL,           -- Nguồn dữ liệu
  raw_payload JSONB                       -- Metadata bổ sung
);
```

#### 2. Backend Models & Repository ✅
**Files**:
- `/apps/api/app/database/models.py:314-374`
- `/apps/api/app/services/hazard_repo.py`

**Capabilities**:
- ✅ SQLAlchemy ORM với enum value handling
- ✅ Repository pattern cho CRUD operations
- ✅ PostGIS spatial queries:
  - `ST_DWithin()` - Tìm hazards trong bán kính
  - `ST_Distance()` - Tính khoảng cách
- ✅ Haversine formula cho distance calculation
- ✅ Filtering: type, severity, time range, spatial

**Key methods**:
```python
HazardEventRepository.get_all(
    db,
    hazard_types=['flood', 'heavy_rain'],
    severity=['high', 'critical'],
    lat=21.0278, lng=105.8342, radius_km=10,
    active_only=True
)
```

#### 3. REST API Endpoints ✅
**File**: `/apps/api/app/main.py:1564-1756`

| Method | Endpoint | Chức năng | Status |
|--------|----------|-----------|--------|
| GET | `/hazards` | List với filters (type, severity, spatial, time) | ✅ Tested |
| GET | `/hazards/{id}` | Chi tiết 1 event | ✅ Tested |
| POST | `/hazards` | Tạo event mới | ✅ Tested |
| PATCH | `/hazards/{id}` | Cập nhật event | ✅ Tested |
| DELETE | `/hazards/{id}` | Xóa event | ✅ Implemented |

**API Test Results**:
```bash
✅ GET /hazards → 200 OK (1 active hazard)
✅ GET /hazards?lat=21.0278&lng=105.8342&radius_km=15 → 200 OK
✅ GET /hazards/{id} → 200 OK
✅ PATCH /hazards/{id} (severity: critical→medium) → 200 OK
✅ POST /hazards (full payload) → 200 OK
```

#### 4. TypeScript Types (Frontend) ✅
**File**: `/apps/web/types/hazard.ts`

- ✅ Type definitions matching backend
- ✅ Request/Response interfaces
- ✅ Vietnamese labels & icons
- ✅ Severity color mappings

```typescript
export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  heavy_rain: 'Mưa lớn',
  flood: 'Ngập lụt',
  dam_release: 'Xả lũ hồ chứa',
  // ...
}
```

---

### Đang làm (Frontend)

#### 5. HazardLayer Component (In Progress)
**File**: `/apps/web/components/HazardLayer.tsx` (chưa tạo)

**Mục tiêu**:
- [ ] Render hazards as circles on map (radius visualization)
- [ ] Color by severity (critical=red, high=orange, medium=yellow)
- [ ] Popup with event details on click
- [ ] Real-time fetch from API (`GET /hazards?lat=...&lng=...`)
- [ ] Integration with MapViewClustered

#### 6. Admin UI for Hazard Management (Pending)
**File**: `/apps/web/app/admin/hazards/page.tsx` (chưa tạo)

**Mục tiêu**:
- [ ] Form tạo/sửa hazard
- [ ] Type & severity dropdowns
- [ ] DateTimePicker cho starts_at/ends_at
- [ ] Map picker cho location
- [ ] Preview radius circle

#### 7. End-to-End Testing (Pending)
- [ ] Create hazard via admin form → See on map
- [ ] User GPS location + nearby hazard → Distance display
- [ ] Filter hazards by type/severity

---

## 🐛 Technical Issues Resolved

### Issue 1: Enum Conversion Error
**Symptom**: SQLAlchemy gửi `"HEAVY_RAIN"` (enum name) thay vì `"heavy_rain"` (enum value) đến database

**Root Cause**: SQLAlchemy's default Enum behavior uses `.name` instead of `.value`

**Fix**:
```python
# Before
type = Column(SQLEnum(HazardType, name="hazard_type"), nullable=False)

# After
type = Column(
    SQLEnum(HazardType, name="hazard_type",
            values_callable=lambda x: [e.value for e in x]),
    nullable=False
)
```

### Issue 2: SQLAlchemy Caching Error
**Symptom**: `AttributeError: 'TextClause' object has no attribute '_static_cache_key'`

**Root Cause**: Using `text('geography')` in spatial queries breaks caching

**Fix**:
```python
# Before
func.cast(HazardEvent.location, text('geography'))

# After
type_coerce(HazardEvent.location, Geography)
```

---

## 📊 Database Status

### Current Tables
```
✅ hazard_events (8 indexes, 2 triggers)
✅ reports (existing)
✅ road_events (existing)
✅ alert_subscriptions (chưa có - Sprint 2)
✅ alert_notifications (chưa có - Sprint 2)
```

### Sample Data
```sql
-- Active hazard in Hanoi (for testing)
INSERT INTO hazard_events (
  type, severity, location, radius_km,
  starts_at, ends_at, source
) VALUES (
  'flood', 'critical',
  ST_SetSRID(ST_MakePoint(105.8342, 21.0278), 4326),
  10,
  NOW(), NOW() + INTERVAL '12 hours',
  'KTTV'
);
```

---

## 🎯 Sprint 2 Planning (Dự kiến)

### Scope: Alert Subscriptions + Engine (Tầng 3)

#### Phase 1: Subscriptions (Backend + Frontend)
**Timeline**: 3-4 days

1. **Database**:
   - Migration: `alert_subscriptions` table
   - Migration: `alert_notifications` table
   - Migration: `notification_log` table

2. **API Endpoints**:
   - `POST /alerts/subscribe` - Đăng ký cảnh báo
   - `GET /alerts/subscriptions` - Danh sách đăng ký của user
   - `PATCH /alerts/subscriptions/{id}` - Sửa bán kính/severity
   - `DELETE /alerts/subscriptions/{id}` - Hủy đăng ký

3. **Frontend**:
   - Button "Đăng ký cảnh báo" trên map
   - Dialog: chọn radius, severity, types
   - Email confirmation flow

#### Phase 2: Alert Engine (Backend Worker)
**Timeline**: 2-3 days

1. **Worker Service**:
   - Background job chạy mỗi 5-10 phút
   - Query: match `hazard_events` ↔ `alert_subscriptions`
   - PostGIS spatial join: `ST_DWithin(subscription.location, hazard.location, radius)`

2. **Notification Channels** (MVP):
   - In-app log (đầu tiên)
   - Email (Resend API)
   - Telegram (optional)

3. **UX**:
   - Tab "Cảnh báo của tôi"
   - Banner nếu có hazard severity ≥ high trong 3km
   - Badge count trên icon

#### Success Metrics
- [ ] User có thể đăng ký cảnh báo cho 1 vị trí
- [ ] Khi tạo hazard mới, worker tìm được subscriptions khớp
- [ ] Log notification được ghi vào database
- [ ] (Bonus) Email được gửi tới user

---

## 💡 Không Cần Thêm Hạ Tầng Mới

Sprint 1 + Sprint 2 **chạy hoàn toàn trên stack hiện tại**:

- ✅ Docker Compose (web + api + db)
- ✅ PostgreSQL + PostGIS
- ✅ Next.js (web)
- ✅ FastAPI (api)

**Chỉ cần thêm**:
- 1 container cho Alert Worker (Python script + APScheduler)
- Có thể chạy trên cùng VPS hiện tại

---

## 🚀 Demo Workflow (Sau Sprint 2)

1. **User mở app**:
   - Nhấn "Lấy vị trí của tôi" → GPS location = `(21.0278, 105.8342)`

2. **User đăng ký cảnh báo**:
   - Nhấn "Đăng ký cảnh báo"
   - Chọn: radius = 5km, severity ≥ medium, types = flood + heavy_rain
   - Nhận email xác nhận

3. **Admin tạo hazard mới**:
   - Vào `/admin/hazards`
   - Tạo: type=flood, severity=high, location=(21.025, 105.830), radius=10km
   - Click "Tạo"

4. **Alert Engine chạy** (background):
   - 5 phút sau, worker thức dậy
   - Query: "Hazard nào severity ≥ medium trong vòng 24h?"
   - Spatial join: "Subscription nào nằm trong bán kính hazard?"
   - Tìm thấy user → Tạo record `alert_notifications`
   - Gửi email: "⚠️ Ngập lụt mức cao cách bạn 2.3 km"

5. **User thấy cảnh báo**:
   - Mở app → Banner đỏ: "1 cảnh báo mới"
   - Tab "Cảnh báo" → Chi tiết hazard + khoảng cách
   - Map → Circle màu đỏ hiện vùng ảnh hưởng

---

## 📝 Notes for Team

### Strengths of Current Architecture
- ✅ **Spatial-first**: PostGIS queries rất nhanh (GIST indexes)
- ✅ **Type-safe**: TypeScript + Python enums đồng bộ
- ✅ **Scalable schema**: JSONB `raw_payload` cho metadata linh hoạt
- ✅ **Clean separation**: Repository pattern dễ test

### Technical Debt to Watch
- ⚠️ **Authentication**: Hiện tại API endpoints chưa có auth (ok cho MVP)
- ⚠️ **Rate limiting**: Có slowapi nhưng chưa tune cho production
- ⚠️ **Error handling**: Backend 500 errors chưa có error tracking (Sentry)

### Recommended Next Infrastructure (Sau Sprint 2-3)
- [ ] Sentry for error tracking
- [ ] Redis for worker job queue (thay APScheduler)
- [ ] Resend/SendGrid for transactional emails
- [ ] Telegram Bot API cho Telegram alerts

---

**Last Updated**: 2025-11-19
**Contributors**: Development Team
**Status**: ✅ Sprint 1 Backend Complete | 🔧 Sprint 1 Frontend In Progress
