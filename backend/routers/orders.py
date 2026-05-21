from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from core.permissions import require_manager, require_worker
from models.user import User
from models.order import Order, OrderItem, OrderStatus
from schemas.orders import OrderCreate, OrderUpdate, OrderResponse
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

@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_status(order_id: int, data: OrderUpdate, db: Session = Depends(get_db), current_user: User = require_manager):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    order.status = data.status
    if data.comment is not None:
        order.comment = data.comment
    db.commit()
    db.refresh(order)
    return order