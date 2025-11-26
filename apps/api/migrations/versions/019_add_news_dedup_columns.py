"""Add deduplication columns for news reports

Revision ID: 019
Revises: 018
Create Date: 2025-11-26

Adds columns for cross-source news deduplication:
- normalized_title: lowercase, collapsed whitespace for matching
- content_hash: SHA256 of first 500 chars of description
- source_domain: extracted domain (e.g., 'vnexpress.net')

Plus indexes for efficient dedup queries.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '019'
down_revision: Union[str, None] = '018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add deduplication columns and indexes"""

    # Add new columns for deduplication
    op.add_column('reports', sa.Column('normalized_title', sa.String(500), nullable=True))
    op.add_column('reports', sa.Column('content_hash', sa.String(64), nullable=True))
    op.add_column('reports', sa.Column('source_domain', sa.String(100), nullable=True))

    # Index for cross-source title matching within time window
    # Used by: NewsDedupService.find_duplicate() for exact title match
    op.create_index(
        'idx_reports_normalized_title_created',
        'reports',
        ['normalized_title', 'created_at'],
        postgresql_using='btree'
    )

    # Partial index for content hash lookup (exact duplicate detection)
    # Used by: NewsDedupService.find_duplicate() for content hash match
    op.execute("""
        CREATE INDEX idx_reports_content_hash
        ON reports(content_hash)
        WHERE content_hash IS NOT NULL
    """)

    # Index for source domain aggregation and filtering
    # Used by: API dedup grouping by source
    op.create_index(
        'idx_reports_source_domain',
        'reports',
        ['source_domain'],
        postgresql_using='btree'
    )

    # Composite index for dedup candidate queries
    # Used by: Finding potential duplicates within date range
    # Note: Using CAST for timezone-aware timestamps
    op.execute(
        "CREATE INDEX idx_reports_dedup_candidate "
        "ON reports (normalized_title, CAST(created_at AT TIME ZONE 'UTC' AS date)) "
        "WHERE status NOT IN ('invalid', 'merged')"
    )


def downgrade() -> None:
    """Remove deduplication columns and indexes"""
    op.drop_index('idx_reports_dedup_candidate', table_name='reports')
    op.drop_index('idx_reports_source_domain', table_name='reports')
    op.drop_index('idx_reports_content_hash', table_name='reports')
    op.drop_index('idx_reports_normalized_title_created', table_name='reports')
    op.drop_column('reports', 'source_domain')
    op.drop_column('reports', 'content_hash')
    op.drop_column('reports', 'normalized_title')
