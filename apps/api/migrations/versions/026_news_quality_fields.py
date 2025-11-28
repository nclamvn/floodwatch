"""Add news quality fields for content tracking and dead URL detection

This migration adds:
- is_deleted: Boolean flag for reports with dead source URLs
- content_status: Enum for content quality (full, partial, excerpt, failed)
- last_check_at: Timestamp for URL verification tracking

Purpose: News Quality Track - improve news quality from B+ to A by:
- Filtering out deleted articles (source URL 404)
- Tracking content completeness for graceful UI degradation
- Enabling quality filters for carousel/featured content

Revision ID: 026
Revises: 025
Create Date: 2025-11-28
"""
from alembic import op
import sqlalchemy as sa


revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade():
    """Add news quality columns to reports table"""

    # ============================================================
    # 1. Add is_deleted column for dead URL tracking
    # ============================================================
    op.add_column('reports', sa.Column(
        'is_deleted',
        sa.Boolean(),
        nullable=False,
        server_default='false'
    ))

    # Index for efficient filtering of non-deleted reports
    op.create_index(
        'idx_reports_is_deleted',
        'reports',
        ['is_deleted']
    )

    # ============================================================
    # 2. Add content_status for content quality tracking
    # Values: 'full', 'partial', 'excerpt', 'failed'
    # ============================================================
    op.add_column('reports', sa.Column(
        'content_status',
        sa.String(20),
        nullable=False,
        server_default='full'
    ))

    # Index for quality filtering
    op.create_index(
        'idx_reports_content_status',
        'reports',
        ['content_status']
    )

    # ============================================================
    # 3. Add last_check_at for URL verification tracking
    # ============================================================
    op.add_column('reports', sa.Column(
        'last_check_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))

    # ============================================================
    # 4. Composite index for common quality queries
    # Frontend typically filters: not deleted, good content, recent
    # ============================================================
    op.execute("""
        CREATE INDEX idx_reports_quality_filter
        ON reports (is_deleted, content_status, created_at DESC)
        WHERE is_deleted = false;
    """)

    # ============================================================
    # 5. Backfill content_status based on description length
    # ============================================================
    op.execute("""
        UPDATE reports SET content_status =
            CASE
                WHEN description IS NULL OR LENGTH(description) < 50 THEN 'failed'
                WHEN LENGTH(description) < 200 THEN 'excerpt'
                WHEN LENGTH(description) < 500 THEN 'partial'
                ELSE 'full'
            END;
    """)

    print("026 - News quality fields added successfully")
    print("  - is_deleted: Boolean for dead URL tracking")
    print("  - content_status: full/partial/excerpt/failed")
    print("  - last_check_at: URL verification timestamp")
    print("  - Backfilled content_status based on description length")


def downgrade():
    """Remove news quality columns"""

    # Drop composite index
    op.execute("DROP INDEX IF EXISTS idx_reports_quality_filter;")

    # Drop individual indexes
    op.drop_index('idx_reports_content_status', table_name='reports')
    op.drop_index('idx_reports_is_deleted', table_name='reports')

    # Drop columns
    op.drop_column('reports', 'last_check_at')
    op.drop_column('reports', 'content_status')
    op.drop_column('reports', 'is_deleted')

    print("026 - News quality fields removed")
