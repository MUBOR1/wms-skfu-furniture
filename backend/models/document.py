from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    operator_id = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)

class DocumentItem(Base):
    __tablename__ = "document_items"
    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("warehouse_documents.id"), nullable=False)
    product_id = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    from_cell_id = Column(Integer, nullable=True)
    to_cell_id = Column(Integer, nullable=True)