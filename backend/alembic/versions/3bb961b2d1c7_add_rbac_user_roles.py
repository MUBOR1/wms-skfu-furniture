"""add rbac user roles

Revision ID: 3bb961b2d1c7
Revises: 740529ad5170
Create Date: 2026-05-21 18:33:14.875762

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '3bb961b2d1c7'
down_revision = '740529ad5170'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === ШАГ 0: Нормализуем существующие данные к нижнему регистру ===
    # Конвертируем "ADMIN" → "admin", "WAREHOUSE_MANAGER" → "warehouse_manager" и т.д.
    op.execute("""
        UPDATE users 
        SET role = LOWER(role) 
        WHERE role IS NOT NULL AND role != LOWER(role)
    """)
    
    # === ШАГ 1: Создаём ENUM тип в нижнем регистре ===
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM('admin', 'warehouse_manager', 'warehouse_worker', 'client');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # === ШАГ 2: Меняем тип колонки с явным приведением ===
    op.alter_column('users', 'role',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.Enum('admin', 'warehouse_manager', 'warehouse_worker', 'client', name='userrole'),
               existing_nullable=False,
               postgresql_using='role::userrole')


def downgrade() -> None:
    # === ШАГ 1: Возвращаем колонку к строковому типу ===
    op.alter_column('users', 'role',
               existing_type=sa.Enum('admin', 'warehouse_manager', 'warehouse_worker', 'client', name='userrole'),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False)
    
    # === ШАГ 2: Удаляем ENUM тип ===
    op.execute("DROP TYPE IF EXISTS userrole")