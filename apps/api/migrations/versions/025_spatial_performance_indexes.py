"""Add PostGIS spatial indexes for performance optimization

Revision ID: 025
Revises: 024
Create Date: 2025-11-27

Phase 3 Performance Optimization:
- Add GIST indexes for spatial queries on location columns
- Add composite indexes for help requests and offers
- Optimize queries for nearby disaster reports
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '025'
down_revision: Union[str, None] = '024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add spatial and performance indexes"""

    # ==========================================
    # PostGIS Spatial Indexes (GIST)
    # ==========================================

    # Index for hazard_events location (spatial queries)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_hazard_events_location_gist
        ON hazard_events USING GIST(location);
    ''')

    # Index for help_offers location (finding nearby helpers)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_help_offers_location_gist
        ON help_offers USING GIST(location);
    ''')

    # Index for help_requests location (finding nearby requests)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_help_requests_location_gist
        ON help_requests USING GIST(location);
    ''')

    # Index for reports lat/lon (for spatial clustering)
    # Note: reports uses separate lat/lon columns, not PostGIS geometry
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_reports_coords
        ON reports(lat, lon)
        WHERE lat IS NOT NULL AND lon IS NOT NULL;
    ''')

    # ==========================================
    # Help Requests Performance Indexes
    # ==========================================

    # Composite index for help requests (status + created_at for listing)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_help_requests_status_created
        ON help_requests(status, created_at DESC);
    ''')

    # Index for active help requests (most frequently queried)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_help_requests_active
        ON help_requests(created_at DESC)
        WHERE status = 'active';
    ''')

    # ==========================================
    # Help Offers Performance Indexes
    # ==========================================

    # Composite index for help offers (status + created_at)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_help_offers_status_created
        ON help_offers(status, created_at DESC);
    ''')

    # Index for active help offers
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_help_offers_active
        ON help_offers(created_at DESC)
        WHERE status = 'active';
    ''')

    # ==========================================
    # Distress Reports Performance Indexes
    # ==========================================

    # Index for distress reports by status
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_distress_reports_status
        ON distress_reports(status, created_at DESC);
    ''')

    # ==========================================
    # Traffic Disruptions Performance Indexes
    # ==========================================

    # Index for traffic disruptions by severity
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_traffic_disruptions_severity
        ON traffic_disruptions(severity, created_at DESC);
    ''')


def downgrade() -> None:
    """Remove spatial and performance indexes"""
    op.execute('DROP INDEX IF EXISTS idx_traffic_disruptions_severity;')
    op.execute('DROP INDEX IF EXISTS idx_distress_reports_status;')
    op.execute('DROP INDEX IF EXISTS idx_help_offers_active;')
    op.execute('DROP INDEX IF EXISTS idx_help_offers_status_created;')
    op.execute('DROP INDEX IF EXISTS idx_help_requests_active;')
    op.execute('DROP INDEX IF EXISTS idx_help_requests_status_created;')
    op.execute('DROP INDEX IF EXISTS idx_reports_coords;')
    op.execute('DROP INDEX IF EXISTS idx_help_requests_location_gist;')
    op.execute('DROP INDEX IF EXISTS idx_help_offers_location_gist;')
    op.execute('DROP INDEX IF EXISTS idx_hazard_events_location_gist;')
