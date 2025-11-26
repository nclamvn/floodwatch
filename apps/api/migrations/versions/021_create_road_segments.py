"""Create road_segments table for Routes 2.0

Revision ID: 021
Revises: 020
Create Date: 2025-11-26

Unified road segment model consolidating:
- RoadEvent (list page)
- TrafficDisruption (map layer)
- Report(type=ROAD) (news scraping)

Features:
- 4-level Apple Maps style status (OPEN/LIMITED/DANGEROUS/CLOSED)
- PostGIS geometry for spatial queries
- Deduplication fields
- Risk scoring
- Hazard event linking
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM


# revision identifiers, used by Alembic.
revision: str = '021'
down_revision: Union[str, None] = '020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create road_segments table with all indexes"""

    # Create enum type for road segment status
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'road_segment_status') THEN
                CREATE TYPE road_segment_status AS ENUM ('OPEN', 'LIMITED', 'DANGEROUS', 'CLOSED');
            END IF;
        END
        $$;
    """)

    # Create road_segments table
    op.create_table(
        'road_segments',
        # Primary key and timestamps
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        # Road identification
        sa.Column('segment_name', sa.String(200), nullable=False),
        sa.Column('road_name', sa.String(100), nullable=True),

        # Location
        sa.Column('province', sa.String(50), nullable=True),
        sa.Column('district', sa.String(100), nullable=True),
        sa.Column('start_lat', sa.Float, nullable=True),
        sa.Column('start_lon', sa.Float, nullable=True),
        sa.Column('end_lat', sa.Float, nullable=True),
        sa.Column('end_lon', sa.Float, nullable=True),

        # Status
        sa.Column('status', ENUM('OPEN', 'LIMITED', 'DANGEROUS', 'CLOSED', name='road_segment_status', create_type=False), nullable=False, server_default='OPEN'),
        sa.Column('status_reason', sa.Text, nullable=True),

        # Risk scoring
        sa.Column('risk_score', sa.Float, nullable=False, server_default='0.0'),

        # Hazard link
        sa.Column('hazard_event_id', UUID(as_uuid=True), nullable=True),

        # Deduplication
        sa.Column('normalized_name', sa.String(200), nullable=True),
        sa.Column('content_hash', sa.String(64), nullable=True),
        sa.Column('source_domain', sa.String(100), nullable=True),
        sa.Column('source_url', sa.String(500), nullable=True),

        # Source and verification
        sa.Column('source', sa.String(100), nullable=False, server_default='SCRAPER'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verified_by', UUID(as_uuid=True), nullable=True),

        # Expiration
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),

        # Legacy references
        sa.Column('legacy_road_event_id', UUID(as_uuid=True), nullable=True),
        sa.Column('legacy_disruption_id', UUID(as_uuid=True), nullable=True),

        # Constraints
        sa.CheckConstraint('risk_score >= 0.0 AND risk_score <= 1.0', name='check_road_segment_risk_score'),
    )

    # Add PostGIS geography columns
    op.execute("""
        ALTER TABLE road_segments
        ADD COLUMN location geography(POINT, 4326),
        ADD COLUMN geometry geography(LINESTRING, 4326);
    """)

    # Add foreign key to hazard_events
    op.create_foreign_key(
        'fk_road_segments_hazard_event',
        'road_segments',
        'hazard_events',
        ['hazard_event_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create indexes for efficient queries

    # Index for province filtering (most common filter)
    op.create_index(
        'idx_road_segments_province',
        'road_segments',
        ['province']
    )

    # Composite index for province + status queries
    op.create_index(
        'idx_road_segments_province_status',
        'road_segments',
        ['province', 'status']
    )

    # Index for deduplication queries
    op.create_index(
        'idx_road_segments_normalized_name',
        'road_segments',
        ['normalized_name']
    )

    # Partial index for content hash (only when not null)
    op.execute("""
        CREATE INDEX idx_road_segments_content_hash
        ON road_segments(content_hash)
        WHERE content_hash IS NOT NULL;
    """)

    # Index for risk score sorting
    op.create_index(
        'idx_road_segments_risk_score',
        'road_segments',
        ['risk_score'],
        postgresql_using='btree'
    )

    # Index for status filtering (commonly used)
    op.create_index(
        'idx_road_segments_status',
        'road_segments',
        ['status']
    )

    # GIST index for spatial queries on location
    op.execute("""
        CREATE INDEX idx_road_segments_location_gist
        ON road_segments USING GIST (location);
    """)

    # GIST index for spatial queries on geometry (line segments)
    op.execute("""
        CREATE INDEX idx_road_segments_geometry_gist
        ON road_segments USING GIST (geometry);
    """)

    # Index for hazard event lookups
    op.create_index(
        'idx_road_segments_hazard_event_id',
        'road_segments',
        ['hazard_event_id']
    )

    # Index for time-based queries
    op.create_index(
        'idx_road_segments_created_at',
        'road_segments',
        ['created_at']
    )

    # Composite index for active dangerous/closed roads
    op.execute("""
        CREATE INDEX idx_road_segments_active_issues
        ON road_segments (status, created_at DESC)
        WHERE status IN ('DANGEROUS', 'CLOSED');
    """)

    # Create trigger for updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_road_segments_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_road_segments_updated_at ON road_segments;
        CREATE TRIGGER trigger_road_segments_updated_at
            BEFORE UPDATE ON road_segments
            FOR EACH ROW
            EXECUTE FUNCTION update_road_segments_updated_at();
    """)


def downgrade() -> None:
    """Drop road_segments table and related objects"""

    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS trigger_road_segments_updated_at ON road_segments;")
    op.execute("DROP FUNCTION IF EXISTS update_road_segments_updated_at();")

    # Drop indexes (most will be dropped with table, but explicit for clarity)
    op.drop_index('idx_road_segments_active_issues', table_name='road_segments')
    op.drop_index('idx_road_segments_created_at', table_name='road_segments')
    op.drop_index('idx_road_segments_hazard_event_id', table_name='road_segments')
    op.execute("DROP INDEX IF EXISTS idx_road_segments_geometry_gist;")
    op.execute("DROP INDEX IF EXISTS idx_road_segments_location_gist;")
    op.drop_index('idx_road_segments_status', table_name='road_segments')
    op.drop_index('idx_road_segments_risk_score', table_name='road_segments')
    op.execute("DROP INDEX IF EXISTS idx_road_segments_content_hash;")
    op.drop_index('idx_road_segments_normalized_name', table_name='road_segments')
    op.drop_index('idx_road_segments_province_status', table_name='road_segments')
    op.drop_index('idx_road_segments_province', table_name='road_segments')

    # Drop foreign key
    op.drop_constraint('fk_road_segments_hazard_event', 'road_segments', type_='foreignkey')

    # Drop table
    op.drop_table('road_segments')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS road_segment_status;")
