# create_favorites_table.py
from database import engine, Base
# Импортируем ВСЕ модели, чтобы SQLAlchemy знал о всех таблицах
from models.user import User
from models.product import Product
from models.order import Order, OrderItem
from models.stock import Stock
from models.profile import UserProfile, Favorite, Review, CartItem

if __name__ == "__main__":
    print("⏳ Создаю все недостающие таблицы...")
    
    # Создаём ВСЕ таблицы сразу (Base.metadata содержит информацию о всех таблицах)
    Base.metadata.create_all(bind=engine)
    
    print("✅ Готово! Все таблицы созданы.")
    print("\n📋 Созданные таблицы:")
    print("  - users (пользователи)")
    print("  - products (товары)")
    print("  - orders (заказы)")
    print("  - order_items (позиции заказов)")
    print("  - stocks (остатки)")
    print("  - user_profiles (профили пользователей)")
    print("  - favorites (избранное) ⭐")
    print("  - reviews (отзывы)")
    print("  - cart_items (корзина)")