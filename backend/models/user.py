from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SA_Enum  # ← важно переименовать
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    WAREHOUSE_MANAGER = "warehouse_manager"
    WAREHOUSE_WORKER = "warehouse_worker"
    CLIENT = "client"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    
    # === ИСПРАВЛЕННАЯ СТРОКА ===
    role = Column(
        SA_Enum(UserRole, values_callable=lambda x: [e.value for e in x]), 
        default=UserRole.WAREHOUSE_WORKER, 
        nullable=False
    )
    # ==========================
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())