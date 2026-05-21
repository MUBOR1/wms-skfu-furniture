from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserCreate(BaseModel):
    login: str
    password: str
    full_name: Optional[str] = None

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
    role: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)