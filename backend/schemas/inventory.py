from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional, List
from datetime import datetime
from models.inventory import InvStatus

class InventoryRecordCreate(BaseModel):
    product_id: int
    cell_id: Optional[int] = None
    actual_qty: int

class InventoryCreate(BaseModel):
    doc_number: str
    records: List[InventoryRecordCreate]

class InventoryResponse(BaseModel):
    id: int
    doc_number: str
    status: InvStatus
    created_at: Optional[datetime]  # ← БЫЛО: str, СТАЛО: datetime
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('created_at')
    def serialize_dt(self, value: datetime, _info):
        if value is None:
            return None
        return value.isoformat()

class StockReportItem(BaseModel):
    product_sku: str
    product_name: str
    quantity: int
    model_config = ConfigDict(from_attributes=True)