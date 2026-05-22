import json
from sqlalchemy.orm import Session
from models.audit import AuditLog
from models.user import User

def log_action(db: Session, user: User | None, action: str, entity_type: str, entity_id: int, old_value=None, new_value=None):
    # Без try/except. Если упадёт — мы сразу увидим причину.
    old_str = json.dumps(old_value, ensure_ascii=False, default=str) if old_value else None
    new_str = json.dumps(new_value, ensure_ascii=False, default=str) if new_value else None

    log = AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_str,
        new_value=new_str
    )
    db.add(log)
    # Commit вызывается ОДИН РАЗ в роутере. Здесь только добавляем в сессию.