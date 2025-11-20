"""Add subscriptions and deliveries tables for alerts

Revision ID: 004
Revises: 003
Create Date: 2025-10-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create subscriptions and deliveries tables"""

    # Create subscriptions table
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('org_name', sa.String(200), nullable=False),
        sa.Column('provinces', postgresql.JSONB, server_default='[]', nullable=False),
        sa.Column('types', postgresql.JSONB, server_default='[]', nullable=False),
        sa.Column('min_trust', sa.Float, server_default='0.0', nullable=False),
        sa.Column('callback_url', sa.Text, nullable=False),
        sa.Column('secret', sa.String(200), nullable=True)
    )

    # Create indexes for subscriptions
    op.create_index('idx_subscriptions_created_at', 'subscriptions', ['created_at'])

    # Create deliveries table
    op.create_table(
        'deliveries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(50), server_default='pending', nullable=False),
        sa.Column('attempts', sa.Integer, server_default='0', nullable=False),
        sa.Column('last_error', sa.Text, nullable=True)
    )

    # Create indexes for deliveries
    op.create_index('idx_deliveries_subscription_id', 'deliveries', ['subscription_id'])
    op.create_index('idx_deliveries_report_id', 'deliveries', ['report_id'])
    op.create_index('idx_deliveries_status', 'deliveries', ['status'])
    op.create_index('idx_deliveries_created_at', 'deliveries', ['created_at'])


def downgrade() -> None:
    """Drop subscriptions and deliveries tables"""
    # Drop deliveries indexes and table
    op.drop_index('idx_deliveries_created_at', table_name='deliveries')
    op.drop_index('idx_deliveries_status', table_name='deliveries')
    op.drop_index('idx_deliveries_report_id', table_name='deliveries')
    op.drop_index('idx_deliveries_subscription_id', table_name='deliveries')
    op.drop_table('deliveries')

    # Drop subscriptions indexes and table
    op.drop_index('idx_subscriptions_created_at', table_name='subscriptions')
    op.drop_table('subscriptions')
