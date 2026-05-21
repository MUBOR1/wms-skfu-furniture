from sqlalchemy import Column, Integer, String, Float, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base
import enum

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    total_amount = Column(Float, default=0.0)
    comment = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    client = relationship("User", backref="orders")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")