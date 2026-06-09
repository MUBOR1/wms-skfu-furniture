from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
from core.permissions import require_worker, require_manager
from core.audit import log_action
from models.user import User
from models.order import Order, OrderItem, OrderStatus
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from models.product import Product
from models.stock import Stock
from schemas.orders import OrderCreate, OrderResponse, OrderUpdate
import uuid

router = APIRouter(prefix="/api/orders", tags=["Заказы"])

def _process_document_stock(db: Session, doc_type: str, items: list, log_prefix: str = ""):
    """Общая логика обновления остатков для всех типов документов."""
    for item in items:
        product = db.query(Product).get(item.product_id)
        if not product:
            continue
        
        if doc_type == "receive":
            stock = db.query(Stock).filter(
                Stock.product_id == item.product_id,
                Stock.cell_id == item.to_cell_id
            ).first()
            if not stock:
                stock = Stock(
                    product_id=item.product_id,
                    cell_id=item.to_cell_id,
                    quantity=0,
                    cost_price=float(product.purchase_price) if product.purchase_price else 0
                )
                db.add(stock)
                db.flush()
            stock.quantity += item.quantity
            
        elif doc_type == "ship":
            stock = db.query(Stock).filter(
                Stock.product_id == item.product_id,
                Stock.cell_id == item.from_cell_id
            ).first()
            if stock and stock.quantity >= item.quantity:
                stock.quantity -= item.quantity
                
        elif doc_type == "move":
            if item.from_cell_id and item.to_cell_id and item.from_cell_id != item.to_cell_id:
                stock_from = db.query(Stock).filter(
                    Stock.product_id == item.product_id,
                    Stock.cell_id == item.from_cell_id
                ).first()
                if stock_from and stock_from.quantity >= item.quantity:
                    stock_from.quantity -= item.quantity
                
                stock_to = db.query(Stock).filter(
                    Stock.product_id == item.product_id,
                    Stock.cell_id == item.to_cell_id
                ).first()
                if not stock_to:
                    stock_to = Stock(
                        product_id=item.product_id,
                        cell_id=item.to_cell_id,
                        quantity=0
                    )
                    db.add(stock_to)
                    db.flush()
                stock_to.quantity += item.quantity
                
        elif doc_type == "adjust":
            stock = db.query(Stock).filter(
                Stock.product_id == item.product_id,
                Stock.cell_id == item.to_cell_id
            ).first()
            if not stock:
                stock = Stock(
                    product_id=item.product_id,
                    cell_id=item.to_cell_id,
                    quantity=0
                )
                db.add(stock)
                db.flush()
            stock.quantity += item.quantity


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, db: Session = Depends(get_db), current_user: User = require_worker):
    try:
        if not data.items:
            raise HTTPException(400, "Добавьте хотя бы одну позицию")
        
        # 🔧 ПРОВЕРКА ОСТАТКОВ ПЕРЕД СОЗДАНИЕМ ЗАКАЗА
        for item in data.items:
            # Считаем общий остаток по всем ячейкам для этого товара
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
            status=OrderStatus.PENDING,
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
        joinedload(Order.items)
    ).order_by(Order.created_at.desc()).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = require_worker):
    order = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(404, "Заказ не найден")
    
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(404, "Заказ не найден")
        
        old_status = order.status
        
        if old_status != data.status:
            log_action(
                db=db,
                user=current_user,
                action="STATUS_CHANGE",
                entity_type="order",
                entity_id=order_id,
                old_value={"status": str(old_status)},
                new_value={"status": str(data.status)}
            )
        
        # 🔧 ЛОГИКА ОТМЕНЫ (ВОЗВРАТ ОСТАТКОВ)
        if data.status == OrderStatus.CANCELLED and order.shipment_doc_id:
            shipment_doc = db.query(WarehouseDocument).get(order.shipment_doc_id)
            
            if shipment_doc and shipment_doc.status != DocStatus.CANCELLED:
                for item in shipment_doc.items:
                    stock = db.query(Stock).filter(
                        Stock.product_id == item.product_id,
                        Stock.cell_id == item.from_cell_id
                    ).first()
                    
                    if stock:
                        stock.quantity += item.quantity
                    else:
                        stock = Stock(
                            product_id=item.product_id,
                            cell_id=item.from_cell_id,
                            quantity=item.quantity
                        )
                        db.add(stock)
                
                shipment_doc.status = DocStatus.CANCELLED
                order.shipment_doc_id = None
                
                log_action(db, current_user, "CANCEL_SHIPMENT", "order", order_id,
                           new_value={"returned_to_stock": True, "doc_id": shipment_doc.id})

        order.status = data.status
        if data.comment:
            order.comment = data.comment
        
        # 🔧 АВТО-ОТГРУЗКА (списываем остатки только при смене статуса на "Отгружен")
        if data.status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED] and not order.shipment_doc_id:
            import uuid
            doc = WarehouseDocument(
                doc_number=f"SHP-{uuid.uuid4().hex[:8].upper()}",
                type=DocType.SHIP,
                operator_id=current_user.id,
                comment=f"Авто-отгрузка для заказа {order.order_number}",
                status=DocStatus.COMPLETED
            )
            db.add(doc)
            db.flush()
            
            order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
            for item in order_items:
                # 🔧 Ищем остаток в первой доступной ячейке
                stock = db.query(Stock).filter(
                    Stock.product_id == item.product_id,
                    Stock.quantity > 0
                ).order_by(Stock.quantity.desc()).first()
                
                from_cell = stock.cell_id if stock else None
                
                # 🔧 Списываем остатки только если есть что списывать
                if stock and stock.quantity >= item.quantity:
                    stock.quantity -= item.quantity
                elif stock:
                    # Если товара меньше чем нужно — списываем что есть
                    stock.quantity = 0
                # Если товара вообще нет — документ создаётся, но остаток не меняется (ошибка данных)
                
                db.add(DocumentItem(
                    doc_id=doc.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    from_cell_id=from_cell,
                    to_cell_id=None
                ))
            
            order.shipment_doc_id = doc.id
            log_action(db, current_user, "AUTO_SHIP", "order", order_id,
                       new_value={"shipment_doc_id": doc.id})
        
        db.commit()
        db.refresh(order)
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 UPDATE STATUS ERROR: {str(e)}")
        raise HTTPException(500, str(e))