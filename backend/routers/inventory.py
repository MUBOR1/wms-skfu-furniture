from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_manager, require_worker
from core.audit import log_action
from models.user import User
from models.inventory import Inventory, InventoryRecord
from schemas.inventory import InventoryCreate, InventoryResponse, InventoryRecordCreate
from typing import List
import uuid

router = APIRouter(prefix="/api/inventory", tags=["Инвентаризация"])

@router.post("/", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
def create_inventory(
    data: InventoryCreate, 
    db: Session = Depends(get_db), 
    current_user: User = require_manager
):
    # 1. Берём данные из схемы
    inventory_data = data.model_dump(exclude_unset=True)
    
    # 2. Генерируем doc_number, если поле есть и не передано
    if 'doc_number' in inventory_data and not inventory_data.get('doc_number'):
        inventory_data['doc_number'] = f"INV-{uuid.uuid4().hex[:8].upper()}"
    
    # 3. Создаём объект и заполняем только существующие поля
    inventory = Inventory()
    for field, value in inventory_data.items():
        if hasattr(inventory, field):
            setattr(inventory, field, value)
    
    # 4. Устанавливаем дефолты
    if hasattr(inventory, 'status') and not inventory.status:
        inventory.status = "draft"
    if hasattr(inventory, 'operator_id') and current_user:
        inventory.operator_id = current_user.id
    
    db.add(inventory)
    db.flush()  # Получаем id

    # 5. Логируем
    log_action(
        db=db,
        user=current_user,
        action="CREATE",
        entity_type="inventory",
        entity_id=inventory.id,
        new_value={"doc_number": getattr(inventory, 'doc_number', None), "status": getattr(inventory, 'status', 'draft')}
    )

    db.commit()
    db.refresh(inventory)
    return inventory

@router.get("/", response_model=List[InventoryResponse])
def list_inventories(db: Session = Depends(get_db), current_user: User = require_worker):
    return db.query(Inventory).order_by(Inventory.created_at.desc()).all()

@router.get("/{inv_id}", response_model=InventoryResponse)
def get_inventory(inv_id: int, db: Session = Depends(get_db), current_user: User = require_worker):
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Инвентаризация не найдена")
    return inv

@router.post("/{inv_id}/records")
def add_inventory_record(
    inv_id: int,
    data: InventoryRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = require_worker
):
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Инвентаризация не найдена")
    
    current_status = getattr(inv, 'status', None)
    if current_status and current_status != "draft":
        raise HTTPException(400, "Нельзя добавлять записи в завершённую инвентаризацию")
    
    record = InventoryRecord(inventory_id=inv_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if hasattr(record, field):
            setattr(record, field, value)
    
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.post("/{inv_id}/complete", response_model=InventoryResponse)
def complete_inventory(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Инвентаризация не найдена")
    
    records = db.query(InventoryRecord).filter(InventoryRecord.inventory_id == inv_id).all()
    if not records:
        raise HTTPException(400, "Нельзя завершить пустую инвентаризацию")
    
    old_status = getattr(inv, 'status', 'unknown')
    
    if hasattr(inv, 'status'):
        inv.status = "completed"
    
    log_action(
        db=db,
        user=current_user,
        action="COMPLETE",
        entity_type="inventory",
        entity_id=inv_id,
        old_value={"status": old_status},
        new_value={"status": "completed"}
    )
    
    db.commit()
    db.refresh(inv)
    return inv