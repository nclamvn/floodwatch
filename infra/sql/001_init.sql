-- FloodWatch Database Initialization Script
-- PostgreSQL 15 + PostGIS 3.4

-- Enable PostGIS extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reports table (alerts, community reports, rainfall data)
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL CHECK (type IN ('ALERT', 'RAIN', 'ROAD', 'SOS', 'NEEDS')),
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    province TEXT,
    district TEXT,
    ward TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    location GEOMETRY(Point, 4326),
    trust_score REAL DEFAULT 0.0 CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
    media JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'verified', 'merged', 'resolved', 'invalid'))
);

-- Create spatial index on location
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST(location);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_province ON reports(province);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_trust_score ON reports(trust_score DESC);

-- Composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_reports_type_province_created ON reports(type, province, created_at DESC);

-- Road events table (road status tracking)
CREATE TABLE IF NOT EXISTS road_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    segment_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'RESTRICTED')),
    reason TEXT,
    province TEXT,
    district TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    location GEOMETRY(Point, 4326),
    last_verified TIMESTAMPTZ,
    source TEXT DEFAULT 'PRESS'
);

-- Spatial index for road events
CREATE INDEX IF NOT EXISTS idx_road_events_location ON road_events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_road_events_status ON road_events(status);
CREATE INDEX IF NOT EXISTS idx_road_events_province ON road_events(province);
CREATE INDEX IF NOT EXISTS idx_road_events_last_verified ON road_events(last_verified DESC);

-- Function to automatically update location from lat/lon
CREATE OR REPLACE FUNCTION update_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update location
CREATE TRIGGER reports_update_location
BEFORE INSERT OR UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION update_location();

CREATE TRIGGER road_events_update_location
BEFORE INSERT OR UPDATE ON road_events
FOR EACH ROW
EXECUTE FUNCTION update_location();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER reports_update_timestamp
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER road_events_update_timestamp
BEFORE UPDATE ON road_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Seed some mock data for development
INSERT INTO reports (type, source, title, description, province, lat, lon, trust_score, status) VALUES
    ('ALERT', 'KTTV', 'Cảnh báo mưa lớn Quảng Nam', 'Dự báo mưa 100-200mm trong 24h', 'Quảng Nam', 15.5769, 108.4799, 0.8, 'new'),
    ('ALERT', 'NCHMF', 'Nguy cơ lũ quét Thừa Thiên Huế', 'Mưa lũ kéo dài, sông dâng cao', 'Thừa Thiên Huế', 16.4637, 107.5909, 0.9, 'new'),
    ('SOS', 'COMMUNITY', 'Cần cứu trợ gấp', 'Gia đình 5 người bị cô lập, cần thực phẩm', 'Quảng Bình', 17.4680, 106.6232, 0.6, 'new')
ON CONFLICT DO NOTHING;

INSERT INTO road_events (segment_name, status, reason, province, lat, lon, last_verified) VALUES
    ('QL1A Đèo Hải Vân', 'OPEN', NULL, 'Đà Nẵng', 16.1974, 108.1253, CURRENT_TIMESTAMP),
    ('QL9 Quảng Trị - Lao Bảo', 'RESTRICTED', 'Mưa lớn, giảm tốc độ', 'Quảng Trị', 16.7463, 106.7303, CURRENT_TIMESTAMP),
    ('Đường Hồ Chí Minh đoạn Bến Giằng', 'CLOSED', 'Sạt lở nghiêm trọng', 'Quảng Nam', 15.5400, 107.9200, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust user as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO floodwatch_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO floodwatch_user;
