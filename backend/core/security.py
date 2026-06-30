# backend/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db, settings
from models.user import User

# ============================================
# 🔐 НАСТРОЙКИ
# ============================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ============================================
# 🔐 ФУНКЦИИ ХЕШИРОВАНИЯ
# ============================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверка пароля
    
    Args:
        plain_password: Обычный текст пароля
        hashed_password: Хешированный пароль из БД
        
    Returns:
        bool: True если пароль совпадает
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Хеширование пароля с помощью BCrypt
    
    Args:
        password: Обычный текст пароля
        
    Returns:
        str: Хешированный пароль
    """
    return pwd_context.hash(password)


# ✅ ДОБАВЛЯЕМ АЛИАС ДЛЯ СОВМЕСТИМОСТИ
def hash_password(password: str) -> str:
    """
    Алиас для get_password_hash (для совместимости с admin.py)
    """
    return get_password_hash(password)


# ============================================
# 🔐 JWT ТОКЕНЫ
# ============================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Создание JWT токена
    
    Args:
        data: Данные для токена (обычно {'sub': login})
        expires_delta: Время жизни токена (опционально)
        
    Returns:
        str: JWT токен
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Декодирование JWT токена
    
    Args:
        token: JWT токен
        
    Returns:
        dict: Данные из токена или None при ошибке
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# ============================================
# 🔐 ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
# ============================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Получение текущего пользователя из токена
    
    Args:
        token: JWT токен из заголовка Authorization
        db: Сессия БД
        
    Returns:
        User: Объект пользователя
        
    Raises:
        HTTPException: 401 если токен невалидный или пользователь не найден
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверные учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        login: str = payload.get("sub")
        if login is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.login == login).first()
    if user is None:
        raise credentials_exception
    
    # ✅ Проверяем, активен ли пользователь
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись заблокирована"
        )
    
    return user


# ============================================
# 🔐 ПОЛУЧЕНИЕ ТЕКУЩЕГО АКТИВНОГО ПОЛЬЗОВАТЕЛЯ (АЛИАС)
# ============================================

def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Получение текущего активного пользователя
    
    Args:
        current_user: Пользователь из get_current_user
        
    Returns:
        User: Активный пользователь
        
    Raises:
        HTTPException: 403 если пользователь неактивен
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись заблокирована"
        )
    return current_user


# ============================================
# 🔐 ПРОВЕРКА ПРАВ (ДЛЯ РОЛЕЙ)
# ============================================

def require_role(*allowed_roles: str):
    """
    Декоратор для проверки роли пользователя
    
    Args:
        allowed_roles: Список разрешённых ролей
        
    Returns:
        function: Декоратор
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Доступ запрещён. Требуются права: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker