from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base
import enum

class InvStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPLETED = "completed"

class Inventory(Base):
    __tablename__ = "inventories"
    
    id = Column(Integer, primary_key=True, index=True)
    doc_number = Column(String(50), unique=True, nullable=False)
    status = Column(Enum(InvStatus), default=InvStatus.DRAFT)
    operator_id = Column(Integer, nullable=True)
    
    # 🔥 ДОБАВЛЯЕМ ОТСУТСТВУЮЩИЕ ПОЛЯ
    category = Column(String(50), nullable=True)
    comment = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class InventoryRecord(Base):
    __tablename__ = "inventory_records"
    
    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=False)
    product_id = Column(Integer, nullable=False)
    cell_id = Column(Integer, nullable=True)
    
    # 🔥 ПЕРЕИМЕНОВЫВАЕМ ПОЛЯ ДЛЯ УДОБСТВА
    planned_qty = Column(Integer, default=0)  # Системное количество (было system_quantity)
    actual_qty = Column(Integer, default=0)   # Фактическое количество (было actual_quantity)
    diff = Column(Integer, default=0)         # Разница (actual - planned)
    
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())