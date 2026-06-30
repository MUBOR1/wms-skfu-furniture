from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from models.order import OrderStatus

# 👇 ДОБАВЬ СХЕМУ ДЛЯ ПОЛЬЗОВАТЕЛЯ
class UserInOrder(BaseModel):
    id: int
    login: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class ProductInOrder(BaseModel):
    id: int
    sku: str
    name: str
    model_config = ConfigDict(from_attributes=True)

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    total_price: float
    product: Optional[ProductInOrder] = None
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
    client: Optional[UserInOrder] = None  # 👈 ДОБАВЛЯЕМ!
    status: OrderStatus
    total_amount: float
    comment: Optional[str]
    created_at: datetime
    shipment_doc_id: Optional[int] = None
    delivery_address: Optional[str] = None
    delivery_method: Optional[str] = None
    pickup_point_id: Optional[int] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    items: List[OrderItemResponse] = []
    model_config = ConfigDict(from_attributes=True)