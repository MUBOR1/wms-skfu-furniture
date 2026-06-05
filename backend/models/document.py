from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, func
from database import Base
from sqlalchemy.orm import relationship
import enum

class DocType(str, enum.Enum):
    RECEIVE = "receive"
    SHIP = "ship"
    MOVE = "move"
    ADJUST = "adjust"

class DocStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class WarehouseDocument(Base):
    __tablename__ = "warehouse_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    doc_number = Column(String(50), unique=True, nullable=False)
    type = Column(Enum(DocType), nullable=False)
    status = Column(Enum(DocStatus), default=DocStatus.DRAFT)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    comment = Column(Text, nullable=True)
    
    # ✅ ОДИН created_at (убрали дубликат)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 🔗 СВЯЗЬ С ПОЗИЦИЯМИ
    items = relationship("DocumentItem", back_populates="document", cascade="all, delete-orphan")

class DocumentItem(Base):
    __tablename__ = "document_items"
    
    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("warehouse_documents.id"), nullable=False)
    
    # ✅ ДОБАВЛЕНО: ForeignKey на products.id
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    quantity = Column(Integer, nullable=False)
    from_cell_id = Column(Integer, ForeignKey("cells.id"), nullable=True)
    to_cell_id = Column(Integer, ForeignKey("cells.id"), nullable=True)
    
    # 🔗 ОБРАТНЫЕ СВЯЗИ
    document = relationship("WarehouseDocument", back_populates="items")
    product = relationship("Product")  # ← Теперь работает, т.к. есть ForeignKey выше