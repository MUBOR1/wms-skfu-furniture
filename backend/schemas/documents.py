from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class DocType(str, Enum):
    RECEIVE = "receive"
    SHIP = "ship"
    ADJUST = "adjust"
    TRANSFER = "transfer"

class DocStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class DocumentItemCreate(BaseModel):
    product_id: int
    quantity: int
    from_cell_id: Optional[int] = None
    to_cell_id: Optional[int] = None

class DocumentCreate(BaseModel):
    doc_number: Optional[str] = None
    type: DocType
    comment: Optional[str] = None
    items: List[DocumentItemCreate]

class DocumentResponse(BaseModel):
    id: int
    doc_number: str
    type: str
    status: str
    operator_id: int
    comment: Optional[str] = None
    created_at: datetime  # ← Поле для даты
    
    # ✅ ТОЛЬКО model_config (старый class Config УДАЛЁН!)
    model_config = ConfigDict(from_attributes=True)