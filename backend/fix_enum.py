# fix_enum.py
from database import engine

def fix_enum():
    with engine.connect() as conn:
        # Проверяем текущие значения
        result = conn.execute("SELECT enum_range(NULL::orderstatus)")
        print("Текущие значения:", result.fetchone()[0])
        
        # Добавляем значение
        conn.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'waiting_approval'")
        conn.commit()
        
        # Проверяем результат
        result = conn.execute("SELECT enum_range(NULL::orderstatus)")
        print("Новые значения:", result.fetchone()[0])
        
        print("✅ ENUM обновлен!")

if __name__ == "__main__":
    fix_enum()