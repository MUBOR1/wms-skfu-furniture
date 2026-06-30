"""add status column to orders

Revision ID: 459a19e284c4
Revises: dce4ed8a6286
Create Date: 2026-06-21 00:55:13.036908

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision: str = '459a19e284c4'
down_revision: Union[str, None] = 'dce4ed8a6286'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Создаём ENUM если его нет
    order_status_enum = ENUM(
        'waiting_approval', 'pending', 'processing', 
        'shipped', 'delivered', 'cancelled',
        name='orderstatus',
        create_type=True
    )
    order_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Добавляем колонку с DEFAULT значением
    op.add_column('orders', sa.Column('status', order_status_enum, nullable=False, server_default='waiting_approval'))


def downgrade() -> None:
    op.drop_column('orders', 'status')