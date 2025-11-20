"""Add performance indexes for common queries

Revision ID: 005
Revises: 004
Create Date: 2025-10-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes"""

    # Composite index for common report queries (province + type + time)
    op.create_index(
        'idx_reports_prov_type_created',
        'reports',
        ['province', 'type', sa.text('created_at DESC')],
        postgresql_using='btree'
    )

    # Partial index for verified reports (frequently queried)
    op.execute("""
        CREATE INDEX idx_reports_verified
        ON reports(created_at DESC)
        WHERE status = 'verified'
    """)

    # Composite index for road events (province + status + verification time)
    op.create_index(
        'idx_road_events_prov_status',
        'road_events',
        ['province', 'status', sa.text('last_verified DESC')],
        postgresql_using='btree'
    )

    # Index for trust score filtering (high-trust reports)
    # Note: using different name from 001's idx_reports_trust_score to avoid conflict
    op.create_index(
        'idx_reports_trust_high',
        'reports',
        [sa.text('trust_score DESC'), sa.text('created_at DESC')],
        postgresql_where=sa.text('trust_score >= 0.7')
    )

    # Index for CSV export (common full table scan)
    op.create_index(
        'idx_reports_export',
        'reports',
        [sa.text('created_at DESC'), 'province', 'type'],
        postgresql_using='btree'
    )


def downgrade() -> None:
    """Remove performance indexes"""
    op.drop_index('idx_reports_export', table_name='reports')
    op.drop_index('idx_reports_trust_high', table_name='reports')
    op.drop_index('idx_road_events_prov_status', table_name='road_events')
    op.drop_index('idx_reports_verified', table_name='reports')
    op.drop_index('idx_reports_prov_type_created', table_name='reports')
