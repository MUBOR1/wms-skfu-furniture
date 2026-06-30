"""add returned status to orders

Revision ID: 844dc204a964
Revises: 7e7fa980fecb
Create Date: 2026-06-21 05:26:09.777795

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '844dc204a964'
down_revision: Union[str, None] = '7e7fa980fecb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 🔥 ДОБАВЛЯЕМ НОВОЕ ЗНАЧЕНИЕ В ENUM
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'returned'")


def downgrade() -> None:
    # В PostgreSQL нельзя удалить значение из ENUM
    # Поэтому downgrade пропускаем
    pass