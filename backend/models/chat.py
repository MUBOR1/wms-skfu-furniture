from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_client_message = Column(Boolean, default=True)  # True = от клиента, False = от админа/менеджера
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", backref="chat_messages")