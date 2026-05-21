from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional, List
from datetime import datetime
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
    created_at: Optional[datetime]  # ← БЫЛО: str, СТАЛО: datetime
    comment: Optional[str]
    model_config = ConfigDict(from_attributes=True)
    
    # Сериализуем datetime в строку для JSON-ответа
    @field_serializer('created_at')
    def serialize_dt(self, value: datetime, _info):
        if value is None:
            return None
        return value.isoformat()