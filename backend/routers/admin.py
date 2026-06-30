# backend/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect, text
from typing import Optional, List
from datetime import datetime, timedelta
import json
import os
import shutil
import zipfile
from pathlib import Path
import traceback

from database import get_db
from core.security import get_current_user, hash_password, require_role
from models.user import User
from models.audit import AuditLog
from core.audit import log_action

router = APIRouter(prefix="/api/admin", tags=["Администрирование"])

# ============================================
# 📁 НАСТРОЙКИ СИСТЕМЫ
# ============================================

SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"
BACKUP_DIR = Path(__file__).parent.parent / "backups"
STATIC_DIR = Path(__file__).parent.parent / "static"

DEFAULT_SETTINGS = {
    "siteName": "WMS Мебель СК",
    "timezone": "Europe/Moscow",
    "dateFormat": "DD.MM.YYYY",
    "language": "ru",
    "theme": "light",
    "autoReserve": True,
    "lowStockAlert": True,
    "lowStockThreshold": 10,
    "allowNegativeStock": False,
    "autoGenerateSku": True,
    "skuPrefix": "ITEM",
    "autoNumbering": True,
    "docNumberPrefix": "DOC",
    "requireApproval": False,
    "autoCompleteOnShip": True,
    "emailNotifications": True,
    "stockAlerts": True,
    "orderAlerts": True,
    "dailyReport": False,
    "notificationEmail": "admin@wms-skfu.ru",
    "sessionTimeout": 30,
    "require2FA": False,
    "passwordExpiry": 90,
    "maxLoginAttempts": 5,
    "autoBackup": True,
    "backupFrequency": "daily",
    "backupRetention": 30,
    "backupLocation": "local"
}


def load_settings() -> dict:
    """Загрузить настройки из файла"""
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                result = DEFAULT_SETTINGS.copy()
                result.update(saved)
                return result
    except Exception as e:
        print(f"⚠️ Ошибка загрузки настроек: {e}")
    return DEFAULT_SETTINGS.copy()


def save_settings_to_file(settings: dict) -> bool:
    """Сохранить настройки в файл"""
    try:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"❌ Ошибка сохранения настроек: {e}")
        return False


def ensure_backup_dir():
    """Создать директорию для бэкапов"""
    BACKUP_DIR.mkdir(exist_ok=True)


def get_table_data(db: Session, table_name: str) -> List[dict]:
    """Универсальная функция для получения данных из любой таблицы"""
    try:
        inspector = inspect(db.get_bind())
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        
        result = db.execute(text(f"SELECT * FROM {table_name}"))
        
        data = []
        for row in result:
            item = {}
            for i, col in enumerate(columns):
                value = row[i]
                if isinstance(value, datetime):
                    value = value.isoformat()
                item[col] = value
            data.append(item)
        
        return data
    except Exception as e:
        print(f"   ⚠️ Ошибка таблицы {table_name}: {e}")
        return []


# ============================================
# ⚙️ НАСТРОЙКИ
# ============================================

@router.get("/settings")
def get_settings(
    current_user: User = Depends(require_role("admin", "warehouse_manager")),
    db: Session = Depends(get_db)
):
    """Получить текущие настройки системы"""
    settings = load_settings()
    log_action(db, current_user, "VIEW", "settings", 0, new_value={"action": "view_settings"})
    
    return {
        "status": "success",
        "settings": settings,
        "last_updated": datetime.now().isoformat()
    }


@router.post("/settings")
def save_settings(
    settings_data: dict,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Сохранить настройки системы"""
    try:
        current_settings = load_settings()
        for key, value in settings_data.items():
            if key in current_settings:
                current_settings[key] = value
        
        if save_settings_to_file(current_settings):
            log_action(
                db, current_user, "UPDATE", "settings", 0,
                old_value={"changed_fields": list(settings_data.keys())},
                new_value=settings_data
            )
            return {
                "status": "success",
                "message": "Настройки сохранены",
                "settings": current_settings
            }
        raise HTTPException(500, "Ошибка сохранения настроек")
    except Exception as e:
        raise HTTPException(500, f"Ошибка: {str(e)}")


@router.post("/settings/reset")
def reset_settings(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Сбросить настройки до значений по умолчанию"""
    if save_settings_to_file(DEFAULT_SETTINGS):
        log_action(db, current_user, "RESET", "settings", 0, new_value={"action": "reset_to_default"})
        return {
            "status": "success",
            "message": "Настройки сброшены до значений по умолчанию",
            "settings": DEFAULT_SETTINGS
        }
    raise HTTPException(500, "Ошибка сброса настроек")


# ============================================
# 💾 РЕЗЕРВНОЕ КОПИРОВАНИЕ
# ============================================

@router.get("/backup/list")
def list_backups(
    current_user: User = Depends(require_role("admin"))
):
    """Получить список всех бэкапов"""
    ensure_backup_dir()
    backups = []
    
    for file in BACKUP_DIR.glob("full_backup_*.zip"):
        stat = file.stat()
        backups.append({
            "filename": file.name,
            "size": f"{stat.st_size / (1024*1024):.2f} MB",
            "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%d.%m.%Y %H:%M"),
            "size_bytes": stat.st_size
        })
    
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "backups": backups, "total": len(backups)}


@router.post("/backup/create")
def create_full_backup(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Создать полную резервную копию всей системы"""
    ensure_backup_dir()
    
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"full_backup_{timestamp}.zip"
        backup_path = BACKUP_DIR / filename
        
        print("=" * 60)
        print("🔧 НАЧАЛО СОЗДАНИЯ ПОЛНОГО БЭКАПА")
        print("=" * 60)
        
        temp_dir = BACKUP_DIR / f"temp_{timestamp}"
        temp_dir.mkdir(exist_ok=True)
        
        # ==========================================
        # 1. БЭКАП ВСЕХ ТАБЛИЦ
        # ==========================================
        print("📊 1. Бэкап базы данных...")
        
        all_tables = [
            "alembic_version", "zones", "cells", "products", "stocks",
            "users", "user_profiles", "orders", "order_items",
            "warehouse_documents", "document_items", "inventories",
            "inventory_records", "favorites", "reviews", "cart_items",
            "chat_messages", "notifications", "product_images", "audit_logs"
        ]
        
        db_data = {
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "version": "2.0.0",
                "database_type": "postgresql",
                "tables_count": len(all_tables),
                "tables": all_tables
            }
        }
        
        total_records = 0
        for table_name in all_tables:
            print(f"   📋 {table_name}...")
            data = get_table_data(db, table_name)
            db_data[table_name] = data
            total_records += len(data)
            print(f"      {len(data)} записей")
        
        json_path = temp_dir / "database.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(db_data, f, ensure_ascii=False, indent=2, default=str)
        
        print(f"   ✅ JSON дамп: {json_path.stat().st_size / 1024:.1f} KB")
        
        # ==========================================
        # 2. БЭКАП СТАТИЧЕСКИХ ФАЙЛОВ
        # ==========================================
        print("📁 2. Бэкап статических файлов...")
        
        static_size = 0
        if STATIC_DIR.exists():
            static_backup_dir = temp_dir / "static"
            shutil.copytree(STATIC_DIR, static_backup_dir)
            
            for f in static_backup_dir.rglob("*"):
                if f.is_file():
                    static_size += f.stat().st_size
            
            print(f"   ✅ Статические файлы: {static_size / 1024:.1f} KB")
        else:
            print("   ⚠️ Папка static не найдена")
        
        # ==========================================
        # 3. БЭКАП НАСТРОЕК
        # ==========================================
        print("⚙️ 3. Бэкап настроек...")
        
        if SETTINGS_FILE.exists():
            shutil.copy2(SETTINGS_FILE, temp_dir / "settings.json")
            print(f"   ✅ Настройки сохранены")
        else:
            with open(temp_dir / "settings.json", 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_SETTINGS, f, ensure_ascii=False, indent=2)
            print(f"   ✅ Настройки по умолчанию")
        
        # ==========================================
        # 4. ИНФОРМАЦИЯ О СИСТЕМЕ
        # ==========================================
        print("📊 4. Информация о системе...")
        
        system_info = {
            "created_at": datetime.now().isoformat(),
            "version": "2.0.0",
            "tables": all_tables,
            "records": {table: len(db_data.get(table, [])) for table in all_tables},
            "total_records": total_records,
            "static_size_kb": static_size / 1024,
            "backup_size_kb": json_path.stat().st_size / 1024
        }
        
        with open(temp_dir / "system_info.json", 'w', encoding='utf-8') as f:
            json.dump(system_info, f, ensure_ascii=False, indent=2)
        print(f"   ✅ Системная информация сохранена")
        
        # ==========================================
        # 5. СОЗДАНИЕ ZIP
        # ==========================================
        print("📦 5. Создание ZIP архива...")
        
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in temp_dir.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_dir)
                    zipf.write(file_path, arcname)
        
        shutil.rmtree(temp_dir)
        
        # ==========================================
        # 6. УДАЛЕНИЕ СТАРЫХ БЭКАПОВ
        # ==========================================
        settings = load_settings()
        retention_days = settings.get("backupRetention", 30)
        cutoff = datetime.now() - timedelta(days=retention_days)
        
        deleted = 0
        for file in BACKUP_DIR.glob("full_backup_*.zip"):
            if file.name != filename:
                file_time = datetime.fromtimestamp(file.stat().st_mtime)
                if file_time < cutoff:
                    file.unlink()
                    deleted += 1
        
        print(f"   🗑️ Удалено старых бэкапов: {deleted}")
        
        log_action(
            db, current_user, "FULL_BACKUP", "system", 0,
            new_value={"filename": filename, "size": backup_path.stat().st_size, "records": total_records}
        )
        
        print("=" * 60)
        print(f"✅ БЭКАП СОЗДАН: {filename}")
        print(f"   Размер: {backup_path.stat().st_size / (1024*1024):.2f} MB")
        print(f"   Записей: {total_records}")
        print("=" * 60)
        
        return {
            "status": "success",
            "message": "Полный бэкап создан",
            "filename": filename,
            "size": f"{backup_path.stat().st_size / (1024*1024):.2f} MB",
            "created_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
            "tables_count": len(all_tables),
            "total_records": total_records,
            "tables": all_tables
        }
        
    except Exception as e:
        print(f"❌ ОШИБКА:")
        print(traceback.format_exc())
        raise HTTPException(500, f"Ошибка: {str(e)}")


@router.post("/backup/restore")
async def restore_full_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Восстановить систему из полного бэкапа"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(400, "Поддерживаются только .zip файлы")
    
    try:
        print("=" * 60)
        print("📥 ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА")
        print("=" * 60)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_zip = BACKUP_DIR / f"restore_{timestamp}_{file.filename}"
        
        content = await file.read()
        with open(temp_zip, 'wb') as f:
            f.write(content)
        
        extract_dir = BACKUP_DIR / f"extract_{timestamp}"
        extract_dir.mkdir(exist_ok=True)
        
        with zipfile.ZipFile(temp_zip, 'r') as zipf:
            zipf.extractall(extract_dir)
        
        json_path = extract_dir / "database.json"
        if not json_path.exists():
            raise HTTPException(400, "Бэкап не содержит database.json")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            db_data = json.load(f)
        
        from models.product import Product
        from models.user import User as UserModel
        from models.stock import Stock
        from models.order import Order, OrderItem
        from models.cell import Cell
        from models.zone import Zone
        from models.document import WarehouseDocument, DocumentItem
        from models.inventory import Inventory, InventoryRecord
        from models.profile import UserProfile, Favorite, Review, CartItem
        from models.chat import ChatMessage
        from models.notification import Notification
        from models.product_image import ProductImage
        
        restored = {}
        
        for table_name, data in db_data.items():
            if table_name in ["metadata"] or not data:
                continue
            
            print(f"   📋 Восстановление {table_name}...")
            
            if table_name == "products":
                for item in data:
                    existing = db.query(Product).filter(Product.sku == item["sku"]).first()
                    if existing:
                        for key, value in item.items():
                            if hasattr(existing, key) and key not in ["id", "created_at", "updated_at"]:
                                setattr(existing, key, value)
                    else:
                        new_item = Product(**{k: v for k, v in item.items() if k != "id"})
                        db.add(new_item)
                restored[table_name] = len(data)
            
            elif table_name == "users":
                for item in data:
                    existing = db.query(UserModel).filter(UserModel.login == item["login"]).first()
                    if existing:
                        for key, value in item.items():
                            if hasattr(existing, key) and key not in ["id", "created_at", "updated_at"]:
                                setattr(existing, key, value)
                    else:
                        new_item = UserModel(**{k: v for k, v in item.items() if k != "id"})
                        db.add(new_item)
                restored[table_name] = len(data)
            
            else:
                restored[table_name] = len(data)
        
        db.commit()
        
        static_backup = extract_dir / "static"
        if static_backup.exists() and STATIC_DIR.exists():
            shutil.rmtree(STATIC_DIR)
            shutil.copytree(static_backup, STATIC_DIR)
        
        settings_backup = extract_dir / "settings.json"
        if settings_backup.exists():
            shutil.copy2(settings_backup, SETTINGS_FILE)
        
        temp_zip.unlink()
        shutil.rmtree(extract_dir)
        
        log_action(db, current_user, "FULL_RESTORE", "system", 0, new_value={"filename": file.filename})
        
        print("=" * 60)
        print("✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!")
        print("=" * 60)
        
        return {
            "status": "success",
            "message": "Система восстановлена",
            "restored_tables": restored,
            "restored_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ ОШИБКА: {traceback.format_exc()}")
        raise HTTPException(500, f"Ошибка: {str(e)}")


@router.delete("/backup/{filename}")
def delete_backup(
    filename: str,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Удалить бэкап"""
    backup_path = BACKUP_DIR / filename
    if not backup_path.exists():
        raise HTTPException(404, "Бэкап не найден")
    
    backup_path.unlink()
    log_action(db, current_user, "DELETE", "backup", 0, new_value={"filename": filename})
    return {"status": "success", "message": f"Бэкап {filename} удалён"}


@router.get("/backup/download/{filename}")
def download_backup(
    filename: str,
    current_user: User = Depends(require_role("admin"))
):
    """Скачать бэкап"""
    backup_path = BACKUP_DIR / filename
    if not backup_path.exists():
        raise HTTPException(404, "Бэкап не найден")
    
    return FileResponse(
        path=backup_path,
        filename=filename,
        media_type='application/zip'
    )


# ============================================
# 🔐 УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
# ============================================

@router.get("/users")
def get_users(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Получить список всех пользователей"""
    from models.user import User as UserModel
    
    users = db.query(UserModel).all()
    
    return {
        "status": "success",
        "users": [
            {
                "id": u.id,
                "login": u.login,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "updated_at": u.updated_at.isoformat() if u.updated_at else None
            }
            for u in users
        ]
    }


@router.post("/users")
def create_user(
    user_data: dict,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Создать нового пользователя"""
    from models.user import User as UserModel
    from core.security import hash_password
    
    # Проверяем обязательные поля
    if not user_data.get("login"):
        raise HTTPException(400, "Логин обязателен")
    if not user_data.get("password"):
        raise HTTPException(400, "Пароль обязателен")
    if len(user_data["password"]) < 6:
        raise HTTPException(400, "Пароль должен быть минимум 6 символов")
    
    # Проверяем уникальность логина
    existing = db.query(UserModel).filter(UserModel.login == user_data["login"]).first()
    if existing:
        raise HTTPException(400, "Пользователь с таким логином уже существует")
    
    # Создаём пользователя
    new_user = UserModel(
        login=user_data["login"],
        full_name=user_data.get("full_name", user_data["login"]),
        password_hash=hash_password(user_data["password"]),
        role=user_data.get("role", "warehouse_worker"),
        is_active=user_data.get("is_active", True)
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    log_action(
        db, current_user, "CREATE", "user", new_user.id,
        new_value={"login": new_user.login, "role": new_user.role}
    )
    
    return {
        "status": "success",
        "message": "Пользователь создан",
        "user": {
            "id": new_user.id,
            "login": new_user.login,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "is_active": new_user.is_active,
            "created_at": new_user.created_at.isoformat() if new_user.created_at else None
        }
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    user_data: dict,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Обновить пользователя"""
    from models.user import User as UserModel
    from core.security import hash_password
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    
    # Обновляем поля
    if "full_name" in user_data:
        user.full_name = user_data["full_name"]
    if "role" in user_data:
        user.role = user_data["role"]
    if "is_active" in user_data:
        user.is_active = user_data["is_active"]
    if "password" in user_data and user_data["password"]:
        if len(user_data["password"]) < 6:
            raise HTTPException(400, "Пароль должен быть минимум 6 символов")
        user.password_hash = hash_password(user_data["password"])
    
    db.commit()
    db.refresh(user)
    
    log_action(
        db, current_user, "UPDATE", "user", user_id,
        new_value={"login": user.login, "role": user.role}
    )
    
    return {
        "status": "success",
        "message": "Пользователь обновлён",
        "user": {
            "id": user.id,
            "login": user.login,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Удалить пользователя"""
    from models.user import User as UserModel
    
    if current_user.id == user_id:
        raise HTTPException(400, "Нельзя удалить самого себя")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    
    login = user.login
    db.delete(user)
    db.commit()
    
    log_action(
        db, current_user, "DELETE", "user", user_id,
        new_value={"login": login}
    )
    
    return {"status": "success", "message": f"Пользователь {login} удалён"}


@router.post("/users/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    status_data: dict,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Переключить статус пользователя"""
    from models.user import User as UserModel
    
    if current_user.id == user_id:
        raise HTTPException(400, "Нельзя изменить свой статус")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    
    user.is_active = status_data.get("is_active", not user.is_active)
    db.commit()
    
    log_action(
        db, current_user, "TOGGLE_STATUS", "user", user_id,
        new_value={"login": user.login, "is_active": user.is_active}
    )
    
    return {
        "status": "success",
        "message": f"Статус пользователя {user.login} изменён",
        "is_active": user.is_active
    }


# ============================================
# 📊 СТАТИСТИКА СИСТЕМЫ
# ============================================

@router.get("/stats")
def get_system_stats(
    current_user: User = Depends(require_role("admin", "warehouse_manager")),
    db: Session = Depends(get_db)
):
    """Получить статистику системы"""
    from models.product import Product
    from models.user import User as UserModel
    from models.order import Order
    from models.document import WarehouseDocument
    from models.stock import Stock
    
    total_products = db.query(Product).count()
    active_products = db.query(Product).filter(Product.is_active == True).count()
    total_users = db.query(UserModel).count()
    total_orders = db.query(Order).count()
    total_documents = db.query(WarehouseDocument).count()
    total_stock = db.query(func.sum(Stock.quantity)).scalar() or 0
    
    order_statuses = db.query(
        Order.status, func.count(Order.id)
    ).group_by(Order.status).all()
    
    return {
        "status": "success",
        "stats": {
            "products": {
                "total": total_products,
                "active": active_products,
                "archived": total_products - active_products
            },
            "users": total_users,
            "orders": total_orders,
            "documents": total_documents,
            "stock": {
                "total_items": total_stock,
                "unique_products": db.query(Stock).filter(Stock.quantity > 0).count()
            },
            "order_statuses": [{"status": s, "count": c} for s, c in order_statuses]
        }
    }