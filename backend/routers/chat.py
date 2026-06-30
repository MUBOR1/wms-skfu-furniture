from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.user import User
from models.chat import ChatMessage
from routers.notifications import create_notification
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/chat", tags=["Чат"])


class MessageCreate(BaseModel):
    message: str
    is_client_message: bool = True


class MessageResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str]
    user_role: Optional[str]
    message: str
    is_client_message: bool
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/messages", response_model=List[MessageResponse])
def get_messages(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить сообщения чата"""
    messages = db.query(ChatMessage).order_by(
        ChatMessage.created_at.desc()
    ).limit(limit).all()
    
    result = []
    for msg in messages[::-1]:  # В хронологическом порядке
        result.append({
            "id": msg.id,
            "user_id": msg.user_id,
            "user_name": msg.user.full_name or msg.user.login if msg.user else None,
            "user_role": msg.user.role if msg.user else None,
            "message": msg.message,
            "is_client_message": msg.is_client_message,
            "is_read": msg.is_read,
            "created_at": msg.created_at
        })
    
    return result


@router.post("/messages", response_model=MessageResponse)
def send_message(
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отправить сообщение в чат"""
    try:
        message = ChatMessage(
            user_id=current_user.id,
            message=data.message,
            is_client_message=data.is_client_message,
            is_read=False
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        
        # 🔥 УВЕДОМЛЕНИЕ ДЛЯ АДМИНОВ/МЕНЕДЖЕРОВ (если сообщение от клиента)
        if data.is_client_message:
            managers = db.query(User).filter(
                User.role.in_(['admin', 'warehouse_manager']),
                User.id != current_user.id
            ).all()
            for manager in managers:
                create_notification(
                    db=db,
                    user_id=manager.id,
                    type="chat",
                    title="💬 Новое сообщение в чате",
                    message=f"Клиент {current_user.full_name or current_user.login} написал: {data.message[:50]}...",
                    link="/chat"
                )
        
        return {
            "id": message.id,
            "user_id": message.user_id,
            "user_name": current_user.full_name or current_user.login,
            "user_role": current_user.role,
            "message": message.message,
            "is_client_message": message.is_client_message,
            "is_read": message.is_read,
            "created_at": message.created_at
        }
        
    except Exception as e:
        db.rollback()
        print(f"🔴 Ошибка отправки сообщения: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Количество непрочитанных сообщений для пользователя"""
    if current_user.role == 'client':
        # Клиент видит непрочитанные ответы от админов/менеджеров
        count = db.query(ChatMessage).filter(
            ChatMessage.is_client_message == False,
            ChatMessage.is_read == False
        ).count()
    else:
        # Админ/менеджер видит непрочитанные сообщения от клиентов
        count = db.query(ChatMessage).filter(
            ChatMessage.is_client_message == True,
            ChatMessage.is_read == False
        ).count()
    
    return {"unread_count": count}


@router.post("/mark-read")
def mark_messages_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отметить сообщения как прочитанные"""
    if current_user.role == 'client':
        # Клиент отмечает прочитанными ответы
        db.query(ChatMessage).filter(
            ChatMessage.is_client_message == False,
            ChatMessage.is_read == False
        ).update({"is_read": True})
    else:
        # Админ/менеджер отмечает прочитанными сообщения от клиентов
        db.query(ChatMessage).filter(
            ChatMessage.is_client_message == True,
            ChatMessage.is_read == False
        ).update({"is_read": True})
    
    db.commit()
    return {"message": "Сообщения отмечены как прочитанные"}