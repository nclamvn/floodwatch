"""Add indexes for URL health check and report cleanup jobs

Revision ID: 018
Revises: 017
Create Date: 2025-11-26

Indexes for:
1. source column - URL health checking (partial index for non-null URLs)
2. created_at - Report cleanup TTL queries (already exists but adding specific for cleanup)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '018'
down_revision: Union[str, None] = '017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add indexes for cleanup jobs"""

    # Partial index for reports with non-null source URLs (for URL health checking)
    # Only indexes reports where source starts with http:// or https://
    op.execute("""
        CREATE INDEX idx_reports_source_url
        ON reports(source)
        WHERE source IS NOT NULL AND (source LIKE 'http://%' OR source LIKE 'https://%')
    """)

    # Index for created_at for TTL cleanup queries
    # Covers: DELETE FROM reports WHERE created_at < cutoff_date
    op.create_index(
        'idx_reports_created_at_cleanup',
        'reports',
        [sa.text('created_at')],
        postgresql_using='btree'
    )


def downgrade() -> None:
    """Remove cleanup indexes"""
    op.drop_index('idx_reports_created_at_cleanup', table_name='reports')
    op.drop_index('idx_reports_source_url', table_name='reports')
