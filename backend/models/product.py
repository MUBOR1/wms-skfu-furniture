from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)
    unit = Column(String(10), default="шт")
    weight_kg = Column(Float, default=0.0)
    volume_m3 = Column(Float, default=0.0)
    barcode = Column(String(50), nullable=True)
    min_stock = Column(Integer, default=0)
    max_stock = Column(Integer, default=1000)
    is_active = Column(Boolean, default=True)