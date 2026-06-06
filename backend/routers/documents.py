from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from database import get_db
from core.permissions import require_manager, require_worker
from core.audit import log_action
from models.user import User
from models.document import WarehouseDocument, DocumentItem, DocStatus, DocType
from models.product import Product
from models.stock import Stock
from schemas.documents import DocumentCreate, DocumentResponse, DocumentItemCreate
import uuid

router = APIRouter(prefix="/api/documents", tags=["Складские документы"])

@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(data: DocumentCreate, db: Session = Depends(get_db), current_user: User = require_manager):
    try:
        if not data.items:
            raise HTTPException(400, "Добавьте хотя бы одну позицию")
        
        doc_number = data.doc_number.strip() if data.doc_number else f"DOC-{uuid.uuid4().hex[:8].upper()}"
        
        doc = WarehouseDocument(
            doc_number=doc_number,
            type=data.type,
            operator_id=current_user.id,
            comment=data.comment,
            status=DocStatus.DRAFT
        )
        
        db.add(doc)
        db.flush()  # Получаем doc.id
        
        for item in data.items:
            db.add(DocumentItem(
                doc_id=doc.id,
                product_id=item.product_id,
                quantity=item.quantity,
                from_cell_id=item.from_cell_id,
                to_cell_id=item.to_cell_id
            ))
        
        log_action(db, current_user, "CREATE", "document", doc.id, 
                   new_value={"doc_number": doc.doc_number, "type": doc.type, "status": "draft"})
        
        db.commit()
        db.refresh(doc)
        return doc
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Документ с таким номером уже существует")
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    
@router.get("/{doc_id}")
def get_document_details(doc_id: int, db: Session = Depends(get_db), user: User = require_worker):
    doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Документ не найден")
    
    # Загружаем позиции отдельно с товарами
    doc_items = db.query(DocumentItem).join(Product).filter(
        DocumentItem.doc_id == doc_id
    ).all()
    
    # Возвращаем документ + позиции с названиями товаров
    return {
        "id": doc.id,
        "doc_number": doc.doc_number,
        "type": doc.type,
        "status": doc.status,
        "created_at": doc.created_at,
        "comment": doc.comment,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else f"Товар #{item.product_id}",
                "product_sku": item.product.sku if item.product else None,
                "quantity": item.quantity,
                "from_cell_id": item.from_cell_id,
                "to_cell_id": item.to_cell_id
            }
            for item in doc_items
        ]
    }

@router.get("/", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db), current_user: User = require_worker):
    return db.query(WarehouseDocument).order_by(WarehouseDocument.created_at.desc()).all()

@router.post("/{doc_id}/complete", response_model=DocumentResponse)
def complete_document(doc_id: int, db: Session = Depends(get_db), current_user: User = require_manager):
    try:
        doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
        if not doc:
            raise HTTPException(404, "Документ не найден")
        if doc.status != DocStatus.DRAFT:
            raise HTTPException(400, "Можно провести только документ в статусе ЧЕРНОВИК")
        
        items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc_id).all()
        if not items:
            raise HTTPException(400, "Документ пуст")
        
        # Обрабатываем каждую позицию
        for item in items:
            product = db.query(Product).get(item.product_id)
            if not product:
                raise HTTPException(404, f"Товар {item.product_id} не найден")
            
            # Определяем тип операции
            doc_type = doc.type.value if hasattr(doc.type, 'value') else str(doc.type)
            
            if doc_type == "receive":
                # ПРИЁМКА: увеличиваем остаток
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
                # ОТГРУЗКА: уменьшаем остаток
                stock = db.query(Stock).filter(
                    Stock.product_id == item.product_id,
                    Stock.cell_id == item.from_cell_id
                ).first()
                
                if not stock or stock.quantity < item.quantity:
                    available = stock.quantity if stock else 0
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Недостаточно '{product.name}': доступно {available}, нужно {item.quantity}"
                    )
                
                stock.quantity -= item.quantity

            elif doc_type == "transfer":
                #  ПЕРЕМЕЩЕНИЕ: из ячейки A в ячейку B
                if not item.from_cell_id or not item.to_cell_id:
                    raise HTTPException(400, "Для перемещения укажите ячейки 'Откуда' и 'Куда'")
                
                if item.from_cell_id == item.to_cell_id:
                    raise HTTPException(400, "Ячейки 'Откуда' и 'Куда' не могут совпадать")

                # 1. Списываем из исходной ячейки
                stock_from = db.query(Stock).filter(
                    Stock.product_id == item.product_id,
                    Stock.cell_id == item.from_cell_id
                ).first()

                if not stock_from:
                    raise HTTPException(400, f"Товар не найден в ячейке {item.from_cell_id}. Сначала примите его на склад!")

                if not stock_from or stock_from.quantity < item.quantity:
                    available = stock_from.quantity if stock_from else 0
                    raise HTTPException(400, f"Недостаточно товара в ячейке {item.from_cell_id}: доступно {available}, нужно {item.quantity}")
                
                stock_from.quantity -= item.quantity

                # 2. Добавляем в целевую ячейку
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
                # ️ КОРРЕКТИРОВКА: + это приход, - это списание
                stock = db.query(Stock).filter(
                    Stock.product_id == item.product_id,
                    Stock.cell_id == item.to_cell_id
                ).first()

                if item.quantity > 0:
                    # Оприходование (добавляем)
                    if not stock:
                        stock = Stock(
                            product_id=item.product_id,
                            cell_id=item.to_cell_id,
                            quantity=0
                        )
                        db.add(stock)
                        db.flush()
                    stock.quantity += item.quantity
                    
                elif item.quantity < 0:
                    # Списание (вычитаем)
                    if not stock or stock.quantity < abs(item.quantity):
                        available = stock.quantity if stock else 0
                        raise HTTPException(400, f"Недостаточно товара для списания: доступно {available}, нужно списать {abs(item.quantity)}")
                    stock.quantity += item.quantity  # quantity отрицательное, поэтому += работает как вычитание
                else:
                    raise HTTPException(400, "Количество не может быть 0")
        
        # Меняем статус документа
        doc.status = DocStatus.COMPLETED
        db.commit()
        db.refresh(doc)
        
        # Логируем
        log_action(
            db=db,
            user=current_user,
            action="COMPLETE",
            entity_type="document",
            entity_id=doc_id,
            old_value={"status": "draft"},
            new_value={"status": "completed"}
        )
        
        return doc
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 COMPLETE ERROR:\n{str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# === РЕДАКТИРОВАНИЕ ДОКУМЕНТА ===
@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: int,
    data: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    try:
        doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
        if not doc:
            raise HTTPException(404, "Документ не найден")
        if doc.status != DocStatus.DRAFT:
            raise HTTPException(400, "Можно редактировать только черновики")
        
        # Обновляем основные поля
        doc.type = data.type
        doc.comment = data.comment
        
        # Удаляем старые позиции
        old_items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc_id).all()
        for item in old_items:
            db.delete(item)
        db.flush()
        
        # Добавляем новые позиции
        for item_data in data.items:
            db.add(DocumentItem(
                doc_id=doc.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                from_cell_id=item_data.from_cell_id,
                to_cell_id=item_data.to_cell_id
            ))
        
        log_action(db, current_user, "UPDATE", "document", doc_id,
                   new_value={"doc_number": doc.doc_number, "type": doc.type})
        
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# === УДАЛЕНИЕ ДОКУМЕНТА ===
@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    try:
        doc = db.query(WarehouseDocument).filter(WarehouseDocument.id == doc_id).first()
        if not doc:
            raise HTTPException(404, "Документ не найден")
        if doc.status != DocStatus.DRAFT:
            raise HTTPException(400, "Можно удалять только черновики")
        
        # Сначала удаляем позиции
        items = db.query(DocumentItem).filter(DocumentItem.doc_id == doc_id).all()
        for item in items:
            db.delete(item)
        
        # Затем сам документ
        db.delete(doc)
        
        log_action(db, current_user, "DELETE", "document", doc_id,
                   new_value={"doc_number": doc.doc_number})
        
        db.commit()
        return {"message": "Документ удалён"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))