# models/notification.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)  # 'order', 'shipment', 'alert', 'system'
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="notifications")