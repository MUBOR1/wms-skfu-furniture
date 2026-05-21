from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from models.document import DocType, DocStatus

class DocumentItemCreate(BaseModel):
    product_id: int
    quantity: int
    from_cell_id: Optional[int] = None
    to_cell_id: Optional[int] = None

class DocumentCreate(BaseModel):
    doc_number: str
    type: DocType
    comment: Optional[str] = None
    items: List[DocumentItemCreate]

class DocumentResponse(BaseModel):
    id: int
    doc_number: str
    type: DocType
    status: DocStatus
    created_at: Optional[str]
    comment: Optional[str]
    model_config = ConfigDict(from_attributes=True)