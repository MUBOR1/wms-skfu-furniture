from sqlalchemy import Column, Integer, String, Float, Enum, DateTime, ForeignKey, func, Numeric, Text
from sqlalchemy.orm import relationship
from database import Base
import enum

class OrderStatus(str, enum.Enum):
    """Статусы заказа"""
    WAITING_APPROVAL = "waiting_approval"
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"
class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    
    # 🔥 ИЗМЕНЕНО: ТЕПЕРЬ ЭТО STRING, А НЕ ENUM!
    status = Column(String(50), default="waiting_approval", nullable=False)
    
    total_amount = Column(Float, default=0.0)
    comment = Column(String(255), nullable=True)
    
    delivery_address = Column(String(255), nullable=True)
    delivery_method = Column(String(50), nullable=True)
    pickup_point_id = Column(Integer, nullable=True)
    client_phone = Column(String(20), nullable=True)
    client_email = Column(String(100), nullable=True)
    
    shipment_doc_id = Column(Integer, ForeignKey("warehouse_documents.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    client = relationship("User", backref="orders")
    shipment_doc = relationship("WarehouseDocument", foreign_keys=[shipment_doc_id])


class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)
    
    order = relationship("Order", back_populates="items")
    product = relationship("Product")