"""Add hazard_events table for natural disaster tracking

Revision ID: 008
Revises: 007
Create Date: 2025-01-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create hazard_type enum
    hazard_type_enum = postgresql.ENUM(
        'heavy_rain',
        'flood',
        'dam_release',
        'landslide',
        'storm',
        'tide_surge',
        name='hazard_type',
        create_type=True
    )
    hazard_type_enum.create(op.get_bind(), checkfirst=True)

    # Create severity_level enum
    severity_level_enum = postgresql.ENUM(
        'info',
        'low',
        'medium',
        'high',
        'critical',
        name='severity_level',
        create_type=True
    )
    severity_level_enum.create(op.get_bind(), checkfirst=True)

    # Create hazard_events table
    op.create_table(
        'hazard_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # Event classification
        sa.Column('type', postgresql.ENUM('heavy_rain', 'flood', 'dam_release', 'landslide', 'storm', 'tide_surge', name='hazard_type', create_type=False), nullable=False),
        sa.Column('severity', postgresql.ENUM('info', 'low', 'medium', 'high', 'critical', name='severity_level', create_type=False), nullable=False),

        # Spatial data (PostGIS)
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('affected_area', geoalchemy2.Geography(geometry_type='POLYGON', srid=4326), nullable=True),
        sa.Column('radius_km', sa.Float(), nullable=True),

        # Lat/lon for convenience (auto-populated from location via trigger)
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),

        # Time range
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),

        # Data source
        sa.Column('source', sa.String(100), nullable=False),
        sa.Column('external_id', sa.String(255), nullable=True),
        sa.Column('raw_payload', postgresql.JSONB(), nullable=True),

        # Metadata
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),

        # Constraints
        sa.CheckConstraint('radius_km IS NULL OR radius_km > 0', name='check_valid_radius'),
    )

    # Note: GeoAlchemy2 automatically creates GIST indexes for Geography columns
    # (both location and affected_area), so we don't need to manually create them

    # Create indexes for time range queries
    op.create_index('idx_hazard_events_time_range', 'hazard_events', ['starts_at', 'ends_at'])
    op.create_index('idx_hazard_events_starts_at', 'hazard_events', ['starts_at'], postgresql_ops={'starts_at': 'DESC'})

    # Create indexes for filtering
    op.create_index('idx_hazard_events_type_severity', 'hazard_events', ['type', 'severity'])
    op.create_index('idx_hazard_events_source', 'hazard_events', ['source'])
    op.create_index('idx_hazard_events_external_id', 'hazard_events', ['external_id'])

    # Create trigger for auto-updating updated_at (reuse existing function)
    op.execute("""
        CREATE TRIGGER hazard_events_update_timestamp
        BEFORE UPDATE ON hazard_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    # Create trigger to extract lat/lon from location geography
    op.execute("""
        CREATE OR REPLACE FUNCTION update_hazard_lat_lon()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.location IS NOT NULL THEN
                NEW.lat := ST_Y(NEW.location::geometry);
                NEW.lon := ST_X(NEW.location::geometry);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER hazard_events_update_lat_lon
        BEFORE INSERT OR UPDATE ON hazard_events
        FOR EACH ROW
        EXECUTE FUNCTION update_hazard_lat_lon();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS hazard_events_update_lat_lon ON hazard_events")
    op.execute("DROP TRIGGER IF EXISTS hazard_events_update_timestamp ON hazard_events")

    # Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS update_hazard_lat_lon()")

    # Drop table
    op.drop_table('hazard_events')

    # Drop enums
    sa.Enum(name='severity_level').drop(op.get_bind())
    sa.Enum(name='hazard_type').drop(op.get_bind())
