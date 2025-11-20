"""Add duplicate_of column to reports

Revision ID: 002
Revises: 001
Create Date: 2025-10-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add duplicate_of column to reports table"""
    op.add_column(
        'reports',
        sa.Column('duplicate_of', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Create index for faster duplicate lookups
    op.create_index(
        'idx_reports_duplicate_of',
        'reports',
        ['duplicate_of']
    )


def downgrade() -> None:
    """Remove duplicate_of column from reports table"""
    op.drop_index('idx_reports_duplicate_of', table_name='reports')
    op.drop_column('reports', 'duplicate_of')
