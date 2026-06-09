from sqlalchemy.orm import Session
from models.audit import AuditLog  # ✅ Импортируем модель из models
import json
from typing import Any, Optional


def log_action(
    db: Session,
    user: Any,
    action: str,
    entity_type: str,
    entity_id: int,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None
):
    """
    Записывает действие в журнал аудита.
    """
    try:
        # Сериализуем dict в JSON string
        old_json = json.dumps(old_value, ensure_ascii=False, default=str) if old_value else None
        new_json = json.dumps(new_value, ensure_ascii=False, default=str) if new_value else None
        
        # Получаем user_id безопасно
        user_id = getattr(user, 'id', None)
        
        # Создаём запись лога
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_json,
            new_value=new_json
        )
        
        # Добавляем и коммитим
        db.add(log_entry)
        db.commit()
        
    except Exception as e:
        # Если логирование упало — не ломаем основное действие
        print(f"⚠️ Audit log error: {e}")
        try:
            db.rollback()
        except:
            pass