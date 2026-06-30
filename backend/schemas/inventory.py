from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional, List
from datetime import datetime
from models.inventory import InvStatus

class InventoryRecordCreate(BaseModel):
    product_id: int
    cell_id: Optional[int] = None
    actual_qty: int  # 🔥 Фактическое количество (вводит кладовщик)
    comment: Optional[str] = None

class InventoryCreate(BaseModel):
    doc_number: Optional[str] = None  # 🔥 СДЕЛАЛИ ОПЦИОНАЛЬНЫМ
    category: Optional[str] = None
    comment: Optional[str] = None
    records: Optional[List[InventoryRecordCreate]] = []  # 🔥 ОПЦИОНАЛЬНО

class InventoryRecordResponse(BaseModel):
    id: int
    product_id: int
    cell_id: Optional[int]
    planned_qty: int
    actual_qty: int
    diff: int
    comment: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)

class InventoryResponse(BaseModel):
    id: int
    doc_number: str
    status: InvStatus
    operator_id: Optional[int]
    category: Optional[str]
    comment: Optional[str]
    created_at: Optional[datetime]
    completed_at: Optional[datetime] = None  # 🔥 ДОБАВЛЯЕМ
    records: List[InventoryRecordResponse] = []  # 🔥 ДОБАВЛЯЕМ
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('created_at', 'completed_at')
    def serialize_dt(self, value: datetime, _info):
        if value is None:
            return None
        return value.isoformat()