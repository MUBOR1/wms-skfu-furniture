# routers/notifications.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.user import User
from models.notification import Notification
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/notifications", tags=["Уведомления"])


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime
    link: Optional[str] = None
    
    class Config:
        from_attributes = True


def create_notification(db: Session, user_id: int, type: str, title: str, message: str, link: str = None):
    """Создать уведомление для пользователя"""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
        is_read=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить уведомления пользователя"""
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()
    
    return notifications


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Количество непрочитанных уведомлений"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    return {"unread_count": count}


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отметить уведомление как прочитанное"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(404, "Уведомление не найдено")
    
    notification.is_read = True
    db.commit()
    
    return {"message": "Уведомление отмечено как прочитанное"}


@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отметить все уведомления как прочитанные"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    return {"message": "Все уведомления прочитаны"}


# 🔥 НОВЫЙ: УДАЛИТЬ ОДНО УВЕДОМЛЕНИЕ
@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить уведомление"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(404, "Уведомление не найдено")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Уведомление удалено"}


# 🔥 НОВЫЙ: УДАЛИТЬ ВСЕ УВЕДОМЛЕНИЯ
@router.delete("/")
def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить все уведомления пользователя"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).delete()
    db.commit()
    
    return {"message": "Все уведомления удалены"}