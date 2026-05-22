"""
Минимальный скрипт заполнения базы (мебель)
Запуск: python seed_data.py
"""
from database import SessionLocal
from models.user import User, UserRole
from models.product import Product
from models.zone import Zone
from models.cell import Cell
from models.stock import Stock
from core.security import get_password_hash

def create_test_data():
    db = SessionLocal()
    try:
        # 1. Пользователи
        print("👤 Пользователи...")
        for u in [
            {"login": "admin", "password": "123456", "full_name": "Админ", "role": UserRole.ADMIN},
            {"login": "manager", "password": "123456", "full_name": "Менеджер", "role": UserRole.WAREHOUSE_MANAGER},
            {"login": "worker", "password": "123456", "full_name": "Работник", "role": UserRole.WAREHOUSE_WORKER},
            {"login": "client", "password": "123456", "full_name": "Клиент", "role": UserRole.CLIENT},
        ]:
            if not db.query(User).filter(User.login == u["login"]).first():
                db.add(User(login=u["login"], password_hash=get_password_hash(u["password"]), full_name=u["full_name"], role=u["role"]))
        db.commit()
        
        # 2. Зоны
        print("📦 Зоны...")
        for z in [
            {"code": "Z-REC", "name": "Приёмка"}, {"code": "Z-A", "name": "Хранение А"},
            {"code": "Z-B", "name": "Хранение Б"}, {"code": "Z-SHIP", "name": "Отгрузка"},
        ]:
            if not db.query(Zone).filter(Zone.code == z["code"]).first():
                db.add(Zone(**z))
        db.commit()
        
        # 3. Ячейки
        print("📦 Ячейки...")
        for c in [
            {"zone_id": 1, "code": "R-01"}, {"zone_id": 2, "code": "A-01"},
            {"zone_id": 2, "code": "A-02"}, {"zone_id": 3, "code": "B-01"},
            {"zone_id": 4, "code": "S-01"},
        ]:
            if not db.query(Cell).filter(Cell.code == c["code"]).first():
                db.add(Cell(**c))
        db.commit()
        
        # 4. Товары (МЕБЕЛЬ)
        print("🛋️ Товары...")
        for p in [
            {"sku": "CHR-001", "name": "Стул офисный", "category": "Стулья", "weight_kg": 8.5, "min_stock": 10, "max_stock": 50},
            {"sku": "CHR-002", "name": "Кресло эргономичное", "category": "Кресла", "weight_kg": 18.0, "min_stock": 5, "max_stock": 20},
            {"sku": "TBL-001", "name": "Стол письменный", "category": "Столы", "weight_kg": 35.0, "min_stock": 3, "max_stock": 15},
            {"sku": "CAB-001", "name": "Шкаф для документов", "category": "Шкафы", "weight_kg": 45.0, "min_stock": 2, "max_stock": 10},
            {"sku": "BED-001", "name": "Кровать односпальная", "category": "Кровати", "weight_kg": 55.0, "min_stock": 2, "max_stock": 8},
            {"sku": "SOF-001", "name": "Диван трёхместный", "category": "Диваны", "weight_kg": 95.0, "min_stock": 1, "max_stock": 4},
        ]:
            if not db.query(Product).filter(Product.sku == p["sku"]).first():
                db.add(Product(**p))
        db.commit()
        
        # 5. Остатки
        print("📊 Остатки...")
        for i, qty in enumerate([35, 8, 12, 6, 4, 2], 1):
            existing = db.query(Stock).filter(Stock.product_id == i).first()
            if not existing:
                db.add(Stock(product_id=i, quantity=qty))
            elif existing.quantity != qty:
                existing.quantity = qty
        db.commit()
        
        print("\n✅ ГОТОВО! База заполнена.")
        print("Вход: admin / 123456")
        
    except Exception as e:
        print(f"❌ {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()