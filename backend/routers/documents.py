from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from core.permissions import require_manager, require_worker
from models.user import User, UserRole
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from models.stock import Stock
from schemas.documents import DocumentCreate, DocumentResponse
import uuid
import traceback

router = APIRouter(prefix="/api/documents", tags=["Складские операции"])

# === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ===
def _update_stock(db: Session, product_id: int, delta: int):
    """Атомарное обновление остатков товара"""
    stock = db.query(Stock).filter(Stock.product_id == product_id).first()
    if not stock:
        stock = Stock(product_id=product_id, quantity=0)
        db.add(stock)
        db.flush()
    
    stock.quantity += delta
    if stock.quantity < 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Недостаточно остатков для товара ID {product_id}"
        )

# === СОЗДАНИЕ ДОКУМЕНТА (только менеджер/админ) ===
@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    data: DocumentCreate, 
    db: Session = Depends(get_db), 
    current_user: User = require_manager
):
    try:
        if not data.items:
            raise HTTPException(status_code=400, detail="Добавьте хотя бы одну позицию")
            
        raw_num = data.doc_number.strip() if data.doc_number else ""
        doc_number = raw_num if raw_num else f"DOC-{uuid.uuid4().hex[:8].upper()}"
        
        doc = WarehouseDocument(
            doc_number=doc_number,
            type=data.type.value if hasattr(data.type, 'value') else data.type,
            operator_id=current_user.id,
            comment=data.comment
        )
        db.add(doc)
        db.flush()

        for item in data.items:
            if not item.product_id:
                raise HTTPException(status_code=400, detail="Не указан товар в позиции")
            db_item = DocumentItem(
                doc_id=doc.id,
                product_id=item.product_id,
                quantity=item.quantity,
                from_cell_id=item.from_cell_id,
                to_cell_id=item.to_cell_id
            )
            db.add(db_item)

        db.commit()
        db.refresh(doc)
        return doc
        
    except IntegrityError as e:
        db.rollback()
        print(f"🔴 DB IntegrityError: {e}")
        raise HTTPException(status_code=400, detail="Документ с таким номером уже существует")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 CRITICAL SERVER ERROR:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# === ПРОВЕДЕНИЕ ДОКУМЕНТА (только менеджер/админ) ===
@router.post("/{doc_id}/complete", response_model=DocumentResponse)
def complete_document(
    doc_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = require_manager
):
    try:
        doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Документ не найден")
        if doc.status != DocStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Можно провести только документ в статусе ЧЕРНОВИК")

        items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc_id).all()
        if not items:
            raise HTTPException(status_code=400, detail="Документ пуст")
        
        for item in items:
            delta = 0
            doc_type = doc.type.value if hasattr(doc.type, 'value') else doc.type
            
            if doc_type == "receive":
                delta = item.quantity
            elif doc_type == "ship":
                delta = -item.quantity
            elif doc_type == "adjust":
                delta = item.quantity
            
            if delta != 0:
                _update_stock(db, item.product_id, delta)

        doc.status = DocStatus.COMPLETED
        db.commit()
        db.refresh(doc)
        return doc
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 COMPLETE ERROR:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# === ПРОСМОТР СПИСКА (доступно всем работникам) ===
@router.get("/", response_model=list[DocumentResponse])  # ← ПРАВИЛЬНЫЙ СИНТАКСИС: list[Schema]
def list_documents(
    db: Session = Depends(get_db), 
    current_user: User = require_worker
):
    return db.query(WarehouseDocument).order_by(WarehouseDocument.created_at.desc()).all()

# === ПОЛУЧЕНИЕ ОДНОГО ДОКУМЕНТА ===
@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = require_worker
):
    doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return doc