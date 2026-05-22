from pydantic import BaseModel, Field
from typing import Optional, List
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
    
    class Config:
        from_attributes = True