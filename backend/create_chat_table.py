from database import engine
from models.chat import ChatMessage

if __name__ == "__main__":
    print("⏳ Создаю таблицу chat_messages...")
    ChatMessage.metadata.create_all(bind=engine)
    print("✅ Готово! Таблица добавлена в БД.")