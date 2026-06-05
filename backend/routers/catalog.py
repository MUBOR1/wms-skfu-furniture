from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from core.permissions import require_worker, require_manager
from core.audit import log_action
from models.user import User
from models.zone import Zone
from models.cell import Cell
from models.product import Product
from schemas.catalog import (
    ZoneCreate, ZoneResponse,
    CellCreate, CellResponse,
    ProductCreate, ProductUpdate, ProductResponse
)
import csv, io, json

router = APIRouter(prefix="/api/catalog", tags=["Справочники склада"])

# === ЗОНЫ ===
@router.post("/zones", response_model=ZoneResponse)
def create_zone(data: ZoneCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    zone = Zone(**data.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone

@router.get("/zones", response_model=list[ZoneResponse])
def list_zones(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Zone).filter(Zone.is_active == True).all()

# === ЯЧЕЙКИ ===
@router.post("/cells", response_model=CellResponse)
def create_cell(data: CellCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cell = Cell(**data.model_dump())
    db.add(cell)
    db.commit()
    db.refresh(cell)
    return cell

@router.get("/cells", response_model=list[CellResponse])
def list_cells(zone_id: int = Query(None), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(Cell)
    if zone_id:
        query = query.filter(Cell.zone_id == zone_id)
    return query.all()

# === ТОВАРЫ ===
@router.post("/products", response_model=ProductResponse)
def create_product(data: ProductCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        # 1. Создаём объект
        product = Product(
            sku=data.sku,
            name=data.name,
            category=data.category,
            description=data.description,
            unit=data.unit,
            weight_kg=data.weight_kg,
            volume_m3=data.volume_m3,
            barcode=data.barcode,
            purchase_price=data.purchase_price,
            sale_price=data.sale_price,
            min_stock=data.min_stock,
            max_stock=data.max_stock
        )
        db.add(product)
        
        # 2. Flush отправляет данные в БД (появляется ID), но транзакция остаётся открытой
        db.flush()
        
        # 3. Логируем ДО коммита
        log_action(
            db=db,
            user=current_user,
            action="CREATE",
            entity_type="product",
            entity_id=product.id,
            new_value={"sku": product.sku, "name": product.name, "sale_price": float(product.sale_price or 0)}
        )
        
        # 4. Коммитим всё вместе: и товар, и лог
        db.commit()
        db.refresh(product)
        
        return product
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

@router.get("/products", response_model=list[ProductResponse])
def list_products(
    search: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    query = db.query(Product).filter(Product.is_active == True)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%"))
    return query.all()

@router.get("/products/export")
def export_products(db: Session = Depends(get_db), current_user: User = require_worker):
    products = db.query(Product).all()
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["sku", "name", "category", "weight_kg", "min_stock", "max_stock"])
    for p in products:
        writer.writerow([p.sku, p.name, p.category or "", p.weight_kg or 0, p.min_stock or 0, p.max_stock or 0])
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_export.csv"}
    )

@router.post("/products/import")
async def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = require_manager
):
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(400, "Поддерживаются только CSV файлы")
        
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    
    created, updated, errors = 0, 0, []
    
    for i, row in enumerate(reader, 2):
        try:
            sku = row.get("sku", "").strip()
            if not sku: raise ValueError("Отсутствует SKU")
            
            existing = db.query(Product).filter(Product.sku == sku).first()
            data = {
                "name": row.get("name", "Без имени"),
                "category": row.get("category"),
                "weight_kg": float(row.get("weight_kg", 0)),
                "min_stock": int(row.get("min_stock", 0)),
                "max_stock": int(row.get("max_stock", 0))
            }
            
            if existing:
                for k, v in data.items(): setattr(existing, k, v)
                updated += 1
            else:
                db.add(Product(sku=sku, **data))
                created += 1
        except Exception as e:
            errors.append(f"Строка {i} ({row.get('sku', '?')}): {str(e)}")
            
    if not errors:
        db.commit()
        return {"status": "success", "created": created, "updated": updated}
    db.rollback()
    return {"status": "errors", "created": created, "updated": updated, "errors": errors[:10]}

# === ФИЛЬТР ПО КАТЕГОРИЯМ ===
@router.get("/categories", response_model=list[str])
def get_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    categories = db.query(Product.category).filter(Product.is_active == True, Product.category.isnot(None)).distinct().all()
    return [c[0] for c in categories if c[0]]

# === РЕДАКТИРОВАНИЕ ТОВАРА ===
@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int, 
    data: ProductUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(404, detail="Товар не найден")
        
        # Сохраняем старые значения для лога
        old_value = {
            "name": product.name,
            "sku": product.sku,
            "sale_price": float(product.sale_price or 0)
        }
        
        # Обновляем поля
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(product, key, value)
            
        db.commit()
        db.refresh(product)
        
        log_action(
            db=db,
            user=current_user,
            action="UPDATE",
            entity_type="product",
            entity_id=product_id,
            old_value=old_value,
            new_value={"name": product.name, "sku": product.sku, "sale_price": float(product.sale_price or 0)}
        )
        return product
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# === УДАЛЕНИЕ ТОВАРА ===
@router.delete("/products/{product_id}")
def delete_product(
    product_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(404, detail="Товар не найден")
        
        # Мягкое удаление: ставим флаг is_active = False
        product.is_active = False
        db.commit()
        
        log_action(
            db=db,
            user=current_user,
            action="DELETE",
            entity_type="product",
            entity_id=product_id,
            new_value={"sku": product.sku, "name": product.name}
        )
        return {"message": "Товар удалён"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))