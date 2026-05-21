# create_admin.py - Создать админа с паролем '123456'
from database import SessionLocal, settings
from models.user import User
from core.security import get_password_hash
from sqlalchemy.exc import IntegrityError

def create_admin():
    db = SessionLocal()
    try:
        # Проверяем, нет ли уже такого пользователя
        existing = db.query(User).filter(User.login == "admin").first()
        if existing:
            print(f"⚠️ Пользователь 'admin' уже существует (ID: {existing.id})")
            return
        
        # Создаём нового с правильно захешированным паролем
        new_user = User(
            login="admin",
            password_hash=get_password_hash("123456"),  # ← passlib сделает всё правильно
            full_name="Администратор",
            role="admin",
            is_active=True
        )
        db.add(new_user)
        db.commit()
        print(f"✅ Создан пользователь: admin / 123456 (ID: {new_user.id})")
        
    except IntegrityError:
        db.rollback()
        print("⚠️ Пользователь 'admin' уже существует (конфликт уникальности)")
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()