"""Add Phase 2: Priority scoring and assignment system

Revision ID: 017
Revises: 016
Create Date: 2025-11-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geography

revision: str = '017'
down_revision: Union[str, None] = '016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Phase 2 features: priority scoring and assignments"""

    # 1. Add priority_score to help_requests
    op.add_column('help_requests', sa.Column('priority_score', sa.Integer(), nullable=True, server_default='0'))

    # 2. Create index on priority_score for efficient sorting
    op.create_index('ix_help_requests_priority_score', 'help_requests', ['priority_score'], unique=False)

    # 3. Status columns are already VARCHAR, so new values can be used directly
    # No need to alter enum types - they don't exist
    # New statuses for help_requests: 'assigned', 'in_progress', 'rescued'
    # New statuses for help_offers: 'assigned', 'busy', 'offline'

    # 4. Create assignments table
    op.create_table(
        'rescue_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Assignment details
        sa.Column('help_request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('help_offer_id', postgresql.UUID(as_uuid=True), nullable=False),

        # Status tracking
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),

        # Assignment metadata
        sa.Column('assigned_by', sa.String(255), nullable=True, comment='Who made the assignment (user_id or system)'),
        sa.Column('priority_at_assignment', sa.Integer(), nullable=True, comment='Priority score when assignment was made'),
        sa.Column('distance_km_at_assignment', sa.Float(), nullable=True, comment='Distance between offer and request at assignment'),
        sa.Column('estimated_arrival_minutes', sa.Integer(), nullable=True),

        # Notes and tracking
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),

        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['help_request_id'], ['help_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['help_offer_id'], ['help_offers.id'], ondelete='CASCADE')
    )

    # 6. Create indexes on assignments table
    op.create_index('ix_rescue_assignments_request_id', 'rescue_assignments', ['help_request_id'], unique=False)
    op.create_index('ix_rescue_assignments_offer_id', 'rescue_assignments', ['help_offer_id'], unique=False)
    op.create_index('ix_rescue_assignments_status', 'rescue_assignments', ['status'], unique=False)
    op.create_index('ix_rescue_assignments_created_at', 'rescue_assignments', ['created_at'], unique=False)

    # 7. Add assigned_to_offer_id to help_requests for quick lookups
    op.add_column('help_requests', sa.Column('assigned_to_offer_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_help_requests_assigned_offer',
        'help_requests', 'help_offers',
        ['assigned_to_offer_id'], ['id'],
        ondelete='SET NULL'
    )

    # 8. Add assignment tracking to help_offers
    op.add_column('help_offers', sa.Column('active_assignments_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('help_offers', sa.Column('total_assignments_count', sa.Integer(), nullable=True, server_default='0'))

    # 9. Initialize priority scores for existing requests
    # Priority calculation: urgency (40) + special_conditions (30) + water_level (20) + age (10)
    op.execute("""
        UPDATE help_requests
        SET priority_score = (
            CASE urgency
                WHEN 'critical' THEN 40
                WHEN 'high' THEN 30
                WHEN 'medium' THEN 20
                WHEN 'low' THEN 10
                ELSE 0
            END +
            CASE
                WHEN has_children THEN 10 ELSE 0
            END +
            CASE
                WHEN has_elderly THEN 10 ELSE 0
            END +
            CASE
                WHEN has_disabilities THEN 10 ELSE 0
            END +
            CASE
                WHEN water_level_cm >= 150 THEN 20
                WHEN water_level_cm >= 100 THEN 15
                WHEN water_level_cm >= 50 THEN 10
                ELSE 0
            END +
            CASE
                WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > 24 THEN 10
                WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > 12 THEN 5
                ELSE 0
            END
        )
        WHERE priority_score IS NULL OR priority_score = 0
    """)


def downgrade() -> None:
    """Rollback Phase 2 changes"""

    # Remove columns from help_offers
    op.drop_column('help_offers', 'total_assignments_count')
    op.drop_column('help_offers', 'active_assignments_count')

    # Remove FK and column from help_requests
    op.drop_constraint('fk_help_requests_assigned_offer', 'help_requests', type_='foreignkey')
    op.drop_column('help_requests', 'assigned_to_offer_id')

    # Drop assignments table
    op.drop_index('ix_rescue_assignments_created_at', table_name='rescue_assignments')
    op.drop_index('ix_rescue_assignments_status', table_name='rescue_assignments')
    op.drop_index('ix_rescue_assignments_offer_id', table_name='rescue_assignments')
    op.drop_index('ix_rescue_assignments_request_id', table_name='rescue_assignments')
    op.drop_table('rescue_assignments')

    # Remove priority_score from help_requests
    op.drop_index('ix_help_requests_priority_score', table_name='help_requests')
    op.drop_column('help_requests', 'priority_score')

    # Note: Cannot easily remove enum values in PostgreSQL, they will remain but unused
