"""Add audio columns to reports table

Revision ID: 015
Revises: 014
Create Date: 2025-11-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '015'
down_revision: Union[str, None] = '014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add audio-related columns to reports table
    op.add_column('reports', sa.Column('audio_url', sa.String(length=500), nullable=True))
    op.add_column('reports', sa.Column('audio_generated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reports', sa.Column('audio_language', sa.String(length=10), server_default='vi', nullable=True))


def downgrade() -> None:
    # Remove audio columns
    op.drop_column('reports', 'audio_language')
    op.drop_column('reports', 'audio_generated_at')
    op.drop_column('reports', 'audio_url')
