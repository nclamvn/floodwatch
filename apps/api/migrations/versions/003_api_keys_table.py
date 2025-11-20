"""Add api_keys table for API key management

Revision ID: 003
Revises: 002
Create Date: 2025-10-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create api_keys table"""
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('key_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('scopes', postgresql.JSONB, server_default='["read:public"]', nullable=False),
        sa.Column('rate_limit', sa.Integer, server_default='120', nullable=False)
    )

    # Create indexes for faster lookups
    op.create_index('idx_api_keys_key_hash', 'api_keys', ['key_hash'])
    op.create_index('idx_api_keys_last_used_at', 'api_keys', ['last_used_at'])


def downgrade() -> None:
    """Drop api_keys table"""
    op.drop_index('idx_api_keys_last_used_at', table_name='api_keys')
    op.drop_index('idx_api_keys_key_hash', table_name='api_keys')
    op.drop_table('api_keys')
