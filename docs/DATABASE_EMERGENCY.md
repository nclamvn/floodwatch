# Emergency Database Schema - Flood Response

> **Context**: Central Vietnam flooding emergency (Khánh Hòa, Lâm Đồng, Quảng Nam, Đà Nẵng, Phú Yên)
> **Priority**: CRITICAL - Life-saving features
> **Timeline**: 24-72 hours

---

## 1. Distress Reports Table (HIGHEST PRIORITY)

### Purpose
Track emergency rescue requests from citizens in flooded/landslide areas.

### Schema

```sql
CREATE TYPE distress_status AS ENUM (
    'pending',      -- Chờ xử lý
    'acknowledged', -- Đã tiếp nhận
    'in_progress',  -- Đang cứu hộ
    'resolved',     -- Đã giải quyết
    'false_alarm'   -- Báo nhầm
);

CREATE TYPE distress_urgency AS ENUM (
    'critical',  -- Nguy hiểm tính mạng (trapped, injured)
    'high',      -- Cần cứu hộ gấp (isolated, no food/water)
    'medium',    -- Cần hỗ trợ (stranded, need evacuation)
    'low'        -- Thông tin chung
);

CREATE TABLE distress_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Location (PostGIS)
    location GEOGRAPHY(Point, 4326) NOT NULL,
    lat FLOAT,  -- Auto-extracted via trigger
    lon FLOAT,  -- Auto-extracted via trigger

    -- Status & Urgency
    status distress_status NOT NULL DEFAULT 'pending',
    urgency distress_urgency NOT NULL DEFAULT 'high',

    -- Report Details
    description TEXT NOT NULL,
    num_people INT DEFAULT 1,  -- Số người cần cứu
    has_injuries BOOLEAN DEFAULT FALSE,
    has_children BOOLEAN DEFAULT FALSE,
    has_elderly BOOLEAN DEFAULT FALSE,

    -- Contact Info (optional - người báo có thể ẩn danh)
    contact_name VARCHAR(255),
    contact_phone VARCHAR(20),

    -- Media Evidence
    media_urls TEXT[],  -- Array of image/video URLs

    -- Source & Verification
    source VARCHAR(50) NOT NULL DEFAULT 'user_report',  -- user_report, hotline, social_media, authority
    verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ,

    -- Admin Notes
    admin_notes TEXT,
    assigned_to VARCHAR(255),  -- Đơn vị cứu hộ được giao
    resolved_at TIMESTAMPTZ,

    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('vietnamese', coalesce(description, '') || ' ' || coalesce(contact_name, ''))
    ) STORED
);

-- Indexes for emergency queries
CREATE INDEX idx_distress_location ON distress_reports USING GIST(location);
CREATE INDEX idx_distress_status ON distress_reports(status) WHERE status IN ('pending', 'acknowledged', 'in_progress');
CREATE INDEX idx_distress_urgency ON distress_reports(urgency);
CREATE INDEX idx_distress_created ON distress_reports(created_at DESC);
CREATE INDEX idx_distress_search ON distress_reports USING GIN(search_vector);

-- Trigger: Extract lat/lon from PostGIS geography
CREATE TRIGGER distress_extract_coords
    BEFORE INSERT OR UPDATE ON distress_reports
    FOR EACH ROW
    EXECUTE FUNCTION extract_lat_lon_from_geography();

-- Trigger: Update timestamp
CREATE TRIGGER distress_updated_at
    BEFORE UPDATE ON distress_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. Traffic Disruptions Table (HIGH PRIORITY)

### Purpose
Track road closures, bridge collapses, landslides blocking roads during flood.

### Schema

```sql
CREATE TYPE disruption_type AS ENUM (
    'flooded_road',      -- Đường ngập
    'landslide',         -- Sạt lở
    'bridge_collapsed',  -- Cầu sập
    'bridge_flooded',    -- Cầu ngập
    'traffic_jam',       -- Kẹt xe do lũ
    'road_damaged',      -- Đường hư hỏng
    'blocked'            -- Bị chặn (không rõ lý do)
);

CREATE TYPE disruption_severity AS ENUM (
    'impassable',  -- Không thể đi qua
    'dangerous',   -- Nguy hiểm (có thể qua nhưng rủi ro cao)
    'slow',        -- Đi chậm
    'warning'      -- Cảnh báo
);

CREATE TABLE traffic_disruptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Location (can be POINT or LINESTRING for road segments)
    location GEOGRAPHY(Point, 4326) NOT NULL,
    lat FLOAT,
    lon FLOAT,

    -- Road segment (optional - if available)
    road_geometry GEOGRAPHY(LineString, 4326),  -- Đoạn đường bị ảnh hưởng

    -- Disruption Details
    type disruption_type NOT NULL,
    severity disruption_severity NOT NULL DEFAULT 'impassable',

    -- Location Description
    road_name VARCHAR(255),  -- VD: "QL1A", "Đường Hùng Vương"
    location_description TEXT NOT NULL,  -- VD: "QL27 Km 15, đoạn Nha Trang - Đà Lạt"

    -- Impact
    description TEXT,  -- Chi tiết tình trạng
    estimated_clearance TIMESTAMPTZ,  -- Dự kiến thông xe
    alternative_route TEXT,  -- Đường tránh (nếu có)

    -- Time Range
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,  -- NULL = chưa rõ khi nào thông

    -- Source & Status
    source VARCHAR(100) NOT NULL,  -- CSGT, user_report, authority, news
    verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Related Hazard (if linked to a hazard event)
    hazard_event_id UUID REFERENCES hazard_events(id) ON DELETE SET NULL,

    -- Media
    media_urls TEXT[],

    -- Admin
    admin_notes TEXT
);

-- Indexes
CREATE INDEX idx_traffic_location ON traffic_disruptions USING GIST(location);
CREATE INDEX idx_traffic_road_geometry ON traffic_disruptions USING GIST(road_geometry) WHERE road_geometry IS NOT NULL;
CREATE INDEX idx_traffic_active ON traffic_disruptions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_traffic_severity ON traffic_disruptions(severity);
CREATE INDEX idx_traffic_type ON traffic_disruptions(type);
CREATE INDEX idx_traffic_hazard ON traffic_disruptions(hazard_event_id) WHERE hazard_event_id IS NOT NULL;

-- Triggers
CREATE TRIGGER traffic_extract_coords
    BEFORE INSERT OR UPDATE ON traffic_disruptions
    FOR EACH ROW
    EXECUTE FUNCTION extract_lat_lon_from_geography();

CREATE TRIGGER traffic_updated_at
    BEFORE UPDATE ON traffic_disruptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Enhance Hazard Events Table (MEDIUM PRIORITY)

### Add Polygon Support

```sql
-- Add polygon support to existing hazard_events table
ALTER TABLE hazard_events
ADD COLUMN impact_geometry GEOGRAPHY(Polygon, 4326);

-- Index for polygon queries
CREATE INDEX idx_hazard_impact_geometry
ON hazard_events USING GIST(impact_geometry)
WHERE impact_geometry IS NOT NULL;

-- Comment
COMMENT ON COLUMN hazard_events.impact_geometry IS
'Actual affected area as polygon (more accurate than circle from radius_km)';
```

**Usage**:
- `radius_km` → auto-generate circle (current behavior)
- `impact_geometry` → manual polygon (for complex flood zones, river basins)

---

## 4. Migration Scripts

### Migration Order

```python
# /apps/api/migrations/versions/009_emergency_distress.py
"""Add distress_reports table for emergency rescue tracking"""

def upgrade():
    # Create enums
    op.execute("""
        CREATE TYPE distress_status AS ENUM (
            'pending', 'acknowledged', 'in_progress', 'resolved', 'false_alarm'
        );
        CREATE TYPE distress_urgency AS ENUM (
            'critical', 'high', 'medium', 'low'
        );
    """)

    # Create table (full SQL from above)
    op.execute("""
        CREATE TABLE distress_reports (
            -- [copy full schema from above]
        );
    """)

    # Create indexes
    # Create triggers

def downgrade():
    op.execute("DROP TABLE IF EXISTS distress_reports CASCADE;")
    op.execute("DROP TYPE IF EXISTS distress_status CASCADE;")
    op.execute("DROP TYPE IF EXISTS distress_urgency CASCADE;")
```

```python
# /apps/api/migrations/versions/010_emergency_traffic.py
"""Add traffic_disruptions table for road closures tracking"""

def upgrade():
    # Create enums
    op.execute("""
        CREATE TYPE disruption_type AS ENUM (
            'flooded_road', 'landslide', 'bridge_collapsed',
            'bridge_flooded', 'traffic_jam', 'road_damaged', 'blocked'
        );
        CREATE TYPE disruption_severity AS ENUM (
            'impassable', 'dangerous', 'slow', 'warning'
        );
    """)

    # Create table
    # Create indexes
    # Create triggers

def downgrade():
    op.execute("DROP TABLE IF EXISTS traffic_disruptions CASCADE;")
    op.execute("DROP TYPE IF EXISTS disruption_type CASCADE;")
    op.execute("DROP TYPE IF EXISTS disruption_severity CASCADE;")
```

```python
# /apps/api/migrations/versions/011_hazard_polygon.py
"""Add polygon support to hazard_events"""

def upgrade():
    op.execute("""
        ALTER TABLE hazard_events
        ADD COLUMN impact_geometry GEOGRAPHY(Polygon, 4326);

        CREATE INDEX idx_hazard_impact_geometry
        ON hazard_events USING GIST(impact_geometry)
        WHERE impact_geometry IS NOT NULL;
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_hazard_impact_geometry;")
    op.execute("ALTER TABLE hazard_events DROP COLUMN IF EXISTS impact_geometry;")
```

---

## 5. Repository Classes (Quick Spec)

### DistressReportRepository

```python
class DistressReportRepository:
    @staticmethod
    def create(db: Session, data: dict) -> DistressReport:
        """Create new distress report"""

    @staticmethod
    def get_active(db: Session, statuses: list = None) -> List[DistressReport]:
        """Get active distress reports (pending, in_progress, acknowledged)"""

    @staticmethod
    def get_nearby(db: Session, lat: float, lon: float, radius_km: float = 10) -> List[DistressReport]:
        """Get distress reports within radius"""

    @staticmethod
    def update_status(db: Session, report_id: str, status: str, notes: str = None):
        """Update report status (admin action)"""
```

### TrafficDisruptionRepository

```python
class TrafficDisruptionRepository:
    @staticmethod
    def create(db: Session, data: dict) -> TrafficDisruption:
        """Create new traffic disruption"""

    @staticmethod
    def get_active(db: Session) -> List[TrafficDisruption]:
        """Get active disruptions (is_active=true, ends_at is NULL or future)"""

    @staticmethod
    def get_by_road(db: Session, road_name: str) -> List[TrafficDisruption]:
        """Get disruptions for specific road"""

    @staticmethod
    def get_in_area(db: Session, lat: float, lon: float, radius_km: float) -> List[TrafficDisruption]:
        """Get disruptions within area"""
```

---

## 6. Estimated Timeline

| Task | Time | Priority |
|------|------|----------|
| Write migration 009 (distress) | 30 min | CRITICAL |
| Write migration 010 (traffic) | 30 min | CRITICAL |
| Run migrations | 5 min | CRITICAL |
| DistressReportRepository | 45 min | CRITICAL |
| TrafficDisruptionRepository | 45 min | CRITICAL |
| Test spatial queries | 20 min | CRITICAL |
| **TOTAL** | **3 hours** | |

---

## 7. Sample Data (For Testing)

```sql
-- Distress report in Nha Trang (flooded area)
INSERT INTO distress_reports (
    location, urgency, description, num_people, has_children, source
) VALUES (
    ST_SetSRID(ST_MakePoint(109.1967, 12.2388), 4326),
    'critical',
    'Nhà bị ngập sâu 1.5m, có 2 người già và 3 trẻ em, không thể di chuyển',
    5,
    TRUE,
    'user_report'
);

-- Traffic disruption on QL27
INSERT INTO traffic_disruptions (
    location, type, severity, road_name, location_description, description, source
) VALUES (
    ST_SetSRID(ST_MakePoint(108.9878, 12.1234), 4326),
    'landslide',
    'impassable',
    'QL27',
    'QL27 Km 15, đoạn Nha Trang - Đà Lạt',
    'Sạt lở núi, đất đá vùi đường, tắc hoàn toàn. Ước tính phải 24h mới thông',
    'CSGT'
);
```

---

## Next Steps

1. ✅ Create migrations 009, 010, 011
2. ✅ Run migrations in dev environment
3. ✅ Create repository classes
4. ✅ Create API endpoints (see API_EMERGENCY.md)
5. ✅ Create frontend components (map layers + forms)

**Ready to start coding immediately.**
