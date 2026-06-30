"""fix_order_status_enum

Revision ID: 1dce6ce85596
Revises: efdb71286585
Create Date: 2026-06-21 00:18:39.272580

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '1dce6ce85596'
down_revision: Union[str, None] = 'efdb71286585'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ Добавляем значение в ENUM
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'waiting_approval'")


def downgrade() -> None:
    pass