from database import SessionLocal, engine
from models.user import User
from sqlalchemy import text

try:
    with engine.connect() as conn:
        ver = conn.execute(text("SELECT version()")).scalar()
        print(f"✅ DB Connected: {ver[:40]}...")
    
    with SessionLocal() as db:
        count = db.query(User).count()
        print(f"✅ Table 'users' exists. Records: {count}")
        
        if count == 0:
            db.add(User(login="admin_demo", password_hash="test_hash", role="admin", full_name="Администратор"))
            db.commit()
            print("🆕 Добавлен тестовый пользователь")
    print("🎉 ШАГ 2 ЗАВЕРШЁН УСПЕШНО")
except Exception as e:
    print(f"❌ Ошибка: {e}")