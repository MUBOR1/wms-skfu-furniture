# backend/check_db.py
from database import SessionLocal, engine
from sqlalchemy import inspect, text

db = SessionLocal()

# 1. Все таблицы
print("=" * 60)
print("📊 ТАБЛИЦЫ В БАЗЕ ДАННЫХ:")
print("=" * 60)

inspector = inspect(engine)
tables = inspector.get_table_names()

for table in tables:
    print(f"\n📋 Таблица: {table}")
    columns = inspector.get_columns(table)
    for col in columns:
        print(f"   - {col['name']}: {col['type']}")

# 2. Количество записей в каждой таблице
print("\n" + "=" * 60)
print("📊 КОЛИЧЕСТВО ЗАПИСЕЙ:")
print("=" * 60)

for table in tables:
    try:
        result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
        count = result.scalar()
        print(f"   {table}: {count} записей")
    except Exception as e:
        print(f"   {table}: Ошибка - {e}")

db.close()