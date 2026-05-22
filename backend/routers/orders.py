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
from schemas.orders import OrderCreate, OrderUpdate, OrderResponse
from core.audit import log_action
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
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
        
        total_amount = 0.0
        for item in data.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Товар ID {item.product_id} не найден")
            
            # Проверка остатка (сумма по всем ячейкам)
            total_available = db.query(func.sum(Stock.quantity)).filter(
                Stock.product_id == item.product_id
            ).scalar() or 0
            
            if total_available < item.quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Недостаточно товара '{product.name}': доступно {total_available} шт., заказано {item.quantity} шт."
                )
            
            unit_price = item.unit_price if item.unit_price else float(product.sale_price or 0)
            item_total = item.quantity * unit_price
            total_amount += item_total
            
            db.add(OrderItem(
                order_id=order.id, 
                product_id=item.product_id, 
                quantity=item.quantity, 
                unit_price=unit_price, 
                total_price=item_total
            ))
        
        order.total_amount = total_amount
        db.commit()
        db.refresh(order)
        
        log_action(db, current_user, "CREATE", "order", order.id, 
                   new_value={"order_number": order.order_number, "status": "pending"})
        return order
        
    except HTTPException:
        db.rollback()
        raise
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

# 🔗 НОВЫЙ ЭНДПОИНТ: Создание отгрузки на основе заказа
@router.post("/{order_id}/create-shipment", response_model=dict)
def create_shipment_from_order(order_id: int, db: Session = Depends(get_db), current_user: User = require_manager):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    if order.status not in [OrderStatus.PENDING, OrderStatus.PROCESSING]:
        raise HTTPException(400, "Можно создать отгрузку только для заказа в статусе pending или processing")
    
    if order.shipment_doc_id:
        existing = db.query(WarehouseDocument).get(order.shipment_doc_id)
        return {"message": "Отгрузка уже создана", "document_id": order.shipment_doc_id, "doc_number": existing.doc_number if existing else None}
    
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
        # Ищем первую ячейку, где есть этот товар
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
    
    return {"message": "Отгрузка создана", "document_id": doc.id, "doc_number": doc_number, "status": "draft"}

@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_status(order_id: int, data: OrderUpdate, db: Session = Depends(get_db), current_user: User = require_manager):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    old_status = order.status.value if hasattr(order.status, 'value') else str(order.status)
    order.status = data.status
    if data.comment is not None:
        order.comment = data.comment
    
    log_action(db, current_user, "UPDATE_STATUS", "order", order_id,
               old_value={"status": old_status},
               new_value={"status": data.status.value if hasattr(data.status, 'value') else str(data.status)})
    
    db.commit()
    db.refresh(order)
    return order