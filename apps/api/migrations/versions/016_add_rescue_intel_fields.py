"""Add rescue intelligence fields for Phase 1 operational map

Revision ID: 016
Revises: 015
Create Date: 2025-11-25

Adds critical fields for operational rescue coordination:
- Special conditions (children, elderly, disabilities)
- Contact email
- Water level indicator (critical for flood rescue)
- Building floor (evacuation planning)
- Vehicle type (logistics matching)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '016'
down_revision: Union[str, None] = '015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create vehicle_type enum for help_offers
    vehicle_type_enum = postgresql.ENUM(
        'boat',
        'truck',
        'helicopter',
        'ambulance',
        'car',
        'motorcycle',
        'other',
        name='vehicle_type',
        create_type=True
    )
    vehicle_type_enum.create(op.get_bind(), checkfirst=True)

    # Add fields to help_requests table
    op.add_column('help_requests', sa.Column('has_children', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('help_requests', sa.Column('has_elderly', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('help_requests', sa.Column('has_disabilities', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('help_requests', sa.Column('contact_email', sa.Text(), nullable=True))
    op.add_column('help_requests', sa.Column('water_level_cm', sa.Integer(), nullable=True))
    op.add_column('help_requests', sa.Column('building_floor', sa.Integer(), nullable=True))

    # Add comment for water_level_cm
    op.execute("""
        COMMENT ON COLUMN help_requests.water_level_cm IS
        'Current water level in centimeters at the location. Critical for rescue prioritization.'
    """)

    # Add comment for building_floor
    op.execute("""
        COMMENT ON COLUMN help_requests.building_floor IS
        'Floor number where people are located. Important for evacuation planning.'
    """)

    # Add fields to help_offers table
    op.add_column('help_offers', sa.Column('contact_email', sa.Text(), nullable=True))
    op.add_column('help_offers', sa.Column('vehicle_type', vehicle_type_enum, nullable=True))
    op.add_column('help_offers', sa.Column('available_capacity', sa.Integer(), nullable=True))

    # Initialize available_capacity to match capacity for existing records
    op.execute("""
        UPDATE help_offers
        SET available_capacity = capacity
        WHERE available_capacity IS NULL AND capacity IS NOT NULL
    """)

    # Add comment for available_capacity
    op.execute("""
        COMMENT ON COLUMN help_offers.available_capacity IS
        'Current available capacity (decreases when matched). Separate from total capacity.'
    """)

    # Create index on water_level_cm for quick filtering of critical situations
    op.create_index(
        'ix_help_requests_water_level',
        'help_requests',
        ['water_level_cm'],
        unique=False,
        postgresql_where=sa.text('water_level_cm IS NOT NULL')
    )

    # Create index on building_floor for evacuation planning
    op.create_index(
        'ix_help_requests_building_floor',
        'help_requests',
        ['building_floor'],
        unique=False,
        postgresql_where=sa.text('building_floor IS NOT NULL')
    )

    # Create index on special conditions for prioritization queries
    op.create_index(
        'ix_help_requests_special_conditions',
        'help_requests',
        ['has_children', 'has_elderly', 'has_disabilities'],
        unique=False
    )

    # Create index on vehicle_type for matching queries
    op.create_index(
        'ix_help_offers_vehicle_type',
        'help_offers',
        ['vehicle_type'],
        unique=False,
        postgresql_where=sa.text('vehicle_type IS NOT NULL')
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_help_offers_vehicle_type', table_name='help_offers')
    op.drop_index('ix_help_requests_special_conditions', table_name='help_requests')
    op.drop_index('ix_help_requests_building_floor', table_name='help_requests')
    op.drop_index('ix_help_requests_water_level', table_name='help_requests')

    # Drop columns from help_offers
    op.drop_column('help_offers', 'available_capacity')
    op.drop_column('help_offers', 'vehicle_type')
    op.drop_column('help_offers', 'contact_email')

    # Drop columns from help_requests
    op.drop_column('help_requests', 'building_floor')
    op.drop_column('help_requests', 'water_level_cm')
    op.drop_column('help_requests', 'contact_email')
    op.drop_column('help_requests', 'has_disabilities')
    op.drop_column('help_requests', 'has_elderly')
    op.drop_column('help_requests', 'has_children')

    # Drop enum type
    sa.Enum(name='vehicle_type').drop(op.get_bind(), checkfirst=True)
