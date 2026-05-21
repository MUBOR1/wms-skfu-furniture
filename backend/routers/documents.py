from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.user import User
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from models.stock import Stock
from schemas.documents import DocumentCreate, DocumentResponse
import uuid

router = APIRouter(prefix="/api/documents", tags=["Складские операции"])

def _update_stock(db: Session, product_id: int, delta: int):
    stock = db.query(Stock).filter(Stock.product_id == product_id).first()
    if not stock:
        stock = Stock(product_id=product_id, quantity=0)
        db.add(stock)
        db.flush()
    
    stock.quantity += delta
    if stock.quantity < 0:
        raise HTTPException(status_code=400, detail=f"Недостаточно остатков для товара ID {product_id}")

@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(data: DocumentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc_number = data.doc_number if data.doc_number else f"DOC-{uuid.uuid4().hex[:8].upper()}"
    
    doc = WarehouseDocument(
        doc_number=doc_number,
        type=data.type,
        operator_id=current_user.id,
        comment=data.comment
    )
    db.add(doc)
    db.flush()  # Получаем doc.id без коммита

    for item in data.items:
        db_item = DocumentItem(doc_id=doc.id, **item.model_dump())
        db.add(db_item)

    db.commit()
    db.refresh(doc)
    return doc

@router.post("/{doc_id}/complete", response_model=DocumentResponse)
def complete_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.status != DocStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Можно провести только документ в статусе DRAFT")

    items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc_id).all()
    
    for item in items:
        delta = 0
        if doc.type == DocType.RECEIVE:
            delta = item.quantity
        elif doc.type == DocType.SHIP:
            delta = -item.quantity
        elif doc.type == DocType.ADJUST:
            delta = item.quantity  # Корректировка: + или - в зависимости от знака quantity
        
        # MOVE не меняет общий остаток, только перераспределяет по ячейкам (упрощено для ВКР)
        if delta != 0:
            _update_stock(db, item.product_id, delta)

    doc.status = DocStatus.COMPLETED
    db.commit()
    db.refresh(doc)
    return doc

@router.get("/", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(WarehouseDocument).order_by(WarehouseDocument.created_at.desc()).all()