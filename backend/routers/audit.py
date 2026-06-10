from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
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
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    """Получение логов аудита с фильтрацией"""
    
    query = db.query(AuditLog)
    
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    
    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()
    
    # Преобразуем в словари
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    
    return result


@router.get("/logs/recent")
def get_recent_logs(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    """Быстрые последние действия для дашборда (упрощённый формат)"""
    
    logs = db.query(AuditLog)\
        .order_by(desc(AuditLog.created_at))\
        .limit(limit)\
        .all()
    
    # Маппинг действий на русские названия
    action_map = {
        "CREATE": "Создал",
        "UPDATE": "Изменил", 
        "DELETE": "Удалил",
        "STATUS_CHANGE": "Изменил статус",
        "COMPLETE": "Завершил",
        "AUTO_SHIP": "Отгрузил",
        "CANCEL_SHIPMENT": "Отменил отгрузку"
    }
    
    # Маппинг типов сущностей
    entity_map = {
        "product": "товар",
        "document": "документ",
        "order": "заказ",
        "inventory": "инвентаризацию",
        "user": "пользователя"
    }
    
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "actionLabel": action_map.get(log.action, log.action),
            "entity_type": entity_map.get(log.entity_type, log.entity_type),
            "entity_type_raw": log.entity_type,
            "entity_id": log.entity_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    
    return result