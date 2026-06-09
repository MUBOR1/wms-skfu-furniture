from sqlalchemy import Column, Integer, String, Float, Boolean, Numeric, DateTime, func
from database import Base
from datetime import datetime

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Идентификация
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=True)
    description = Column(String(500), nullable=True)
    
    # Единицы и габариты
    unit = Column(String(10), default="шт")
    weight_kg = Column(Float, default=0.0)
    volume_m3 = Column(Float, default=0.0)
    barcode = Column(String(50), nullable=True)
    
    # 💰 ЦЕНЫ (используем Numeric для точных денег)
    purchase_price = Column(Numeric(10, 2), default=0.0)  # Цена закупки
    sale_price = Column(Numeric(10, 2), default=0.0)       # Цена продажи
    
    # Управление остатками
    min_stock = Column(Integer, default=0)
    max_stock = Column(Integer, default=1000)
    
    # Статус
    is_active = Column(Boolean, default=True)
    
    # 🔧 НОВОЕ: Дата архивации (заполняется при отправке в архив)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    
    # 🔧 Мета-поля для аудита
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())