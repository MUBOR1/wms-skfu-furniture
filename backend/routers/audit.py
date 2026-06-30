from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from core.security import get_current_user 
from models.user import User
from models.audit import AuditLog
from routers.notifications import create_notification
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/audit", tags=["Журнал действий"])

@router.get("/logs")
def get_audit_logs(
    entity_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение логов аудита с фильтрацией"""
    
    query = db.query(AuditLog)
    
    if current_user.role == 'client':
        query = query.filter(AuditLog.user_id == current_user.id)
    
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    
    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()
    
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
    current_user: User = Depends(get_current_user)
):
    """Быстрые последние действия для дашборда (упрощённый формат)"""
    
    query = db.query(AuditLog)
    
    if current_user.role == 'client':
        query = query.filter(AuditLog.user_id == current_user.id)

    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()
    
    action_map = {
        "CREATE": "Создал",
        "UPDATE": "Изменил", 
        "DELETE": "Удалил",
        "STATUS_CHANGE": "Изменил статус",
        "COMPLETE": "Завершил",
        "AUTO_SHIP": "Отгрузил",
        "CANCEL_SHIPMENT": "Отменил отгрузку",
        "ARCHIVE": "Архивировал",
        "RESTORE": "Восстановил",
        "HARD_DELETE": "Удалил полностью",
        "PERMANENT_DELETE": "Удалил навсегда",
        "APPROVE_ORDER": "Подтвердил заказ",
        "REJECT_ORDER": "Отклонил заказ",
        "REQUEST_CANCEL": "Запросил отмену",
        "APPROVE_CANCEL": "Подтвердил отмену",
        "REJECT_CANCEL": "Отклонил отмену",
        "REQUEST_RETURN": "Запросил возврат",
        "APPROVE_RETURN": "Подтвердил возврат",
        "REJECT_RETURN": "Отклонил возврат",
        "EXPORT": "Экспортировал",
        "BULK_IMPORT": "Импортировал",
        "BULK_DELETE": "Массово удалил"
    }
    
    entity_map = {
        "product": "товар",
        "document": "документ",
        "order": "заказ",
        "inventory": "инвентаризацию",
        "user": "пользователя",
        "category": "категорию",
        "zone": "зону",
        "cell": "ячейку"
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


# 🔥 НОВЫЙ ЭНДПОИНТ: Подозрительные действия
@router.get("/suspicious")
def get_suspicious_actions(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Подозрительные действия для админов (много удалений, отмен и т.д.)"""
    
    if current_user.role not in ['admin', 'warehouse_manager']:
        raise HTTPException(403, "Доступ запрещён")
    
    suspicious_actions = ['HARD_DELETE', 'PERMANENT_DELETE', 'CANCEL_SHIPMENT', 'REJECT_ORDER']
    
    logs = db.query(AuditLog).filter(
        AuditLog.action.in_(suspicious_actions)
    ).order_by(desc(AuditLog.created_at)).limit(limit).all()
    
    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        result.append({
            "id": log.id,
            "user_login": user.login if user else "Неизвестно",
            "user_full_name": user.full_name if user else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    
    # Уведомление о подозрительных действиях
    if result and len(result) > 5:
        admins = db.query(User).filter(User.role == 'admin').all()
        for admin in admins:
            create_notification(
                db=db,
                user_id=admin.id,
                type="alert",
                title="⚠️ Подозрительная активность",
                message=f"Обнаружено {len(result)} подозрительных действий в системе",
                link="/audit"
            )
    
    return result