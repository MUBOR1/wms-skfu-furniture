from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",  # ← Явный путь к .env
        env_file_encoding='utf-8',
        extra='ignore'
    )

# Создаём экземпляр настроек
settings = Settings()

# Движок БД
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    connect_args={
        'options': '-c timezone=Europe/Moscow'  # 👈 ДОБАВЛЯЕМ
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()