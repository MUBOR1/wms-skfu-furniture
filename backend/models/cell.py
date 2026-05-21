from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database import Base

class Cell(Base):
    __tablename__ = "cells"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, nullable=False)  # Связь с зоной
    code = Column(String(20), nullable=False)  # A-01-02
    x = Column(Integer, default=0)
    y = Column(Integer, default=0)
    max_capacity = Column(Integer, default=10)
    status = Column(String(20), default="empty")  # empty, occupied, reserved