"""change status to string

Revision ID: 7e7fa980fecb
Revises: 459a19e284c4
Create Date: 2026-06-21 01:20:23.172400

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7e7fa980fecb'
down_revision: Union[str, None] = '459a19e284c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 🔥 СНАЧАЛА ДОБАВЛЯЕМ КОЛОНКУ С DEFAULT
    op.add_column('orders', sa.Column('status', sa.String(length=50), nullable=False, server_default='waiting_approval'))


def downgrade() -> None:
    op.drop_column('orders', 'status')