from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.user import User
from models.zone import Zone
from models.cell import Cell
from models.product import Product
from schemas.catalog import (
    ZoneCreate, ZoneResponse,
    CellCreate, CellResponse,
    ProductCreate, ProductUpdate, ProductResponse
)

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
def create_product(data: ProductCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

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