"""Add traffic_disruptions table for road closures tracking

Revision ID: 010
Revises: 009
Create Date: 2025-11-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '010'
down_revision: Union[str, None] = '009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create disruption_type enum
    disruption_type_enum = postgresql.ENUM(
        'flooded_road',
        'landslide',
        'bridge_collapsed',
        'bridge_flooded',
        'traffic_jam',
        'road_damaged',
        'blocked',
        name='disruption_type',
        create_type=True
    )
    disruption_type_enum.create(op.get_bind(), checkfirst=True)

    # Create disruption_severity enum
    disruption_severity_enum = postgresql.ENUM(
        'impassable',
        'dangerous',
        'slow',
        'warning',
        name='disruption_severity',
        create_type=True
    )
    disruption_severity_enum.create(op.get_bind(), checkfirst=True)

    # Create traffic_disruptions table
    op.create_table(
        'traffic_disruptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # Location (can be POINT or LINESTRING for road segments)
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),

        # Road segment (optional - if available)
        sa.Column('road_geometry', geoalchemy2.Geography(geometry_type='LINESTRING', srid=4326), nullable=True),

        # Disruption Details
        sa.Column('type', postgresql.ENUM('flooded_road', 'landslide', 'bridge_collapsed', 'bridge_flooded', 'traffic_jam', 'road_damaged', 'blocked', name='disruption_type', create_type=False), nullable=False),
        sa.Column('severity', postgresql.ENUM('impassable', 'dangerous', 'slow', 'warning', name='disruption_severity', create_type=False), nullable=False, server_default='impassable'),

        # Location Description
        sa.Column('road_name', sa.String(255), nullable=True),
        sa.Column('location_description', sa.Text(), nullable=False),

        # Impact
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('estimated_clearance', sa.DateTime(timezone=True), nullable=True),
        sa.Column('alternative_route', sa.Text(), nullable=True),

        # Time Range
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),

        # Source & Status
        sa.Column('source', sa.String(100), nullable=False),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),

        # Related Hazard (if linked to a hazard event)
        sa.Column('hazard_event_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Media
        sa.Column('media_urls', postgresql.ARRAY(sa.Text()), nullable=True),

        # Admin
        sa.Column('admin_notes', sa.Text(), nullable=True),

        # Constraints
        sa.CheckConstraint("char_length(location_description) >= 10", name='check_min_location_description'),
        sa.ForeignKeyConstraint(['hazard_event_id'], ['hazard_events.id'], name='fk_traffic_hazard', ondelete='SET NULL'),
    )

    # Create indexes
    # Note: GeoAlchemy2 automatically creates GIST indexes for location and road_geometry

    # Index for active disruptions (most common query)
    op.create_index(
        'idx_traffic_active',
        'traffic_disruptions',
        ['is_active'],
        postgresql_where=sa.text('is_active = true')
    )

    # Index for severity (impassable roads first)
    op.create_index('idx_traffic_severity', 'traffic_disruptions', ['severity'])

    # Index for type
    op.create_index('idx_traffic_type', 'traffic_disruptions', ['type'])

    # Index for road_name (for road-specific queries)
    op.create_index('idx_traffic_road_name', 'traffic_disruptions', ['road_name'], postgresql_where=sa.text('road_name IS NOT NULL'))

    # Index for hazard_event_id (to find disruptions caused by specific hazard)
    op.create_index('idx_traffic_hazard', 'traffic_disruptions', ['hazard_event_id'], postgresql_where=sa.text('hazard_event_id IS NOT NULL'))

    # Index for time range
    op.create_index('idx_traffic_time_range', 'traffic_disruptions', ['starts_at', 'ends_at'])

    # Composite index for common queries
    op.create_index('idx_traffic_active_severity', 'traffic_disruptions', ['is_active', 'severity'])

    # Trigger: Update timestamp
    op.execute("""
        CREATE TRIGGER traffic_update_timestamp
        BEFORE UPDATE ON traffic_disruptions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    # Trigger: Extract lat/lon from PostGIS geography
    op.execute("""
        CREATE TRIGGER traffic_update_lat_lon
        BEFORE INSERT OR UPDATE ON traffic_disruptions
        FOR EACH ROW
        EXECUTE FUNCTION update_hazard_lat_lon();
    """)

    # Trigger: Auto-set ends_at when is_active changes to false
    op.execute("""
        CREATE OR REPLACE FUNCTION update_traffic_ends_at()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_active = false AND OLD.is_active = true AND NEW.ends_at IS NULL THEN
                NEW.ends_at := NOW();
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER traffic_set_ends_at
        BEFORE UPDATE ON traffic_disruptions
        FOR EACH ROW
        EXECUTE FUNCTION update_traffic_ends_at();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS traffic_set_ends_at ON traffic_disruptions")
    op.execute("DROP TRIGGER IF EXISTS traffic_update_lat_lon ON traffic_disruptions")
    op.execute("DROP TRIGGER IF EXISTS traffic_update_timestamp ON traffic_disruptions")

    # Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS update_traffic_ends_at()")

    # Drop table
    op.drop_table('traffic_disruptions')

    # Drop enums
    sa.Enum(name='disruption_severity').drop(op.get_bind())
    sa.Enum(name='disruption_type').drop(op.get_bind())
