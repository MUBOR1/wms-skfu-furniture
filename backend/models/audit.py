from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func
from database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, COMPLETE
    entity_type = Column(String(50), nullable=False)  # product, document, order, inventory
    entity_id = Column(Integer, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())