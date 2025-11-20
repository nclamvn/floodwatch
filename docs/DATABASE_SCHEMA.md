# FloodWatch Database Schema

> **Tài liệu kỹ thuật**: Schema + Spatial Relationships + PostGIS Queries

---

## 📊 Entity Relationship Diagram (Text-based)

```
┌─────────────────────┐
│   hazard_events     │ ◄─────────┐
├─────────────────────┤           │
│ id (PK)             │           │
│ type (ENUM)         │           │ SPATIAL JOIN
│ severity (ENUM)     │           │ ST_DWithin()
│ location (GEOMETRY) │           │
│ radius_km           │           │
│ starts_at           │           │
│ ends_at             │           │
│ source              │           │
│ raw_payload (JSONB) │           │
└─────────────────────┘           │
         │                        │
         │ 1:N                    │
         ▼                        │
┌─────────────────────┐           │
│ alert_notifications │           │
├─────────────────────┤           │
│ id (PK)             │           │
│ subscription_id (FK)│───────┐   │
│ hazard_event_id (FK)│       │   │
│ severity            │       │   │
│ triggered_at        │       │   │
│ sent_at             │       │   │
│ status              │       │   │
└─────────────────────┘       │   │
                              │   │
                              │   │
                              ▼   │
                    ┌─────────────────────┐
                    │ alert_subscriptions │
                    ├─────────────────────┤
                    │ id (PK)             │
                    │ contact_email       │
                    │ telegram_chat_id    │
                    │ location (GEOMETRY) │───┘
                    │ radius_km           │
                    │ alert_types[]       │
                    │ notify_via[]        │
                    │ is_active           │
                    │ created_at          │
                    └─────────────────────┘
                              │
                              │ 1:N
                              ▼
                    ┌─────────────────────┐
                    │ notification_log    │
                    ├─────────────────────┤
                    │ id (PK)             │
                    │ subscription_id (FK)│
                    │ notification_id (FK)│
                    │ channel             │
                    │ sent_at             │
                    │ delivery_status     │
                    │ error_message       │
                    └─────────────────────┘


┌─────────────────────┐
│   area_risk_scores  │ ◄──── SPATIAL
├─────────────────────┤       AGGREGATION
│ id (PK)             │       (From hazard_events)
│ area_geom (GEOM)    │
│ district_name       │
│ risk_level          │
│ score               │
│ calculated_at       │
│ factors (JSONB)     │
└─────────────────────┘


┌─────────────────────┐
│   community_reports │ (Tầng 4 - Future)
├─────────────────────┤
│ id (PK)             │
│ location (GEOMETRY) │
│ report_type         │
│ severity            │
│ description         │
│ photo_urls[]        │
│ verified            │
│ created_at          │
└─────────────────────┘
```

---

## 🗄️ Core Table Schemas

### 1. `hazard_events` (Tầng 1 - ✅ Làm ngay)

Bảng trung tâm lưu trữ sự kiện thiên tai từ nhiều nguồn.

```sql
-- ENUM types
CREATE TYPE hazard_type AS ENUM (
  'heavy_rain',    -- Mưa lớn
  'flood',         -- Ngập lụt
  'dam_release',   -- Xả lũ hồ chứa
  'landslide',     -- Sạt lở đất
  'storm',         -- Bão
  'tide_surge'     -- Triều cường
);

CREATE TYPE severity_level AS ENUM (
  'info',          -- Thông tin
  'low',           -- Thấp
  'medium',        -- Trung bình
  'high',          -- Cao
  'critical'       -- Khẩn cấp
);

-- Main table
CREATE TABLE hazard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event classification
  type hazard_type NOT NULL,
  severity severity_level NOT NULL,

  -- Spatial data (PostGIS)
  location GEOMETRY(Point, 4326) NOT NULL,
  affected_area GEOMETRY(Polygon, 4326),  -- Optional polygon for floods/storms
  radius_km FLOAT,  -- Bán kính ảnh hưởng (km)

  -- Time range
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,  -- NULL for ongoing events

  -- Data source
  source VARCHAR(100) NOT NULL,  -- 'KTTV', 'manual_admin', 'scraper_vnexpress', etc.
  external_id VARCHAR(255),      -- ID từ nguồn bên ngoài
  raw_payload JSONB,             -- Dữ liệu gốc từ API

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,  -- FK to users (future)

  -- Indexes
  CONSTRAINT valid_radius CHECK (radius_km IS NULL OR radius_km > 0)
);

-- Spatial index for fast location queries
CREATE INDEX idx_hazard_events_location ON hazard_events USING GIST (location);
CREATE INDEX idx_hazard_events_affected_area ON hazard_events USING GIST (affected_area);
CREATE INDEX idx_hazard_events_time_range ON hazard_events USING BTREE (starts_at, ends_at);
CREATE INDEX idx_hazard_events_type_severity ON hazard_events (type, severity);
```

**Example data**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "heavy_rain",
  "severity": "high",
  "location": "POINT(105.8342 21.0278)",  // Hà Nội
  "radius_km": 15,
  "starts_at": "2025-01-19T14:00:00Z",
  "ends_at": "2025-01-20T02:00:00Z",
  "source": "KTTV",
  "raw_payload": {
    "rainfall_mm": 120,
    "warning_level": 3,
    "affected_districts": ["Ba Đình", "Hoàn Kiếm"]
  }
}
```

---

### 2. `alert_subscriptions` (Tầng 3.1 - 🔧 Làm sớm)

Lưu thông tin đăng ký cảnh báo của người dùng.

```sql
CREATE TABLE alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User contact info (at least one required)
  contact_email VARCHAR(255),
  telegram_chat_id BIGINT,
  phone_number VARCHAR(20),  -- Future: SMS alerts

  -- Location preferences
  location GEOMETRY(Point, 4326) NOT NULL,  -- Điểm quan tâm (nhà, công ty...)
  radius_km FLOAT DEFAULT 3 CHECK (radius_km > 0 AND radius_km <= 50),

  -- Alert preferences
  alert_types hazard_type[] DEFAULT ARRAY['flood', 'heavy_rain', 'dam_release']::hazard_type[],
  min_severity severity_level DEFAULT 'medium',  -- Chỉ nhận từ mức này trở lên
  notify_via VARCHAR(50)[] DEFAULT ARRAY['email']::VARCHAR[],  -- ['email', 'telegram', 'sms']

  -- Schedule (future)
  quiet_hours_start TIME,  -- VD: 22:00
  quiet_hours_end TIME,    -- VD: 07:00

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  confirmed BOOLEAN DEFAULT FALSE,  -- Email confirmation required
  confirmation_token VARCHAR(64),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT has_contact_method CHECK (
    contact_email IS NOT NULL OR
    telegram_chat_id IS NOT NULL OR
    phone_number IS NOT NULL
  )
);

-- Spatial index for alert matching
CREATE INDEX idx_subscriptions_location ON alert_subscriptions USING GIST (location);
CREATE INDEX idx_subscriptions_active ON alert_subscriptions (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subscriptions_email ON alert_subscriptions (contact_email);
CREATE INDEX idx_subscriptions_telegram ON alert_subscriptions (telegram_chat_id);
```

**Example data**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "contact_email": "user@example.com",
  "telegram_chat_id": 123456789,
  "location": "POINT(105.8342 21.0278)",
  "radius_km": 5,
  "alert_types": ["flood", "heavy_rain", "dam_release"],
  "min_severity": "medium",
  "notify_via": ["email", "telegram"],
  "is_active": true,
  "confirmed": true
}
```

---

### 3. `alert_notifications` (Tầng 3.2 - 🔧 Làm sau subscriptions)

Log tất cả cảnh báo được trigger.

```sql
CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  subscription_id UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  hazard_event_id UUID NOT NULL REFERENCES hazard_events(id) ON DELETE CASCADE,

  -- Alert details
  severity severity_level NOT NULL,
  distance_km FLOAT,  -- Khoảng cách từ user location đến hazard
  message_template VARCHAR(50) DEFAULT 'default',  -- For A/B testing

  -- Delivery tracking
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivery_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'skipped'
  retry_count INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_subscription ON alert_notifications (subscription_id);
CREATE INDEX idx_notifications_hazard ON alert_notifications (hazard_event_id);
CREATE INDEX idx_notifications_status ON alert_notifications (delivery_status, triggered_at);
```

---

### 4. `notification_log` (Tầng 3.2)

Chi tiết delivery cho từng kênh (email, telegram, SMS).

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  subscription_id UUID NOT NULL REFERENCES alert_subscriptions(id),
  notification_id UUID NOT NULL REFERENCES alert_notifications(id),

  -- Channel details
  channel VARCHAR(20) NOT NULL,  -- 'email', 'telegram', 'sms'
  recipient VARCHAR(255) NOT NULL,  -- Email address, chat_id, or phone

  -- Delivery tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status VARCHAR(20) DEFAULT 'sent',  -- 'sent', 'delivered', 'failed', 'bounced'
  error_message TEXT,

  -- Provider metadata (for debugging)
  provider_response JSONB,  -- Response from Resend, Telegram API, etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_notification ON notification_log (notification_id);
CREATE INDEX idx_notification_log_channel ON notification_log (channel, delivery_status);
```

---

### 5. `area_risk_scores` (Tầng 2 - 🔒 Giữ chỗ)

Điểm rủi ro cho các khu vực (tính từ hazard_events + historical data).

```sql
CREATE TYPE risk_level AS ENUM ('very_low', 'low', 'moderate', 'high', 'very_high');

CREATE TABLE area_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Area definition
  area_geom GEOMETRY(Polygon, 4326) NOT NULL,  -- Polygon của quận/huyện
  district_name VARCHAR(255),
  province_name VARCHAR(255),

  -- Risk assessment
  risk_level risk_level NOT NULL,
  score FLOAT CHECK (score >= 0 AND score <= 100),  -- 0-100

  -- Contributing factors (stored as JSONB for flexibility)
  factors JSONB,  -- { "flood_history": 0.6, "elevation": 0.3, "drainage": 0.1 }

  -- Time tracking
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,  -- Re-calculate periodically

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_area_risk_geom ON area_risk_scores USING GIST (area_geom);
CREATE INDEX idx_area_risk_level ON area_risk_scores (risk_level);
```

---

## 🌍 PostGIS Spatial Queries

### Query 1: Find All Hazards Within User's Alert Radius

```sql
-- Input: user location (lat, lng) and radius_km
-- Output: List of active hazard events

SELECT
  he.id,
  he.type,
  he.severity,
  ST_Distance(
    he.location::geography,
    ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)::geography
  ) / 1000 AS distance_km,
  he.starts_at,
  he.ends_at
FROM hazard_events he
WHERE
  -- Spatial filter
  ST_DWithin(
    he.location::geography,
    ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)::geography,
    :radius_km * 1000  -- Convert km to meters
  )
  -- Time filter: only active or future events
  AND (he.ends_at IS NULL OR he.ends_at > NOW())
  AND he.starts_at < NOW() + INTERVAL '24 hours'
ORDER BY distance_km ASC;
```

**Example usage**:
```typescript
const { data } = await supabase.rpc('get_nearby_hazards', {
  user_lat: 21.0278,
  user_lng: 105.8342,
  radius_km: 5
})
```

---

### Query 2: Match Hazard Events to Alert Subscriptions

```sql
-- Used by Alert Engine worker
-- Find all subscriptions that should be notified about a new hazard event

SELECT
  asub.id AS subscription_id,
  asub.contact_email,
  asub.telegram_chat_id,
  asub.notify_via,
  ST_Distance(
    asub.location::geography,
    he.location::geography
  ) / 1000 AS distance_km,
  he.id AS hazard_event_id,
  he.type,
  he.severity
FROM alert_subscriptions asub
CROSS JOIN hazard_events he
WHERE
  -- Subscription is active
  asub.is_active = TRUE
  AND asub.confirmed = TRUE

  -- Spatial match: hazard within user's alert radius
  AND ST_DWithin(
    asub.location::geography,
    he.location::geography,
    asub.radius_km * 1000
  )

  -- Type filter: user wants this type of alert
  AND he.type = ANY(asub.alert_types)

  -- Severity filter: meets minimum threshold
  AND he.severity::text >= asub.min_severity::text  -- ENUM comparison

  -- Time filter: event is active or upcoming
  AND (he.ends_at IS NULL OR he.ends_at > NOW())
  AND he.starts_at < NOW() + INTERVAL '6 hours'

  -- Deduplication: don't re-notify if already sent
  AND NOT EXISTS (
    SELECT 1 FROM alert_notifications an
    WHERE an.subscription_id = asub.id
      AND an.hazard_event_id = he.id
      AND an.delivery_status IN ('sent', 'pending')
  )

  -- Respect quiet hours (if set)
  AND (
    asub.quiet_hours_start IS NULL
    OR CURRENT_TIME NOT BETWEEN asub.quiet_hours_start AND asub.quiet_hours_end
  )
ORDER BY distance_km ASC;
```

**Efficiency notes**:
- Spatial index `idx_subscriptions_location` + `idx_hazard_events_location` make ST_DWithin very fast
- ENUM comparison works: `'high'::severity_level >= 'medium'::severity_level` returns TRUE
- `NOT EXISTS` subquery prevents duplicate notifications

---

### Query 3: Calculate Risk Score for an Area

```sql
-- Calculate flood risk for a district based on historical events
-- Input: district polygon geometry
-- Output: risk score (0-100)

WITH historical_events AS (
  SELECT
    COUNT(*) AS event_count,
    AVG(CASE
      WHEN severity = 'critical' THEN 5
      WHEN severity = 'high' THEN 4
      WHEN severity = 'medium' THEN 3
      WHEN severity = 'low' THEN 2
      ELSE 1
    END) AS avg_severity
  FROM hazard_events
  WHERE
    type IN ('flood', 'heavy_rain')
    AND ST_Intersects(location, :district_geom)
    AND starts_at > NOW() - INTERVAL '3 years'  -- Last 3 years
)
SELECT
  LEAST(100, (event_count * 10 + avg_severity * 15)) AS risk_score,
  CASE
    WHEN event_count >= 10 THEN 'very_high'::risk_level
    WHEN event_count >= 5 THEN 'high'::risk_level
    WHEN event_count >= 2 THEN 'moderate'::risk_level
    ELSE 'low'::risk_level
  END AS risk_level
FROM historical_events;
```

---

### Query 4: Find Safe Routes (Tầng 4 - Future)

```sql
-- Find path from A to B avoiding flooded areas
-- Requires: pgRouting extension + road network table

SELECT
  seq,
  node,
  edge,
  cost,
  ST_AsGeoJSON(geom) AS route_segment
FROM pgr_dijkstra(
  'SELECT id, source, target, cost, reverse_cost FROM road_network
   WHERE NOT EXISTS (
     SELECT 1 FROM hazard_events he
     WHERE he.type = ''flood''
       AND ST_DWithin(road_network.geom::geography, he.location::geography, he.radius_km * 1000)
       AND (he.ends_at IS NULL OR he.ends_at > NOW())
   )',
  :start_node,
  :end_node,
  directed := false
) AS route
JOIN road_network rn ON route.edge = rn.id;
```

---

## 🔗 Table Relationships Summary

| Parent Table          | Child Table           | Relationship | Join Condition                |
|-----------------------|-----------------------|--------------|-------------------------------|
| `hazard_events`       | `alert_notifications` | 1:N          | `hazard_event_id` FK          |
| `alert_subscriptions` | `alert_notifications` | 1:N          | `subscription_id` FK          |
| `alert_subscriptions` | `notification_log`    | 1:N          | `subscription_id` FK          |
| `alert_notifications` | `notification_log`    | 1:N          | `notification_id` FK          |
| (spatial join)        | (any table)           | M:N          | `ST_DWithin()`, `ST_Intersects()` |

---

## 📈 Index Strategy

### Critical Indexes (Must have for production):
1. **Spatial indexes** on all GEOMETRY columns (GIST)
2. **Time range** indexes on `starts_at`, `ends_at` (BTREE)
3. **Foreign key** indexes on all FK columns
4. **Composite** index on `(type, severity)` for hazard_events
5. **Partial** index on `is_active = TRUE` for subscriptions

### Query optimization:
- Use `EXPLAIN ANALYZE` to verify spatial index usage
- Consider materialized views for complex risk calculations
- Partition `alert_notifications` by month if volume is high (>10M rows)

---

## 🔄 Data Flow

```
1. Hazard Event Created
   ↓
2. Alert Engine Worker (runs every 5 minutes)
   ↓
3. Spatial Query: Match events to subscriptions
   ↓
4. Create `alert_notifications` records
   ↓
5. Notification Worker (separate process)
   ↓
6. Send via channels (email, telegram, SMS)
   ↓
7. Log delivery in `notification_log`
   ↓
8. Update `delivery_status` in `alert_notifications`
```

---

## ⚠️ Important Notes

1. **Always use geography casting** for distance calculations:
   ```sql
   ST_DWithin(location::geography, ...)  -- meters
   -- NOT: ST_DWithin(location::geometry, ...)  -- degrees (wrong!)
   ```

2. **SRID 4326** is WGS84 (lat/lng), standard for web maps

3. **Indexes are critical**: Without spatial indexes, queries will be 100-1000x slower

4. **Timezone handling**: Always use `TIMESTAMPTZ` (with timezone), not `TIMESTAMP`

5. **JSONB vs JSON**: Use JSONB for `raw_payload` and `factors` (faster queries, supports indexing)

---

**Last updated**: 2025-01-19
**Version**: 1.0
**Status**: 🔧 Schema locked for Tầng 1-3, 🔒 Tầng 4 reserved
