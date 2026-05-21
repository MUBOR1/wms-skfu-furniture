from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.user import User
from models.inventory import Inventory, InventoryRecord, InvStatus
from models.stock import Stock
from models.document import WarehouseDocument, DocumentItem, DocType, DocStatus
from models.product import Product
from schemas.inventory import InventoryCreate, InventoryResponse, StockReportItem
import uuid

router = APIRouter(prefix="/api/inventory", tags=["Инвентаризация и Отчёты"])

@router.post("/", response_model=InventoryResponse, status_code=201)
def create_inventory(data: InventoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = Inventory(doc_number=data.doc_number, operator_id=current_user.id)
    db.add(inv)
    db.flush()

    for rec in data.records:
        # Плановый остаток берём из текущих данных склада
        stock = db.query(Stock).filter(Stock.product_id == rec.product_id).first()
        planned = stock.quantity if stock else 0
        db.add(InventoryRecord(
            inventory_id=inv.id,
            product_id=rec.product_id,
            cell_id=rec.cell_id,
            planned_qty=planned,
            actual_qty=rec.actual_qty,
            diff=rec.actual_qty - planned
        ))
    db.commit()
    db.refresh(inv)
    return inv

@router.post("/{inv_id}/complete", response_model=InventoryResponse)
def complete_inventory(inv_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
    if not inv or inv.status != InvStatus.DRAFT:
        raise HTTPException(400, "Можно завершить только инвентаризацию в статусе DRAFT")

    records = db.query(InventoryRecord).filter(InventoryRecord.inventory_id == inv_id).all()
    adj_items = []

    for rec in records:
        rec.diff = rec.actual_qty - rec.planned_qty
        if rec.diff != 0:
            adj_items.append({"product_id": rec.product_id, "quantity": rec.diff})

    # Применяем корректировки к Stock
    for item in adj_items:
        stock = db.query(Stock).filter(Stock.product_id == item["product_id"]).first()
        if not stock:
            stock = Stock(product_id=item["product_id"], quantity=0)
            db.add(stock)
            db.flush()
        stock.quantity += item["quantity"]

    # Создаём документ-корректировку для аудита
    if adj_items:
        doc = WarehouseDocument(
            doc_number=f"ADJ-{uuid.uuid4().hex[:8].upper()}",
            type=DocType.ADJUST,
            status=DocStatus.COMPLETED,
            operator_id=inv.operator_id,
            comment=f"Авто-корректировка по инвентаризации {inv.doc_number}"
        )
        db.add(doc)
        db.flush()
        for ai in adj_items:
            db.add(DocumentItem(doc_id=doc.id, product_id=ai["product_id"], quantity=ai["quantity"]))

    inv.status = InvStatus.COMPLETED
    db.commit()
    db.refresh(inv)
    return inv

@router.get("/report/stock", response_model=list[StockReportItem])
def get_stock_report(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Stock.quantity, Product.sku, Product.name).join(Product).all()
    return [StockReportItem(product_sku=s, product_name=n, quantity=q) for q, s, n in rows]