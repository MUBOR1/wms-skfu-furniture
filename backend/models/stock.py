from sqlalchemy import Column, Integer, ForeignKey, Numeric, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class Stock(Base):
    __tablename__ = "stocks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Связи
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    cell_id = Column(Integer, ForeignKey("cells.id"), nullable=True, index=True)  # ← Адрес ячейки
    
    # Остаток
    quantity = Column(Integer, default=0, nullable=False)
    
    # 💰 Себестоимость партии (для точного учёта прибыли)
    cost_price = Column(Numeric(10, 2), default=0.0)
    
    # Метаданные
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    product = relationship("Product", backref="stock_records")
    cell = relationship("Cell", backref="stock_records")
    
    # ← Уникальность: товар может быть в нескольких ячейках, но в одной ячейке — одна запись
    __table_args__ = (
        UniqueConstraint('product_id', 'cell_id', name='uq_stock_product_cell'),
    )