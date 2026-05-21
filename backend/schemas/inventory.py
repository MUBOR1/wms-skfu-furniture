from pydantic import BaseModel, ConfigDict
from typing import Optional, List
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
    created_at: Optional[str]
    model_config = ConfigDict(from_attributes=True)

class StockReportItem(BaseModel):
    product_sku: str
    product_name: str
    quantity: int
    model_config = ConfigDict(from_attributes=True)