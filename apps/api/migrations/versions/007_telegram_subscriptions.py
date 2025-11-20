"""Add telegram_subscriptions table

Revision ID: 007
Revises: 006
Create Date: 2025-11-18

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create telegram_subscriptions table"""
    op.create_table(
        'telegram_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('chat_id', sa.Integer(), unique=True, nullable=False),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False, server_default='true'),
        sa.Column('provinces', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('min_trust_score', sa.Float(), default=0.5, nullable=False, server_default='0.5')
    )

    # Create index on chat_id for fast lookups
    op.create_index('ix_telegram_subscriptions_chat_id', 'telegram_subscriptions', ['chat_id'])

    # Create index on is_active for filtering active subscriptions
    op.create_index('ix_telegram_subscriptions_is_active', 'telegram_subscriptions', ['is_active'])


def downgrade() -> None:
    """Drop telegram_subscriptions table"""
    op.drop_index('ix_telegram_subscriptions_is_active', table_name='telegram_subscriptions')
    op.drop_index('ix_telegram_subscriptions_chat_id', table_name='telegram_subscriptions')
    op.drop_table('telegram_subscriptions')
