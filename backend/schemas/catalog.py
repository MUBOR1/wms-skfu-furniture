from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

# === ЗОНЫ ===
class ZoneCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    type: str = "storage"
    capacity: int = Field(default=100, ge=1)

class ZoneResponse(BaseModel):
    id: int
    code: str
    name: str
    type: str
    capacity: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

# === ЯЧЕЙКИ ===
class CellCreate(BaseModel):
    zone_id: int
    code: str = Field(..., min_length=2, max_length=20)
    x: int = 0
    y: int = 0
    max_capacity: int = Field(default=10, ge=1)

class CellResponse(BaseModel):
    id: int
    zone_id: int
    code: str
    x: int
    y: int
    max_capacity: int
    status: str = "available"
    model_config = ConfigDict(from_attributes=True)

# === ТОВАРЫ ===
class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=150)
    category: Optional[str] = None
    description: Optional[str] = None
    unit: str = "шт"
    weight_kg: float = Field(default=0.0, ge=0)
    volume_m3: float = Field(default=0.0, ge=0)
    barcode: Optional[str] = None
    
    # 💰 ЦЕНЫ (ДОБАВЛЕНО!)
    purchase_price: float = Field(default=0.0, ge=0)  # Цена закупки
    sale_price: float = Field(default=0.0, ge=0)       # Цена продажи
    
    # Управление остатками
    min_stock: int = Field(default=0, ge=0)
    max_stock: int = Field(default=1000, ge=1)

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    weight_kg: Optional[float] = None
    barcode: Optional[str] = None
    
    # 💰 ЦЕНЫ (ДОБАВЛЕНО!)
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None

class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    unit: str
    weight_kg: float
    volume_m3: float
    barcode: Optional[str] = None
    
    # 💰 ЦЕНЫ (ОБЯЗАТЕЛЬНО С ДЕФОЛТОМ!)
    purchase_price: float = 0.0
    sale_price: float = 0.0
    
    # Управление остатками
    min_stock: int
    max_stock: int
    is_active: bool = True
    
    # Вычисляемое поле: общий остаток по всем ячейкам
    total_quantity: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)