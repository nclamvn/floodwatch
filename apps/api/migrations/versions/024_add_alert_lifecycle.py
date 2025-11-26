"""Add alert lifecycle fields for ACTIVE/RESOLVED/ARCHIVED status management

This migration adds lifecycle tracking fields to:
- road_segments (Routes 2.5+)
- hazard_events
- traffic_disruptions

Lifecycle states:
- ACTIVE: Issue is ongoing
- RESOLVED: Issue has been fixed (stays visible for 3 days)
- ARCHIVED: Old, no longer visible on map

Revision ID: 024
Revises: 023
Create Date: 2025-11-26
"""
from alembic import op
import sqlalchemy as sa


revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade():
    """Add lifecycle columns to alert tables"""

    # Create enum type for lifecycle status
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_lifecycle_status') THEN
                CREATE TYPE alert_lifecycle_status AS ENUM ('ACTIVE', 'RESOLVED', 'ARCHIVED');
            END IF;
        END
        $$;
    """)

    # ============================================================
    # 1. road_segments - Routes 2.5+
    # ============================================================
    op.add_column('road_segments', sa.Column(
        'lifecycle_status',
        sa.Enum('ACTIVE', 'RESOLVED', 'ARCHIVED', name='alert_lifecycle_status', create_type=False),
        nullable=False,
        server_default='ACTIVE'
    ))
    op.add_column('road_segments', sa.Column(
        'last_verified_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('road_segments', sa.Column(
        'resolved_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('road_segments', sa.Column(
        'archived_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))

    # Index for efficient lifecycle queries
    op.create_index(
        'idx_road_segments_lifecycle_status',
        'road_segments',
        ['lifecycle_status']
    )

    # Partial index for active/resolved (what frontend shows)
    op.execute("""
        CREATE INDEX idx_road_segments_visible
        ON road_segments (lifecycle_status, created_at DESC)
        WHERE lifecycle_status IN ('ACTIVE', 'RESOLVED');
    """)

    # ============================================================
    # 2. hazard_events
    # ============================================================
    op.add_column('hazard_events', sa.Column(
        'lifecycle_status',
        sa.Enum('ACTIVE', 'RESOLVED', 'ARCHIVED', name='alert_lifecycle_status', create_type=False),
        nullable=False,
        server_default='ACTIVE'
    ))
    op.add_column('hazard_events', sa.Column(
        'last_verified_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('hazard_events', sa.Column(
        'resolved_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('hazard_events', sa.Column(
        'archived_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))

    op.create_index(
        'idx_hazard_events_lifecycle_status',
        'hazard_events',
        ['lifecycle_status']
    )

    # ============================================================
    # 3. traffic_disruptions
    # ============================================================
    op.add_column('traffic_disruptions', sa.Column(
        'lifecycle_status',
        sa.Enum('ACTIVE', 'RESOLVED', 'ARCHIVED', name='alert_lifecycle_status', create_type=False),
        nullable=False,
        server_default='ACTIVE'
    ))
    op.add_column('traffic_disruptions', sa.Column(
        'last_verified_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('traffic_disruptions', sa.Column(
        'resolved_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('traffic_disruptions', sa.Column(
        'archived_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))

    op.create_index(
        'idx_traffic_disruptions_lifecycle_status',
        'traffic_disruptions',
        ['lifecycle_status']
    )

    # ============================================================
    # 4. road_events (legacy table)
    # ============================================================
    op.add_column('road_events', sa.Column(
        'lifecycle_status',
        sa.Enum('ACTIVE', 'RESOLVED', 'ARCHIVED', name='alert_lifecycle_status', create_type=False),
        nullable=False,
        server_default='ACTIVE'
    ))
    op.add_column('road_events', sa.Column(
        'last_verified_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('road_events', sa.Column(
        'resolved_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('road_events', sa.Column(
        'archived_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))

    op.create_index(
        'idx_road_events_lifecycle_status',
        'road_events',
        ['lifecycle_status']
    )

    # ============================================================
    # Backfill: Set last_verified_at = verified_at or created_at
    # ============================================================
    op.execute("""
        UPDATE road_segments
        SET last_verified_at = COALESCE(verified_at, created_at);
    """)

    op.execute("""
        UPDATE hazard_events
        SET last_verified_at = created_at;
    """)

    op.execute("""
        UPDATE traffic_disruptions
        SET last_verified_at = created_at;
    """)

    op.execute("""
        UPDATE road_events
        SET last_verified_at = COALESCE(last_verified, created_at);
    """)

    print("024 - Alert lifecycle fields added successfully")


def downgrade():
    """Remove lifecycle columns"""

    # road_segments
    op.execute("DROP INDEX IF EXISTS idx_road_segments_visible;")
    op.drop_index('idx_road_segments_lifecycle_status', table_name='road_segments')
    op.drop_column('road_segments', 'archived_at')
    op.drop_column('road_segments', 'resolved_at')
    op.drop_column('road_segments', 'last_verified_at')
    op.drop_column('road_segments', 'lifecycle_status')

    # hazard_events
    op.drop_index('idx_hazard_events_lifecycle_status', table_name='hazard_events')
    op.drop_column('hazard_events', 'archived_at')
    op.drop_column('hazard_events', 'resolved_at')
    op.drop_column('hazard_events', 'last_verified_at')
    op.drop_column('hazard_events', 'lifecycle_status')

    # traffic_disruptions
    op.drop_index('idx_traffic_disruptions_lifecycle_status', table_name='traffic_disruptions')
    op.drop_column('traffic_disruptions', 'archived_at')
    op.drop_column('traffic_disruptions', 'resolved_at')
    op.drop_column('traffic_disruptions', 'last_verified_at')
    op.drop_column('traffic_disruptions', 'lifecycle_status')

    # road_events
    op.drop_index('idx_road_events_lifecycle_status', table_name='road_events')
    op.drop_column('road_events', 'archived_at')
    op.drop_column('road_events', 'resolved_at')
    op.drop_column('road_events', 'last_verified_at')
    op.drop_column('road_events', 'lifecycle_status')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS alert_lifecycle_status;")

    print("024 - Alert lifecycle fields removed")
