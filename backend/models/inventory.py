from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    operator_id = Column(Integer, nullable=True)

class InventoryRecord(Base):
    __tablename__ = "inventory_records"
    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=False)
    product_id = Column(Integer, nullable=False)
    cell_id = Column(Integer, nullable=True)
    planned_qty = Column(Integer, nullable=False)  # Авто-заполняется из Stock
    actual_qty = Column(Integer, nullable=False)   # Вводится кладовщиком
    diff = Column(Integer, default=0)              # actual - planned