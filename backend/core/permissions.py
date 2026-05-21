from fastapi import Depends, HTTPException, status
from models.user import User, UserRole
from core.security import get_current_user

def require_role(*allowed_roles: UserRole):
    """Зависимость FastAPI для проверки роли пользователя"""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Доступ запрещён. Требуются роли: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker

# Готовые зависимости для импорта в роутерах
require_admin = Depends(require_role(UserRole.ADMIN))
require_manager = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER))
require_worker = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_WORKER))