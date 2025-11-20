"""Increase source column length to 500

Revision ID: 012
Revises: 011
Create Date: 2025-11-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '012'
down_revision: Union[str, None] = '011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Increase source column from VARCHAR(100) to VARCHAR(500)
    # to accommodate full URLs from news sources
    op.execute('ALTER TABLE reports ALTER COLUMN source TYPE VARCHAR(500)')
    op.execute('ALTER TABLE road_events ALTER COLUMN source TYPE VARCHAR(500)')


def downgrade() -> None:
    op.execute('ALTER TABLE reports ALTER COLUMN source TYPE VARCHAR(100)')
    op.execute('ALTER TABLE road_events ALTER COLUMN source TYPE VARCHAR(100)')
