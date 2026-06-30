from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from database import get_db
from core.permissions import require_worker, require_manager
from core.audit import log_action
from core.security import get_current_user
from models.user import User
from models.order import Order, OrderItem, OrderStatus
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from models.product import Product
from models.stock import Stock
from schemas.orders import OrderCreate, OrderResponse, OrderUpdate
import uuid
from datetime import datetime
from routers.notifications import create_notification

router = APIRouter(prefix="/api/orders", tags=["Заказы"])


# ============================================
# 🔥 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СПИСАНИЯ ОСТАТКОВ
# ============================================

def process_shipment(order: Order, db: Session, operator_id: int):
    """Списание товаров со склада при отгрузке"""
    if order.shipment_doc_id:
        return  # Уже отгружен
    
    doc = WarehouseDocument(
        doc_number=f"SHP-{uuid.uuid4().hex[:8].upper()}",
        type=DocType.SHIP,
        operator_id=operator_id,
        comment=f"Отгрузка для заказа {order.order_number}",
        status=DocStatus.COMPLETED
    )
    db.add(doc)
    db.flush()
    
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    
    for item in order_items:
        stock_items = db.query(Stock).filter(
            Stock.product_id == item.product_id,
            Stock.quantity > 0
        ).order_by(Stock.quantity.desc()).all()
        
        if not stock_items:
            print(f"⚠️ Нет товара {item.product_id} на складе!")
            continue
        
        remaining = item.quantity
        for stock in stock_items:
            if remaining <= 0:
                break
            
            if stock.quantity >= remaining:
                stock.quantity -= remaining
                remaining = 0
            else:
                remaining -= stock.quantity
                stock.quantity = 0
        
        from_cell = stock_items[0].cell_id if stock_items else None
        db.add(DocumentItem(
            doc_id=doc.id,
            product_id=item.product_id,
            quantity=item.quantity,
            from_cell_id=from_cell,
            to_cell_id=None
        ))
    
    order.shipment_doc_id = doc.id
    return doc


def process_return(order: Order, db: Session):
    """Возврат товаров на склад при отмене/возврате"""
    if not order.shipment_doc_id:
        print(f"⚠️ У заказа {order.id} нет документа отгрузки, пропускаем")
        return
    
    shipment_doc = db.query(WarehouseDocument).get(order.shipment_doc_id)
    if not shipment_doc or shipment_doc.status == DocStatus.CANCELLED:
        print(f"⚠️ Документ отгрузки уже отменён или не найден")
        return
    
    doc_items = db.query(DocumentItem).filter(DocumentItem.doc_id == shipment_doc.id).all()
    if not doc_items:
        print(f"⚠️ В документе {shipment_doc.id} нет позиций")
        return
    
    for doc_item in doc_items:
        stock = db.query(Stock).filter(
            Stock.product_id == doc_item.product_id,
            Stock.cell_id == doc_item.from_cell_id
        ).first()
        
        if stock:
            stock.quantity += doc_item.quantity
            print(f"✅ Товар {doc_item.product_id} возвращён на ячейку {doc_item.from_cell_id}, новый остаток: {stock.quantity}")
        else:
            stock = Stock(
                product_id=doc_item.product_id,
                cell_id=doc_item.from_cell_id or 1,
                quantity=doc_item.quantity
            )
            db.add(stock)
            print(f"✅ Создан новый сток для товара {doc_item.product_id}, количество: {doc_item.quantity}")
    
    shipment_doc.status = DocStatus.CANCELLED
    order.shipment_doc_id = None


# ============================================
# 🔥 ОСНОВНЫЕ ЭНДПОИНТЫ
# ============================================

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, db: Session = Depends(get_db), current_user: User = require_worker):
    try:
        if not data.items:
            raise HTTPException(400, "Добавьте хотя бы одну позицию")
        
        for item in data.items:
            total_stock = db.query(Stock.quantity).filter(
                Stock.product_id == item.product_id
            ).all()
            available_qty = sum(qty[0] for qty in total_stock if qty[0] is not None)
            
            if item.quantity > available_qty:
                product = db.query(Product).get(item.product_id)
                product_name = product.name if product else f"Товар #{item.product_id}"
                raise HTTPException(
                    400,
                    detail=f"Недостаточно товара \"{product_name}\" (SKU: {product.sku if product else 'N/A'}).\n"
                           f"Запрошено: {item.quantity}, доступно: {available_qty}"
                )
        
        order_number = data.order_number.strip() if data.order_number else f"ORD-{uuid.uuid4().hex[:8].upper()}"
        total_amount = sum(item.quantity * item.unit_price for item in data.items)
        
        order = Order(
            order_number=order_number,
            client_id=data.client_id,
            status=OrderStatus.WAITING_APPROVAL,
            total_amount=total_amount,
            comment=data.comment
        )
        
        db.add(order)
        db.flush()
        
        for item in data.items:
            total_price = item.quantity * item.unit_price
            db.add(OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=total_price
            ))
        
        log_action(db, current_user, "CREATE", "order", order.id,
                   new_value={"order_number": order.order_number, "total": total_amount})
        
        db.commit()
        db.refresh(order)
        
        # 🔥 УВЕДОМЛЕНИЕ ДЛЯ МЕНЕДЖЕРОВ
        managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
        for manager in managers:
            create_notification(
                db=db,
                user_id=manager.id,
                type="order",
                title="📦 Новый заказ",
                message=f"Заказ {order.order_number} от клиента на сумму {total_amount} ₽",
                link=f"/orders"
            )
        
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 CREATE ORDER ERROR: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/", response_model=list[OrderResponse])
def list_orders(db: Session = Depends(get_db), current_user: User = require_worker):
    return db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.client)
    ).order_by(Order.created_at.desc()).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.client)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if current_user.role == 'client' and order.client_id != current_user.id:
        raise HTTPException(403, "Это не ваш заказ")
    
    return order


@router.patch("/{order_id}/approve")
def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Подтвердить заказ (менеджер/админ)"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.status != OrderStatus.WAITING_APPROVAL:
        raise HTTPException(400, "Заказ уже обработан")
    
    for item in order.items:
        total_stock = db.query(Stock.quantity).filter(
            Stock.product_id == item.product_id
        ).all()
        available_qty = sum(qty[0] for qty in total_stock if qty[0] is not None)
        
        if item.quantity > available_qty:
            product = db.query(Product).get(item.product_id)
            raise HTTPException(
                400,
                detail=f"Недостаточно товара \"{product.name}\" (SKU: {product.sku}). "
                       f"Запрошено: {item.quantity}, доступно: {available_qty}"
            )
    
    order.status = OrderStatus.PENDING
    db.commit()
    db.refresh(order)
    
    log_action(db, current_user, "APPROVE_ORDER", "order", order_id,
               new_value={"status": str(order.status)})
    
    # 🔥 УВЕДОМЛЕНИЕ ДЛЯ КЛИЕНТА
    if order.client_id:
        create_notification(
            db=db,
            user_id=order.client_id,
            type="order",
            title="✅ Заказ подтверждён",
            message=f"Ваш заказ {order.order_number} подтверждён и передан в обработку",
            link=f"/client/profile"
        )
    
    return {"message": "Заказ подтвержден", "order": order}


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Обновить статус заказа — С ПРАВИЛЬНЫМ СПИСАНИЕМ И ВОЗВРАТОМ"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    old_status = order.status
    new_status = data.status
    
    print(f"📦 Заказ {order_id}: {old_status} → {new_status}")
    
    # 🔥 СПИСЫВАЕМ ОСТАТКИ ПРИ ОТГРУЗКЕ
    if new_status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED] and not order.shipment_doc_id:
        print(f"🚚 Отгрузка заказа {order_id}, списываем остатки...")
        process_shipment(order, db, current_user.id)
        print(f"✅ Остатки списаны")
    
    # 🔥 ВОЗВРАЩАЕМ ОСТАТКИ ПРИ ОТМЕНЕ (если уже была отгрузка)
    if new_status == OrderStatus.CANCELLED and order.shipment_doc_id:
        print(f"↩️ Отмена заказа {order_id}, возвращаем остатки...")
        process_return(order, db)
        print(f"✅ Остатки возвращены")
    
    # 🔥 ВОЗВРАЩАЕМ ОСТАТКИ ПРИ ВОЗВРАТЕ (если уже была отгрузка)
    if new_status == OrderStatus.PENDING and old_status == OrderStatus.DELIVERED and order.shipment_doc_id:
        print(f"↩️ Возврат заказа {order_id}, возвращаем остатки...")
        process_return(order, db)
        print(f"✅ Остатки возвращены")
    
    # Логируем изменение статуса
    if old_status != new_status:
        log_action(
            db=db,
            user=current_user,
            action="STATUS_CHANGE",
            entity_type="order",
            entity_id=order_id,
            old_value={"status": str(old_status)},
            new_value={"status": str(new_status)}
        )
    
    order.status = new_status
    if data.comment:
        order.comment = data.comment
    
    db.commit()
    db.refresh(order)
    
    # ============================================
    # 🔥 УВЕДОМЛЕНИЯ ПРИ СМЕНЕ СТАТУСА — ВСЕ ПОЛУЧАЮТ
    # ============================================
    
    if old_status != new_status:
        status_labels = {
            'waiting_approval': 'Ожидает подтверждения',
            'pending': 'В обработке',
            'processing': 'Обрабатывается',
            'shipped': 'Отгружен',
            'delivered': 'Доставлен',
            'cancelled': 'Отменён',
            'returned': 'Возвращён'
        }
        
        status_emoji = {
            'waiting_approval': '⏳',
            'pending': '🔄',
            'processing': '⚙️',
            'shipped': '🚚',
            'delivered': '✅',
            'cancelled': '❌',
            'returned': '↩️'
        }
        
        message_text = f"Заказ {order.order_number} изменён на статус: {status_labels.get(new_status, new_status)}"
        
        # 1️⃣ УВЕДОМЛЕНИЕ КЛИЕНТУ
        if order.client_id:
            create_notification(
                db=db,
                user_id=order.client_id,
                type="order",
                title=f"{status_emoji.get(new_status, '🔄')} Статус заказа изменён",
                message=f"Ваш заказ {order.order_number} теперь в статусе: {status_labels.get(new_status, new_status)}",
                link=f"/client/profile"
            )
        
        # 2️⃣ УВЕДОМЛЕНИЕ ВСЕМ МЕНЕДЖЕРАМ/АДМИНАМ
        managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
        for manager in managers:
            create_notification(
                db=db,
                user_id=manager.id,
                type="order",
                title=f"{status_emoji.get(new_status, '🔄')} Статус заказа изменён",
                message=f"Заказ {order.order_number} ({order.client.login if order.client else 'Клиент'}) изменён на: {status_labels.get(new_status, new_status)}",
                link=f"/orders"
            )
    
    return order


# ============================================
# 🔥 ЗАПРОСЫ НА ОТМЕНУ/ВОЗВРАТ (КЛИЕНТ)
# ============================================

@router.patch("/{order_id}/cancel-request")
def request_cancel_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Клиент запрашивает отмену заказа (только до отгрузки)"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if current_user.role == 'client' and order.client_id != current_user.id:
        raise HTTPException(403, "Это не ваш заказ")
    
    if order.status not in [OrderStatus.WAITING_APPROVAL, OrderStatus.PENDING, OrderStatus.PROCESSING]:
        raise HTTPException(400, "Этот заказ уже нельзя отменить (отгружен или доставлен)")
    
    reason = data.get('reason', 'Причина не указана')
    order.comment = f"[ЗАПРОС НА ОТМЕНУ] {reason}\n{order.comment or ''}".strip()
    
    db.commit()
    db.refresh(order)
    
    # 🔥 УВЕДОМЛЕНИЕ ДЛЯ МЕНЕДЖЕРОВ
    managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
    for manager in managers:
        create_notification(
            db=db,
            user_id=manager.id,
            type="order",
            title="❓ Запрос на отмену",
            message=f"Клиент запросил отмену заказа {order.order_number}. Причина: {reason}",
            link=f"/orders"
        )
    
    return {"message": "Запрос на отмену отправлен", "order": order}


@router.patch("/{order_id}/cancel-approve")
def approve_cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Менеджер подтверждает отмену — статус CANCELLED"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
        raise HTTPException(400, "Нельзя отменить отгруженный или доставленный заказ")
    
    if order.shipment_doc_id:
        print(f"↩️ Отмена заказа {order_id} (подтверждение), возвращаем остатки...")
        process_return(order, db)
        print(f"✅ Остатки возвращены")
    
    order.status = OrderStatus.CANCELLED
    order.comment = f"[ОТМЕНА ПОДТВЕРЖДЕНА] {order.comment}".strip()
    
    db.commit()
    db.refresh(order)
    
    log_action(db, current_user, "APPROVE_CANCEL", "order", order_id,
               new_value={"status": str(order.status)})
    
    # 🔥 УВЕДОМЛЕНИЕ ДЛЯ КЛИЕНТА
    if order.client_id:
        create_notification(
            db=db,
            user_id=order.client_id,
            type="alert",
            title="❌ Заказ отменён",
            message=f"Заказ {order.order_number} отменён менеджером",
            link=f"/client/profile"
        )
    
    return {"message": "Заказ отменён. Товары возвращены на склад.", "order": order}


@router.patch("/{order_id}/cancel-reject")
def reject_cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.comment and "[ЗАПРОС НА ОТМЕНУ]" in order.comment:
        order.comment = order.comment.replace("[ЗАПРОС НА ОТМЕНУ]", "[ОТМЕНА ОТКЛОНЕНА]")
    
    db.commit()
    db.refresh(order)
    
    return {"message": "Запрос на отмену отклонён", "order": order}


@router.patch("/{order_id}/return-request")
def request_return_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Клиент запрашивает возврат заказа"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if current_user.role == 'client' and order.client_id != current_user.id:
        raise HTTPException(403, "Это не ваш заказ")
    
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(400, "Вернуть можно только доставленный заказ")
    
    reason = data.get('reason', 'Причина не указана')
    order.comment = f"[ЗАПРОС НА ВОЗВРАТ] {reason}\n{order.comment or ''}".strip()
    order.status = OrderStatus.PROCESSING
    
    db.commit()
    db.refresh(order)
    
    # 🔥 УВЕДОМЛЕНИЕ ДЛЯ МЕНЕДЖЕРОВ
    managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
    for manager in managers:
        create_notification(
            db=db,
            user_id=manager.id,
            type="order",
            title="❓ Запрос на возврат",
            message=f"Клиент запросил возврат заказа {order.order_number}. Причина: {reason}",
            link=f"/orders"
        )
    
    return {"message": "Запрос на возврат отправлен", "order": order}


@router.patch("/{order_id}/return-approve")
def approve_return_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Менеджер подтверждает возврат — С ВОЗВРАТОМ ОСТАТКОВ"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.status not in [OrderStatus.DELIVERED, OrderStatus.PROCESSING]:
        raise HTTPException(400, "Этот заказ нельзя вернуть")
    
    if order.shipment_doc_id:
        print(f"↩️ Возврат заказа {order_id} (подтверждение), возвращаем остатки...")
        process_return(order, db)
        print(f"✅ Остатки возвращены")
    
    order.status = OrderStatus.RETURNED
    order.comment = f"[ВОЗВРАТ ПОДТВЕРЖДЕН] {order.comment}".strip()
    
    db.commit()
    db.refresh(order)
    
    log_action(db, current_user, "APPROVE_RETURN", "order", order_id,
               new_value={"status": str(order.status)})
    
    # 🔥 УВЕДОМЛЕНИЕ ДЛЯ КЛИЕНТА
    if order.client_id:
        create_notification(
            db=db,
            user_id=order.client_id,
            type="order",
            title="↩️ Заказ возвращён",
            message=f"Возврат по заказу {order.order_number} подтверждён",
            link=f"/client/profile"
        )
    
    return {"message": "Возврат подтверждён. Товары возвращены на склад.", "order": order}


@router.patch("/{order_id}/return-reject")
def reject_return_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.comment and "[ЗАПРОС НА ВОЗВРАТ]" in order.comment:
        order.comment = order.comment.replace("[ЗАПРОС НА ВОЗВРАТ]", "[ВОЗВРАТ ОТКЛОНЕН]")
    order.status = OrderStatus.DELIVERED
    
    db.commit()
    db.refresh(order)
    
    return {"message": "Запрос на возврат отклонён", "order": order}