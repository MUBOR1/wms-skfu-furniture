from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from core.permissions import require_manager, require_worker
from core.audit import log_action
from models.user import User
from models.inventory import Inventory, InventoryRecord, InvStatus
from models.stock import Stock
from models.product import Product
from schemas.inventory import InventoryCreate, InventoryResponse, InventoryRecordCreate, InventoryRecordResponse
from routers.notifications import create_notification
from typing import List, Optional
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/inventory", tags=["Инвентаризация"])

@router.post("/", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
def create_inventory(
    data: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Создать новую инвентаризацию"""
    try:
        doc_number = data.doc_number or f"INV-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}"
        
        inventory = Inventory(
            doc_number=doc_number,
            operator_id=current_user.id,
            status=InvStatus.DRAFT,
            category=data.category,
            comment=data.comment
        )
        
        db.add(inventory)
        db.commit()
        db.refresh(inventory)
        
        log_action(db, current_user, "CREATE", "inventory", inventory.id,
                   new_value={"doc_number": inventory.doc_number, "status": "draft"})
        
        # УВЕДОМЛЕНИЕ
        managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
        for manager in managers:
            create_notification(
                db=db,
                user_id=manager.id,
                type="system",
                title="📊 Новая инвентаризация",
                message=f"Создана инвентаризация {inventory.doc_number}",
                link="/inventory"
            )
        
        return inventory
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))


@router.get("/", response_model=List[InventoryResponse])
def list_inventories(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    """Список инвентаризаций"""
    query = db.query(Inventory)
    
    if status:
        query = query.filter(Inventory.status == status)
    if category:
        query = query.filter(Inventory.category == category)
    
    return query.order_by(Inventory.created_at.desc()).all()


@router.get("/{inv_id}", response_model=InventoryResponse)
def get_inventory(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    """Получить инвентаризацию по ID"""
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Инвентаризация не найдена")
    
    records = db.query(InventoryRecord).filter(
        InventoryRecord.inventory_id == inv_id
    ).all()
    
    result = {
        "id": inv.id,
        "doc_number": inv.doc_number,
        "status": inv.status,
        "operator_id": inv.operator_id,
        "category": inv.category,
        "comment": inv.comment,
        "created_at": inv.created_at,
        "completed_at": inv.completed_at,
        "records": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "cell_id": r.cell_id,
                "planned_qty": r.planned_qty,
                "actual_qty": r.actual_qty,
                "diff": r.diff,
                "comment": r.comment
            }
            for r in records
        ]
    }
    
    return result


@router.post("/{inv_id}/records")
def add_inventory_record(
    inv_id: int,
    data: InventoryRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    """Добавить запись в инвентаризацию"""
    try:
        print(f"🔍 Добавление записи в инвентаризацию {inv_id}")
        print(f"🔍 Данные: product_id={data.product_id}, actual_qty={data.actual_qty}")
        
        inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
        if not inv:
            raise HTTPException(404, "Инвентаризация не найдена")
        
        if inv.status != InvStatus.DRAFT:
            raise HTTPException(400, "Нельзя добавлять записи в завершённую инвентаризацию")
        
        product = db.query(Product).filter(Product.id == data.product_id).first()
        if not product:
            raise HTTPException(404, f"Товар #{data.product_id} не найден")
        
        # Получаем системное количество (сумма по всем ячейкам)
        system_qty = db.query(func.coalesce(func.sum(Stock.quantity), 0)).filter(
            Stock.product_id == data.product_id
        ).scalar() or 0
        
        print(f"🔍 Системное количество: {system_qty}")
        
        # Проверяем, есть ли уже запись для этого товара
        existing = db.query(InventoryRecord).filter(
            InventoryRecord.inventory_id == inv_id,
            InventoryRecord.product_id == data.product_id
        ).first()
        
        if existing:
            print(f"🔍 Обновляем существующую запись")
            existing.planned_qty = system_qty
            existing.actual_qty = data.actual_qty
            existing.diff = data.actual_qty - system_qty
            existing.comment = data.comment
            existing.cell_id = data.cell_id
            record = existing
        else:
            print(f"🔍 Создаём новую запись")
            record = InventoryRecord(
                inventory_id=inv_id,
                product_id=data.product_id,
                cell_id=data.cell_id,
                planned_qty=system_qty,
                actual_qty=data.actual_qty,
                diff=data.actual_qty - system_qty,
                comment=data.comment
            )
            db.add(record)
        
        # 🔥 ВАЖНО: СОХРАНЯЕМ В БД!
        db.commit()
        db.refresh(record)
        
        print(f"✅ Запись сохранена: id={record.id}, planned={record.planned_qty}, actual={record.actual_qty}, diff={record.diff}")
        
        # УВЕДОМЛЕНИЕ
        managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
        for manager in managers:
            create_notification(
                db=db,
                user_id=manager.id,
                type="system",
                title="📝 Запись в инвентаризации",
                message=f"Добавлена запись для товара '{product.name}' в инвентаризацию {inv.doc_number}",
                link=f"/inventory/{inv_id}"
            )
        
        return record
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 ОШИБКА ПРИ ДОБАВЛЕНИИ ЗАПИСИ: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.post("/{inv_id}/complete", response_model=InventoryResponse)
def complete_inventory(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Завершить инвентаризацию и применить изменения ко всем ячейкам"""
    try:
        inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
        if not inv:
            raise HTTPException(404, "Инвентаризация не найдена")
        
        if inv.status != InvStatus.DRAFT:
            raise HTTPException(400, "Инвентаризация уже завершена")
        
        records = db.query(InventoryRecord).filter(
            InventoryRecord.inventory_id == inv_id
        ).all()
        
        print(f"🔍 Найдено записей: {len(records)}")
        
        if not records:
            raise HTTPException(400, "Нельзя завершить пустую инвентаризацию")
        
        updated_products = []
        
        for record in records:
            product = db.query(Product).filter(Product.id == record.product_id).first()
            if not product:
                continue
            
            # Находим все записи стока для этого товара (по всем ячейкам)
            stocks = db.query(Stock).filter(Stock.product_id == record.product_id).all()
            
            print(f"🔍 Товар {product.name}: stocks={len(stocks)}, planned={record.planned_qty}, actual={record.actual_qty}")
            
            if stocks:
                total_quantity = sum(s.quantity for s in stocks)
                diff = record.actual_qty - record.planned_qty
                
                # Распределяем изменение по всем ячейкам
                if diff > 0:
                    stocks[0].quantity += diff
                elif diff < 0:
                    remaining = abs(diff)
                    for stock in stocks:
                        if remaining <= 0:
                            break
                        if stock.quantity >= remaining:
                            stock.quantity -= remaining
                            remaining = 0
                        else:
                            remaining -= stock.quantity
                            stock.quantity = 0
                    
                    if remaining > 0:
                        admins = db.query(User).filter(User.role == 'admin').all()
                        for admin in admins:
                            create_notification(
                                db=db,
                                user_id=admin.id,
                                type="alert",
                                title="⚠️ Ошибка инвентаризации",
                                message=f"Товар '{product.name}': не хватает остатков для списания (не хватает {remaining})",
                                link="/inventory"
                            )
                
                new_total = sum(s.quantity for s in stocks)
                updated_products.append({
                    "name": product.name,
                    "old_qty": total_quantity,
                    "new_qty": new_total,
                    "diff": diff
                })
                
                print(f"✅ Товар {product.name}: система={record.planned_qty}, факт={record.actual_qty}, diff={diff}, новый остаток={new_total}")
            else:
                if record.actual_qty > 0:
                    stock = Stock(
                        product_id=record.product_id,
                        quantity=record.actual_qty,
                        cell_id=record.cell_id or 1
                    )
                    db.add(stock)
                    updated_products.append({
                        "name": product.name,
                        "old_qty": 0,
                        "new_qty": record.actual_qty,
                        "diff": record.actual_qty
                    })
        
        # Обновляем статус инвентаризации
        inv.status = InvStatus.COMPLETED
        inv.completed_at = datetime.now()
        
        log_action(
            db=db,
            user=current_user,
            action="COMPLETE",
            entity_type="inventory",
            entity_id=inv_id,
            old_value={"status": "draft"},
            new_value={"status": "completed", "records": len(records)}
        )
        
        db.commit()
        db.refresh(inv)
        
        # УВЕДОМЛЕНИЕ О ЗАВЕРШЕНИИ
        managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
        for manager in managers:
            create_notification(
                db=db,
                user_id=manager.id,
                type="system",
                title="✅ Инвентаризация завершена",
                message=f"Инвентаризация {inv.doc_number} завершена. Обновлено {len(updated_products)} товаров",
                link="/inventory"
            )
        
        # УВЕДОМЛЕНИЯ ОБ ИЗМЕНЕНИЯХ
        if updated_products:
            for p in updated_products[:3]:
                admins = db.query(User).filter(User.role == 'admin').all()
                for admin in admins:
                    create_notification(
                        db=db,
                        user_id=admin.id,
                        type="system",
                        title=f"📦 Изменён остаток: {p['name']}",
                        message=f"Было: {p['old_qty']}, Стало: {p['new_qty']}, Изменение: {p['diff']:+d}",
                        link="/report"
                    )
        
        return inv
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 ОШИБКА ЗАВЕРШЕНИЯ ИНВЕНТАРИЗАЦИИ: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.delete("/{inv_id}")
def delete_inventory(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    """Удалить инвентаризацию (только черновик)"""
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Инвентаризация не найдена")
    
    if inv.status != InvStatus.DRAFT:
        raise HTTPException(400, "Можно удалить только черновик")
    
    db.query(InventoryRecord).filter(InventoryRecord.inventory_id == inv_id).delete()
    db.delete(inv)
    db.commit()
    
    log_action(db, current_user, "DELETE", "inventory", inv_id,
               new_value={"doc_number": inv.doc_number})
    
    return {"message": "Инвентаризация удалена"}


@router.get("/{inv_id}/records")
def get_inventory_records(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    """Получить записи инвентаризации"""
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Инвентаризация не найдена")
    
    records = db.query(
        InventoryRecord,
        Product.name.label('product_name'),
        Product.sku.label('product_sku')
    ).join(
        Product, Product.id == InventoryRecord.product_id
    ).filter(
        InventoryRecord.inventory_id == inv_id
    ).all()
    
    result = []
    for record, product_name, product_sku in records:
        result.append({
            "id": record.id,
            "product_id": record.product_id,
            "product_name": product_name,
            "product_sku": product_sku,
            "planned_qty": record.planned_qty,
            "actual_qty": record.actual_qty,
            "diff": record.diff,
            "comment": record.comment
        })
    
    return result