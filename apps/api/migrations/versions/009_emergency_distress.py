"""Add distress_reports table for emergency rescue tracking

Revision ID: 009
Revises: 008
Create Date: 2025-11-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create distress_status enum
    distress_status_enum = postgresql.ENUM(
        'pending',
        'acknowledged',
        'in_progress',
        'resolved',
        'false_alarm',
        name='distress_status',
        create_type=True
    )
    distress_status_enum.create(op.get_bind(), checkfirst=True)

    # Create distress_urgency enum
    distress_urgency_enum = postgresql.ENUM(
        'critical',
        'high',
        'medium',
        'low',
        name='distress_urgency',
        create_type=True
    )
    distress_urgency_enum.create(op.get_bind(), checkfirst=True)

    # Create distress_reports table
    op.create_table(
        'distress_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # Location (PostGIS)
        sa.Column('location', geoalchemy2.Geography(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),

        # Status & Urgency
        sa.Column('status', postgresql.ENUM('pending', 'acknowledged', 'in_progress', 'resolved', 'false_alarm', name='distress_status', create_type=False), nullable=False, server_default='pending'),
        sa.Column('urgency', postgresql.ENUM('critical', 'high', 'medium', 'low', name='distress_urgency', create_type=False), nullable=False, server_default='high'),

        # Report Details
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('num_people', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('has_injuries', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_children', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_elderly', sa.Boolean(), nullable=False, server_default='false'),

        # Contact Info (optional - người báo có thể ẩn danh)
        sa.Column('contact_name', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(20), nullable=True),

        # Media Evidence
        sa.Column('media_urls', postgresql.ARRAY(sa.Text()), nullable=True),

        # Source & Verification
        sa.Column('source', sa.String(50), nullable=False, server_default='user_report'),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('verified_by', sa.String(255), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),

        # Admin Notes
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('assigned_to', sa.String(255), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),

        # Constraints
        sa.CheckConstraint('num_people >= 1', name='check_positive_people_count'),
        sa.CheckConstraint("char_length(description) >= 10", name='check_min_description_length'),
    )

    # Create indexes for emergency queries
    # Note: GeoAlchemy2 automatically creates GIST index for location

    # Index for active distress reports (most common query)
    op.create_index(
        'idx_distress_active_status',
        'distress_reports',
        ['status'],
        postgresql_where=sa.text("status IN ('pending', 'acknowledged', 'in_progress')")
    )

    # Index for urgency (critical first)
    op.create_index('idx_distress_urgency', 'distress_reports', ['urgency'])

    # Index for created_at (latest first)
    op.create_index('idx_distress_created', 'distress_reports', ['created_at'], postgresql_ops={'created_at': 'DESC'})

    # Composite index for common filter combinations
    op.create_index('idx_distress_status_urgency', 'distress_reports', ['status', 'urgency'])

    # Index for source tracking
    op.create_index('idx_distress_source', 'distress_reports', ['source'])

    # Index for verified reports
    op.create_index(
        'idx_distress_verified',
        'distress_reports',
        ['verified'],
        postgresql_where=sa.text('verified = true')
    )

    # Trigger: Update timestamp
    op.execute("""
        CREATE TRIGGER distress_update_timestamp
        BEFORE UPDATE ON distress_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    # Trigger: Extract lat/lon from PostGIS geography (reuse existing function)
    op.execute("""
        CREATE TRIGGER distress_update_lat_lon
        BEFORE INSERT OR UPDATE ON distress_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_hazard_lat_lon();
    """)

    # Trigger: Auto-set resolved_at when status changes to resolved
    op.execute("""
        CREATE OR REPLACE FUNCTION update_distress_resolved_at()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
                NEW.resolved_at := NOW();
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER distress_set_resolved_at
        BEFORE UPDATE ON distress_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_distress_resolved_at();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS distress_set_resolved_at ON distress_reports")
    op.execute("DROP TRIGGER IF EXISTS distress_update_lat_lon ON distress_reports")
    op.execute("DROP TRIGGER IF EXISTS distress_update_timestamp ON distress_reports")

    # Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS update_distress_resolved_at()")

    # Drop table
    op.drop_table('distress_reports')

    # Drop enums
    sa.Enum(name='distress_urgency').drop(op.get_bind())
    sa.Enum(name='distress_status').drop(op.get_bind())
