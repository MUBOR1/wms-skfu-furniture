from pydantic import BaseModel, ConfigDict
from typing import Optional
from models.user import UserRole

class UserCreate(BaseModel):
    login: str
    password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.WAREHOUSE_WORKER  # ← НОВОЕ

class UserLogin(BaseModel):
    login: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    login: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    model_config = ConfigDict(from_attributes=True)