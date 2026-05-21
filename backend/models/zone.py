from sqlalchemy import Column, Integer, String, Boolean
from database import Base

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)  # A, B, C...
    name = Column(String(50), nullable=False)
    type = Column(String(30), default="storage")  # storage, receiving, shipping, defect
    capacity = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)