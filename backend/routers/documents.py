from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from database import get_db
from core.security import get_current_user
from models.user import User
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from models.stock import Stock
from schemas.documents import DocumentCreate, DocumentResponse
import uuid
import traceback

router = APIRouter(prefix="/api/documents", tags=["Складские операции"])

def _update_stock(db: Session, product_id: int, delta: int):
    stock = db.query(Stock).filter(Stock.product_id == product_id).first()
    if not stock:
        stock = Stock(product_id=product_id, quantity=0)
        db.add(stock)
    stock.quantity += delta
    if stock.quantity < 0:
        raise HTTPException(status_code=400, detail=f"Недостаточно остатков для товара ID {product_id}")

@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(data: DocumentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        if not data.items:
            raise HTTPException(status_code=400, detail="Добавьте хотя бы одну позицию")
            
        # Безопасная генерация номера
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
            db.add(DocumentItem(
                doc_id=doc.id,
                product_id=item.product_id,
                quantity=item.quantity,
                from_cell_id=item.from_cell_id,
                to_cell_id=item.to_cell_id
            ))

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

@router.post("/{doc_id}/complete", response_model=DocumentResponse)
def complete_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    try:
        doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
        if not doc: raise HTTPException(404, "Документ не найден")
        if doc.status != DocStatus.DRAFT: raise HTTPException(400, "Можно провести только черновик")

        items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc_id).all()
        if not items: raise HTTPException(400, "Документ пуст")
        
        for item in items:
            delta = 0
            t = doc.type.value if hasattr(doc.type, 'value') else doc.type
            if t == "receive": delta = item.quantity
            elif t == "ship": delta = -item.quantity
            elif t == "adjust": delta = item.quantity
            
            if delta != 0: _update_stock(db, item.product_id, delta)

        doc.status = DocStatus.COMPLETED
        db.commit()
        db.refresh(doc)
        return doc
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        print(f"🔴 COMPLETE ERROR:\n{traceback.format_exc()}")
        raise HTTPException(500, str(e))

@router.get("/", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(WarehouseDocument).order_by(WarehouseDocument.created_at.desc()).all()