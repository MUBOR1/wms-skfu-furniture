import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from database import Base, settings, engine
from models import User, Zone, Cell, Product, WarehouseDocument, DocumentItem, Stock

# 1. Добавляем backend в PYTHONPATH, чтобы Alembic видел наши модули
sys.path.append(str(Path(__file__).resolve().parent.parent))

# Alembic Config object
config = context.config

# Logging setup
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Метаданные для авто-генерации миграций
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (не используется, но оставим для совместимости)."""
    # Используем URL из наших настроек, а не из alembic.ini
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # ← ИСПОЛЬЗУЕМ engine из database.py, который уже настроен с .env
    connectable = engine
    
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True  # Сравнивать типы колонок
        )
        with context.begin_transaction():
            context.run_migrations()


# Точка входа Alembic
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()