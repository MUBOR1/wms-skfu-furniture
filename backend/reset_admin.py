from database import SessionLocal
from models.user import User
from core.security import get_password_hash

def reset_admin_password():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.login == "admin").first()
        if not user:
            print("❌ Пользователь 'admin' не найден")
            return
        
        # Генерируем свежий, валидный хеш для пароля '123456'
        user.password_hash = get_password_hash("123456")
        db.commit()
        print("✅ Пароль для 'admin' успешно сброшен на '123456'")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_admin_password()