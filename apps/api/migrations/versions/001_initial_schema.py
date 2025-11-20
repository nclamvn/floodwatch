"""Initial schema with PostGIS

Revision ID: 001
Revises:
Create Date: 2025-10-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # Create report_type enum
    report_type_enum = postgresql.ENUM('ALERT', 'RAIN', 'ROAD', 'SOS', 'NEEDS', name='report_type', create_type=True)
    report_type_enum.create(op.get_bind(), checkfirst=True)

    # Create road_status enum
    road_status_enum = postgresql.ENUM('OPEN', 'CLOSED', 'RESTRICTED', name='road_status', create_type=True)
    road_status_enum.create(op.get_bind(), checkfirst=True)

    # Create reports table
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('type', postgresql.ENUM('ALERT', 'RAIN', 'ROAD', 'SOS', 'NEEDS', name='report_type', create_type=False), nullable=False),
        sa.Column('source', sa.String(100), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('province', sa.String(100)),
        sa.Column('district', sa.String(100)),
        sa.Column('ward', sa.String(100)),
        sa.Column('lat', sa.Float()),
        sa.Column('lon', sa.Float()),
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326)),
        sa.Column('trust_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('media', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('status', sa.String(50), server_default='new', nullable=False),
        sa.CheckConstraint('trust_score >= 0.0 AND trust_score <= 1.0', name='check_trust_score'),
        sa.CheckConstraint("status IN ('new', 'verified', 'merged', 'resolved', 'invalid')", name='check_status'),
    )

    # Create indexes for reports
    # Note: idx_reports_location is automatically created by GeoAlchemy2 for Geography columns
    op.create_index('idx_reports_type', 'reports', ['type'])
    op.create_index('idx_reports_province', 'reports', ['province'])
    op.create_index('idx_reports_created_at', 'reports', ['created_at'], postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_reports_status', 'reports', ['status'])
    op.create_index('idx_reports_trust_score', 'reports', ['trust_score'], postgresql_ops={'trust_score': 'DESC'})
    op.create_index('idx_reports_type_province_created', 'reports', ['type', 'province', 'created_at'], postgresql_ops={'created_at': 'DESC'})

    # Create road_events table
    op.create_table(
        'road_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('segment_name', sa.String(500), nullable=False),
        sa.Column('status', postgresql.ENUM('OPEN', 'CLOSED', 'RESTRICTED', name='road_status', create_type=False), nullable=False),
        sa.Column('reason', sa.Text()),
        sa.Column('province', sa.String(100)),
        sa.Column('district', sa.String(100)),
        sa.Column('lat', sa.Float()),
        sa.Column('lon', sa.Float()),
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326)),
        sa.Column('last_verified', sa.DateTime(timezone=True)),
        sa.Column('source', sa.String(100), server_default='PRESS'),
    )

    # Create indexes for road_events
    # Note: idx_road_events_location is automatically created by GeoAlchemy2 for Geography columns
    op.create_index('idx_road_events_status', 'road_events', ['status'])
    op.create_index('idx_road_events_province', 'road_events', ['province'])
    op.create_index('idx_road_events_last_verified', 'road_events', ['last_verified'], postgresql_ops={'last_verified': 'DESC'})

    # Create trigger function to update location from lat/lon
    op.execute("""
        CREATE OR REPLACE FUNCTION update_location()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
                NEW.location := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326)::geography;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create triggers
    op.execute("""
        CREATE TRIGGER reports_update_location
        BEFORE INSERT OR UPDATE ON reports
        FOR EACH ROW
        EXECUTE FUNCTION update_location();
    """)

    op.execute("""
        CREATE TRIGGER road_events_update_location
        BEFORE INSERT OR UPDATE ON road_events
        FOR EACH ROW
        EXECUTE FUNCTION update_location();
    """)

    # Create trigger function to auto-update updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at := CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create triggers for updated_at
    op.execute("""
        CREATE TRIGGER reports_update_timestamp
        BEFORE UPDATE ON reports
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    op.execute("""
        CREATE TRIGGER road_events_update_timestamp
        BEFORE UPDATE ON road_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS road_events_update_timestamp ON road_events")
    op.execute("DROP TRIGGER IF EXISTS reports_update_timestamp ON reports")
    op.execute("DROP TRIGGER IF EXISTS road_events_update_location ON road_events")
    op.execute("DROP TRIGGER IF EXISTS reports_update_location ON reports")

    # Drop trigger functions
    op.execute("DROP FUNCTION IF EXISTS update_updated_at()")
    op.execute("DROP FUNCTION IF EXISTS update_location()")

    # Drop tables
    op.drop_table('road_events')
    op.drop_table('reports')

    # Drop enums
    sa.Enum(name='road_status').drop(op.get_bind())
    sa.Enum(name='report_type').drop(op.get_bind())
