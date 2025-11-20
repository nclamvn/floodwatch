"""Add polygon support to hazard_events for complex affected areas

Revision ID: 011
Revises: 010
Create Date: 2025-11-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2

# revision identifiers, used by Alembic.
revision: str = '011'
down_revision: Union[str, None] = '010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add impact_geometry column for custom polygon shapes
    # (more accurate than circle generated from radius_km)
    op.add_column(
        'hazard_events',
        sa.Column('impact_geometry', geoalchemy2.Geography(geometry_type='POLYGON', srid=4326), nullable=True)
    )

    # Create GIST index for polygon queries
    # Note: GeoAlchemy2 should auto-create this, but we do it explicitly for safety
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_hazard_impact_geometry
        ON hazard_events USING GIST(impact_geometry)
        WHERE impact_geometry IS NOT NULL;
    """)

    # Add comment to explain usage
    op.execute("""
        COMMENT ON COLUMN hazard_events.impact_geometry IS
        'Actual affected area as polygon (more accurate than circle from radius_km).
         Use this for complex flood zones, river basins, or irregular affected areas.';
    """)


def downgrade() -> None:
    # Drop index
    op.execute("DROP INDEX IF EXISTS idx_hazard_impact_geometry")

    # Drop column
    op.drop_column('hazard_events', 'impact_geometry')
