from pydantic import BaseModel, ConfigDict
from typing import Optional

# --- Зоны ---
class ZoneCreate(BaseModel):
    code: str
    name: str
    type: str = "storage"
    capacity: int = 100

class ZoneResponse(BaseModel):
    id: int
    code: str
    name: str
    type: str
    capacity: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

# --- Ячейки ---
class CellCreate(BaseModel):
    zone_id: int
    code: str
    x: int = 0
    y: int = 0
    max_capacity: int = 10

class CellResponse(BaseModel):
    id: int
    zone_id: int
    code: str
    x: int
    y: int
    max_capacity: int
    status: str
    model_config = ConfigDict(from_attributes=True)

# --- Товары ---
class ProductCreate(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None
    unit: str = "шт"
    weight_kg: float = 0.0
    volume_m3: float = 0.0
    barcode: Optional[str] = None
    min_stock: int = 0
    max_stock: int = 1000

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    weight_kg: Optional[float] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None

class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    category: Optional[str]
    unit: str
    weight_kg: float
    volume_m3: float
    barcode: Optional[str]
    min_stock: int
    max_stock: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)