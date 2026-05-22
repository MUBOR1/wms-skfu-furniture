from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_worker
from models.user import User
from models.audit import AuditLog
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/audit", tags=["Журнал действий"])

@router.get("/logs")
def get_audit_logs(
    entity_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
        
    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()