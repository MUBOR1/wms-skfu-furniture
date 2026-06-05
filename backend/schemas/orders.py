from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from models.order import OrderStatus

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    total_price: float
    model_config = ConfigDict(from_attributes=True)

class OrderCreate(BaseModel):
    order_number: Optional[str] = None
    client_id: Optional[int] = None
    comment: Optional[str] = None
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    status: OrderStatus
    comment: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    order_number: str
    client_id: Optional[int]
    status: OrderStatus
    total_amount: float
    comment: Optional[str]
    created_at: datetime
    items: List[OrderItemResponse] = []
    shipment_doc_id: Optional[int] = None
    items: List[OrderItemResponse] = []
    model_config = ConfigDict(from_attributes=True)