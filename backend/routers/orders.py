from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from database import get_db
from core.permissions import require_manager, require_worker
from models.user import User
from models.order import Order, OrderItem, OrderStatus
from models.product import Product
from models.stock import Stock
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from schemas.orders import OrderCreate, OrderUpdate, OrderResponse
from core.audit import log_action
import uuid

router = APIRouter(prefix="/api/orders", tags=["Заказы"])

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, db: Session = Depends(get_db), current_user: User = require_manager):
    try:
        if not data.items:
            raise HTTPException(status_code=400, detail="Заказ должен содержать хотя бы одну позицию")
        
        order_number = data.order_number.strip() if data.order_number else f"ORD-{uuid.uuid4().hex[:8].upper()}"
        order = Order(
            order_number=order_number, 
            client_id=data.client_id, 
            comment=data.comment, 
            status=OrderStatus.PENDING
        )
        
        db.add(order)
        db.flush()
        
        total = 0.0
        for item in data.items:
            # Проверка остатка
            total_available = db.query(func.sum(Stock.quantity)).filter(
                Stock.product_id == item.product_id
            ).scalar() or 0
            
            if total_available < item.quantity:
                product = db.query(Product).get(item.product_id)
                raise HTTPException(
                    status_code=400, 
                    detail=f"Недостаточно товара: доступно {total_available} шт."
                )
            
            item_total = item.quantity * item.unit_price
            total += item_total
            db.add(OrderItem(
                order_id=order.id, 
                product_id=item.product_id, 
                quantity=item.quantity, 
                unit_price=item.unit_price, 
                total_price=item_total
            ))
        
        order.total_amount = total
        
        log_action(db, current_user, "CREATE", "order", order.id, 
                   new_value={"order_number": order.order_number, "status": "pending"})
        
        db.commit()
        db.refresh(order)
        return order
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Заказ с таким номером уже существует")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=list[OrderResponse])
def list_orders(db: Session = Depends(get_db), current_user: User = require_worker):
    return db.query(Order).order_by(Order.created_at.desc()).all()

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = require_worker):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order

# 🔗 НОВЫЙ ЭНДПОИНТ: Создание отгрузки
@router.post("/{order_id}/create-shipment")
def create_shipment_from_order(order_id: int, db: Session = Depends(get_db), current_user: User = require_manager):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.status not in [OrderStatus.PENDING, OrderStatus.PROCESSING]:
        raise HTTPException(400, "Можно создать отгрузку только для заказа в статусе pending/processing")
    
    if order.shipment_doc_id:
        existing = db.query(WarehouseDocument).get(order.shipment_doc_id)
        return {
            "message": "Отгрузка уже создана", 
            "document_id": order.shipment_doc_id, 
            "doc_number": existing.doc_number if existing else None
        }
    
    # Создаём документ отгрузки
    doc_number = f"SHP-{order.order_number.replace('ORD-', '')}"
    doc = WarehouseDocument(
        doc_number=doc_number,
        type=DocType.SHIP,
        operator_id=current_user.id,
        comment=f"Отгрузка по заказу {order.order_number}",
        status=DocStatus.DRAFT
    )
    db.add(doc)
    db.flush()
    
    # Переносим позиции заказа в документ
    for item in order.items:
        # Ищем первую ячейку с товаром
        stock = db.query(Stock).filter(
            Stock.product_id == item.product_id,
            Stock.quantity > 0
        ).first()
        
        db.add(DocumentItem(
            doc_id=doc.id,
            product_id=item.product_id,
            quantity=item.quantity,
            from_cell_id=stock.cell_id if stock else None,
            to_cell_id=None
        ))
    
    # Привязываем документ к заказу
    order.shipment_doc_id = doc.id
    db.commit()
    
    log_action(db, current_user, "CREATE_SHIPMENT", "order", order_id, 
               new_value={"shipment_doc_id": doc.id, "doc_number": doc_number})
    
    return {
        "message": "Отгрузка создана", 
        "document_id": doc.id, 
        "doc_number": doc_number, 
        "status": "draft"
    }

@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_status(
    order_id: int,
    data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    old_status = order.status.value if hasattr(order.status, 'value') else str(order.status)
    new_status = data.status.value if hasattr(data.status, 'value') else str(data.status)
    
    # 🔙 АВТОВОЗВРАТ ПРИ ОТМЕНЕ ОТГРУЖЕННОГО ЗАКАЗА
    if new_status == "cancelled" and old_status in ["shipped", "delivered"]:
        if not order.shipment_doc_id:
            raise HTTPException(400, "Не найден привязанный документ отгрузки")
        
        doc = db.query(WarehouseDocument).get(order.shipment_doc_id)
        if not doc or doc.status != DocStatus.COMPLETED:
            raise HTTPException(400, "Документ отгрузки не проведён")
        
        # Возвращаем товары на склад
        doc_items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc.id).all()
        returned_items = []
        
        for item in doc_items:
            product = db.query(Product).get(item.product_id)
            if not product:
                continue
                
            cell_id = item.from_cell_id
            if not cell_id:
                fallback = db.query(Stock).filter(Stock.product_id == item.product_id).first()
                if fallback:
                    cell_id = fallback.cell_id
            
            stock = db.query(Stock).filter(
                Stock.product_id == item.product_id,
                Stock.cell_id == cell_id
            ).first()
            
            if not stock:
                stock = Stock(product_id=item.product_id, cell_id=cell_id, quantity=0)
                db.add(stock)
                db.flush()
            
            stock.quantity += item.quantity
            returned_items.append({"product": product.name, "qty": item.quantity})
        
        doc.status = DocStatus.CANCELLED
        doc.comment = (doc.comment or "") + f" | Возврат при отмене заказа {order.order_number}"
        
        log_action(db, current_user, "CANCEL_SHIPMENT", "document", doc.id,
                   new_value={"status": "cancelled", "returned": returned_items})
    
    order.status = data.status
    if data.comment is not None:
        order.comment = data.comment
    
    log_action(db, current_user, "UPDATE_STATUS", "order", order_id,
               old_value={"status": old_status}, new_value={"status": new_status})
    
    db.commit()
    db.refresh(order)
    return order