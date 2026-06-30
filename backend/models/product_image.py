# models/product_image.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class ProductImage(Base):
    __tablename__ = "product_images"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    is_main = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())