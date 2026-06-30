# routers/client.py
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from database import get_db
from core.security import get_current_user
from models.user import User
from models.product import Product
from models.stock import Stock
from models.order import Order, OrderItem, OrderStatus
from models.profile import UserProfile, Favorite, Review, CartItem
from models.product_image import ProductImage  # 👈 ДОБАВЛЯЕМ
from routers.notifications import create_notification
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json
import os
from fastapi import UploadFile, File

router = APIRouter(prefix="/api/client", tags=["Клиентская часть"])

# === СХЕМЫ ===
class ProductFilter(BaseModel):
    category: Optional[str] = None
    search: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    in_stock: bool = False
    sort: str = "popular"
    page: int = 1
    limit: int = 20

class ProductDetailResponse(BaseModel):
    id: int
    sku: str
    name: str
    category: Optional[str]
    description: Optional[str]
    sale_price: float
    purchase_price: Optional[float]
    quantity: int
    min_stock: int
    max_stock: int
    is_active: bool
    images: List[str] = []
    rating: float = 0
    reviews_count: int = 0
    
    class Config:
        from_attributes = True

class ReviewCreate(BaseModel):
    product_id: int
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = None
    order_id: Optional[int] = None

class CartItemAdd(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, default=1)
    variant: Optional[str] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

# === ГЛАВНАЯ СТРАНИЦА ===
@router.get("/homepage")
def get_homepage_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Данные для главной страницы"""
    
    categories = db.query(Product.category, func.count(Product.id)).filter(
        Product.is_active == True, Product.category.isnot(None)
    ).group_by(Product.category).all()

    popular = db.query(Product).join(OrderItem).join(Order).filter(
        Order.status != 'cancelled', Product.is_active == True
    ).group_by(Product.id).order_by(func.count(OrderItem.id).desc()).limit(10).all()

    new_products = db.query(Product).filter(
        Product.is_active == True
    ).order_by(Product.created_at.desc()).limit(10).all()

    def get_qty(prod):
        return db.query(func.coalesce(func.sum(Stock.quantity), 0)).filter(
            Stock.product_id == prod.id
        ).scalar() or 0

    return {
        "categories": [{"name": c[0], "count": c[1]} for c in categories if c[0]],
        "popular": [{
            "id": p.id, "sku": p.sku, "name": p.name, "category": p.category,
            "sale_price": float(p.sale_price or 0), "quantity": get_qty(p)
        } for p in popular],
        "new": [{
            "id": p.id, "sku": p.sku, "name": p.name, "category": p.category,
            "sale_price": float(p.sale_price or 0), "quantity": get_qty(p)
        } for p in new_products]
    }

# === КАТАЛОГ ===
@router.get("/catalog")
def get_catalog(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    in_stock: bool = Query(False),
    sort: str = Query("popular"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Каталог товаров с фото"""
    
    query = db.query(
        Product,
        func.coalesce(func.sum(Stock.quantity), 0).label('total_qty')
    ).outerjoin(
        Stock, Stock.product_id == Product.id
    ).filter(
        Product.is_active == True
    ).group_by(Product.id)
    
    if category:
        query = query.filter(Product.category == category)
    
    if search:
        query = query.filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
                Product.category.ilike(f"%{search}%")
            )
        )
    
    if min_price is not None:
        query = query.filter(Product.sale_price >= min_price)
    
    if max_price is not None:
        query = query.filter(Product.sale_price <= max_price)
    
    if in_stock:
        query = query.having(func.coalesce(func.sum(Stock.quantity), 0) > 0)
    
    if sort == "price_asc":
        query = query.order_by(Product.sale_price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.sale_price.desc())
    elif sort == "new":
        query = query.order_by(Product.created_at.desc())
    elif sort == "popular":
        query = query.outerjoin(OrderItem, OrderItem.product_id == Product.id).group_by(Product.id).order_by(func.count(OrderItem.id).desc())
    
    total = query.count()
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()
    
    products = []
    for product, total_qty in results:
        reviews = db.query(Review).filter(Review.product_id == product.id).all()
        avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else 0
        
        # 🔥 ПОЛУЧАЕМ ФОТО ТОВАРА
        images = db.query(ProductImage).filter(
            ProductImage.product_id == product.id
        ).order_by(ProductImage.is_main.desc(), ProductImage.order.asc()).all()
        image_urls = [img.image_url for img in images]
        
        products.append({
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "category": product.category,
            "description": product.description,
            "sale_price": float(product.sale_price or 0),
            "purchase_price": float(product.purchase_price or 0) if product.purchase_price else None,
            "quantity": total_qty or 0,
            "min_stock": product.min_stock,
            "max_stock": product.max_stock,
            "is_active": product.is_active,
            "rating": round(avg_rating, 1),
            "reviews_count": len(reviews),
            "images": image_urls  # 👈 ДОБАВЛЯЕМ ФОТО В КАТАЛОГ
        })
    
    return {
        "products": products,
        "total": total,  
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# === ДЕТАЛИ ТОВАРА ===
@router.get("/products/{product_id}")
def get_product_detail(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Детали товара с фото и отзывами"""
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(404, "Товар не найден")
    
    total_qty = db.query(func.coalesce(func.sum(Stock.quantity), 0)).filter(
        Stock.product_id == product_id
    ).scalar() or 0
    
    # 🔥 ПОЛУЧАЕМ ФОТО ТОВАРА
    images = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.is_main.desc(), ProductImage.order.asc()).all()
    image_urls = [img.image_url for img in images]
    
    # 🔥 СЧИТАЕМ ОТЗЫВЫ
    reviews = db.query(Review).filter(Review.product_id == product_id).all()
    reviews_count = len(reviews)
    avg_rating = sum(r.rating for r in reviews) / reviews_count if reviews_count > 0 else 0
    
    return ProductDetailResponse(
        id=product.id, 
        sku=product.sku, 
        name=product.name,
        category=product.category, 
        description=product.description,
        sale_price=float(product.sale_price or 0),
        purchase_price=float(product.purchase_price or 0) if product.purchase_price else None,
        quantity=total_qty, 
        min_stock=product.min_stock, 
        max_stock=product.max_stock,
        is_active=product.is_active,
        rating=round(avg_rating, 1),
        reviews_count=reviews_count,
        images=image_urls  # 👈 ДОБАВЛЯЕМ ФОТО
    )

# === ИЗБРАННОЕ ===
@router.get("/favorites")
def get_favorites(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Список избранных товаров с остатками"""
    favorites = db.query(Favorite).filter(
        Favorite.user_id == current_user.id
    ).order_by(Favorite.created_at.desc()).all()
    
    product_ids = [f.product_id for f in favorites]
    if not product_ids:
        return []

    query = db.query(
        Product,
        func.coalesce(func.sum(Stock.quantity), 0).label('stock_qty')
    ).outerjoin(
        Stock, Stock.product_id == Product.id
    ).filter(
        Product.id.in_(product_ids),
        Product.is_active == True
    ).group_by(Product.id)

    products_with_stock = query.all()
    
    result = []
    for product, qty in products_with_stock:
        result.append({
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "category": product.category,
            "sale_price": float(product.sale_price or 0),
            "quantity": qty or 0
        })
    return result

@router.post("/favorites/{product_id}")
def toggle_favorite(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Добавить/удалить из избранного"""
    try:
        existing = db.query(Favorite).filter(
            Favorite.user_id == current_user.id,
            Favorite.product_id == product_id
        ).first()
        
        if existing:
            db.delete(existing)
            db.commit()
            return {"message": "Удалено", "favorited": False}
        else:
            db.add(Favorite(user_id=current_user.id, product_id=product_id))
            db.commit()
            return {"message": "Добавлено", "favorited": True}
    except:
        raise HTTPException(500, "Ошибка")

# ============================================
# 🔥 🔥 🔥 ИСПРАВЛЕННЫЕ ЭНДПОИНТЫ КОРЗИНЫ 🔥 🔥 🔥
# ============================================

@router.get("/cart")
def get_cart(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Текущая корзина"""
    try:
        items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
        cart_items = []
        total = 0
        for item in items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                item_total = float(product.sale_price) * item.quantity
                total += item_total
                cart_items.append({
                    "cart_item_id": item.id, 
                    "product_id": product.id, 
                    "sku": product.sku,
                    "name": product.name, 
                    "sale_price": float(product.sale_price),
                    "quantity": item.quantity, 
                    "available": 999,
                    "item_total": item_total
                })
        return {"items": cart_items, "total": round(total, 2), "items_count": sum(i["quantity"] for i in cart_items)}
    except Exception as e:
        print(f"❌ Ошибка get_cart: {e}")
        return {"items": [], "total": 0, "items_count": 0}

@router.post("/cart")
def add_to_cart(item_data: CartItemAdd, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Добавить в корзину"""
    try:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(404, "Товар не найден")
        
        existing = db.query(CartItem).filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == item_data.product_id
        ).first()
        
        if existing:
            existing.quantity += item_data.quantity
        else:
            db.add(CartItem(user_id=current_user.id, product_id=item_data.product_id, quantity=item_data.quantity))
        
        db.commit()
        return {"message": "Добавлено"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка add_to_cart: {e}")
        raise HTTPException(500, str(e))

@router.put("/cart")
def update_cart_item_by_product(
    data: dict,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Обновить количество товара в корзине по product_id"""
    try:
        product_id = data.get("product_id")
        quantity = data.get("quantity")
        
        if not product_id or quantity is None:
            raise HTTPException(400, "Не указан product_id или quantity")
        
        if quantity < 1:
            raise HTTPException(400, "Количество должно быть >= 1")
        
        item = db.query(CartItem).filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == product_id
        ).first()
        
        if not item:
            raise HTTPException(404, "Товар не найден в корзине")
        
        item.quantity = quantity
        db.commit()
        
        return {"message": "Количество обновлено", "product_id": product_id, "quantity": quantity}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка update_cart_item_by_product: {e}")
        raise HTTPException(500, str(e))

@router.delete("/cart/{product_id}")
def remove_from_cart_by_product(
    product_id: int,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Удалить товар из корзины по product_id"""
    try:
        deleted = db.query(CartItem).filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == product_id
        ).delete()
        
        db.commit()
        
        if deleted == 0:
            raise HTTPException(404, "Товар не найден в корзине")
        
        return {"message": "Товар удален", "product_id": product_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка remove_from_cart_by_product: {e}")
        raise HTTPException(500, str(e))

@router.delete("/cart")
def clear_cart(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Очистить всю корзину"""
    try:
        db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
        db.commit()
        return {"message": "Корзина очищена"}
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка clear_cart: {e}")
        raise HTTPException(500, str(e))

# ============================================
# КОНЕЦ ИСПРАВЛЕННЫХ ЭНДПОИНТОВ
# ============================================

@router.post("/cart/checkout")
async def checkout(
    request_data: dict = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Оформить заказ с данными доставки и комментарием"""
    try:
        if request_data is None:
            request_data = {}
        
        cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
        if not cart_items:
            raise HTTPException(400, "Корзина пуста")
        
        delivery_method = request_data.get("delivery_method", "pickup")
        delivery_address = request_data.get("delivery_address", "")
        pickup_point_id = request_data.get("pickup_point_id")
        client_phone = request_data.get("client_phone", "")
        client_email = request_data.get("client_email", "")
        comment = request_data.get("comment", "Заказ из корзины")
        
        if delivery_method == "courier" and not delivery_address:
            raise HTTPException(400, "Укажите адрес доставки")
        if delivery_method == "pickup" and not pickup_point_id:
            raise HTTPException(400, "Выберите пункт выдачи")
        
        order_number = f"CL-{datetime.now().strftime('%Y%m%d%H%M%S')}-{current_user.id}"
        total_amount = 0.0
        order_items_data = []
        
        for c_item in cart_items:
            product = db.query(Product).filter(Product.id == c_item.product_id).first()
            if product:
                item_total = float(product.sale_price or 0) * c_item.quantity
                total_amount += item_total
                order_items_data.append({
                    "product_id": c_item.product_id,
                    "quantity": c_item.quantity,
                    "unit_price": float(product.sale_price or 0),
                    "total_price": item_total
                })
        
        print(f"🔍 СТАТУС: {OrderStatus.WAITING_APPROVAL}")
        print(f"🔍 ЗНАЧЕНИЕ: {OrderStatus.WAITING_APPROVAL.value}")

        if not client_email:
            client_email = getattr(current_user, 'email', current_user.login)

        order = Order(
            order_number=order_number,
            client_id=current_user.id,
            status=OrderStatus.WAITING_APPROVAL.value,
            total_amount=total_amount,
            comment=comment,
            delivery_method=delivery_method,
            delivery_address=delivery_address,
            pickup_point_id=pickup_point_id,
            client_phone=client_phone or getattr(current_user, 'phone', None),
            client_email=client_email
        )
        db.add(order)
        db.flush()
        
        for item_data in order_items_data:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                total_price=item_data["total_price"]
            )
            db.add(order_item)
        
        db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
        
        db.commit()
        db.refresh(order)
        
        # 🔥 УВЕДОМЛЕНИЕ ДЛЯ МЕНЕДЖЕРОВ (НОВЫЙ ЗАКАЗ)
        managers = db.query(User).filter(User.role.in_(['admin', 'warehouse_manager'])).all()
        for manager in managers:
            create_notification(
                db=db,
                user_id=manager.id,
                type="order",
                title="📦 Новый заказ",
                message=f"Заказ {order.order_number} от клиента {current_user.full_name or current_user.login} на сумму {total_amount} ₽",
                link=f"/orders"
            )
        
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "total_amount": total_amount,
            "status": order.status.value if hasattr(order.status, 'value') else str(order.status)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔴 ОШИБКА CHECKOUT: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Ошибка создания заказа: {str(e)}")

# === ПРОФИЛЬ ===
@router.get("/profile")
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Профиль клиента"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    orders = db.query(Order).filter(Order.client_id == current_user.id).order_by(Order.created_at.desc()).limit(10).all()
    
    return {
        "user": {
            "id": current_user.id, 
            "login": current_user.login,
            "full_name": current_user.full_name, 
            "role": current_user.role,
            "email": getattr(current_user, 'email', current_user.login)
        },
        "profile": {
            "phone": profile.phone if profile else None,
            "avatar_url": profile.avatar_url if profile else None
        },
        "recent_orders": [
            {"id": o.id, "order_number": o.order_number, "status": o.status, "total_amount": float(o.total_amount)}
            for o in orders
        ]
    }


# === ОТЗЫВЫ ===
@router.post("/reviews")
async def create_review(
    product_id: int = Form(...),
    rating: int = Form(..., ge=1, le=5),
    text: Optional[str] = Form(None),
    order_id: Optional[int] = Form(None),
    files: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать отзыв с фото"""
    try:
        photo_urls = []
        upload_dir = "static/reviews"
        os.makedirs(upload_dir, exist_ok=True)
        
        for file in files:
            if file.filename:
                ext = os.path.splitext(file.filename)[1]
                filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
                filepath = os.path.join(upload_dir, filename)
                
                with open(filepath, "wb") as f:
                    content = await file.read()
                    f.write(content)
                
                photo_urls.append(f"/static/reviews/{filename}")
        
        review = Review(
            user_id=current_user.id,
            product_id=product_id,
            rating=rating,
            text=text,
            order_id=order_id,
            photos=json.dumps(photo_urls) if photo_urls else None,
            is_verified_purchase=order_id is not None
        )
        
        db.add(review)
        db.commit()
        db.refresh(review)
        
        return {"message": "Отзыв создан", "review_id": review.id}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/products/{product_id}/reviews")
def get_product_reviews(
    product_id: int,
    with_photos: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отзывы о товаре"""
    try:
        query = db.query(Review).filter(Review.product_id == product_id)
        
        if with_photos:
            query = query.filter(Review.photos.isnot(None))
        
        reviews = query.order_by(Review.created_at.desc()).all()
        
        result = []
        for r in reviews:
            photos = json.loads(r.photos or "[]") if r.photos else []
            result.append({
                "id": r.id,
                "user_name": r.user.full_name if r.user else "Аноним",
                "rating": r.rating,
                "text": r.text,
                "photos": photos,
                "is_verified": getattr(r, 'is_verified_purchase', False),
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "likes": getattr(r, 'likes', 0)
            })
        
        return result
    except:
        return []

@router.post("/reviews/{review_id}/like")
def like_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Лайк отзыва"""
    try:
        review = db.query(Review).filter(Review.id == review_id).first()
        if not review:
            raise HTTPException(404, "Отзыв не найден")
        
        review.likes = (review.likes or 0) + 1
        db.commit()
        return {"likes": review.likes}
    except HTTPException:
        raise
    except:
        raise HTTPException(500, "Ошибка лайка")

# === ПВЗ ===
@router.get("/pickup-points")
def get_pickup_points(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Пункты выдачи"""
    points = [
        {"id": 1, "name": "ПВЗ Центр", "address": "ул. Ленина, 1", "lat": 45.045, "lon": 41.973, "work_hours": "09:00-20:00"},
        {"id": 2, "name": "ПВЗ Юг", "address": "пр. Кулакова, 20", "lat": 45.032, "lon": 41.985, "work_hours": "10:00-21:00"},
        {"id": 3, "name": "ПВЗ Север", "address": "ул. Мира, 15", "lat": 45.058, "lon": 41.960, "work_hours": "09:00-19:00"},
    ]
    
    if lat and lon:
        for p in points:
            p["distance"] = ((p["lat"] - lat)**2 + (p["lon"] - lon)**2)**0.5 * 111
        points.sort(key=lambda x: x.get("distance", 999))
    
    return points

@router.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список категорий"""
    categories = db.query(
        Product.category, 
        func.count(Product.id).label('count')
    ).filter(
        Product.is_active == True,
        Product.category.isnot(None)
    ).group_by(Product.category).all()
    
    return [{"name": cat[0], "count": cat[1]} for cat in categories if cat[0]]

@router.put("/profile")
def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление профиля"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        
        # Обновляем пользователя
        for key, value in update_data.items():
            if hasattr(current_user, key) and value is not None:
                setattr(current_user, key, value)
        
        # Явно обновляем email
        if 'email' in update_data and update_data['email'] is not None:
            current_user.email = update_data['email']
        
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if not profile:
            profile = UserProfile(user_id=current_user.id)
            db.add(profile)
        
        for key, value in update_data.items():
            if hasattr(profile, key) and value is not None:
                setattr(profile, key, value)
        
        db.commit()
        db.refresh(current_user)
        db.refresh(profile)
        
        return {
            "message": "Профиль обновлён",
            "user": {
                "id": current_user.id,
                "login": current_user.login,
                "full_name": current_user.full_name,
                "email": getattr(current_user, 'email', current_user.login)
            },
            "profile": {
                "phone": profile.phone,
                "avatar_url": profile.avatar_url
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    
@router.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузка аватара профиля"""
    import os
    from datetime import datetime
    
    upload_dir = "static/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Очищаем имя файла
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"avatar_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, safe_filename)
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    
    profile.avatar_url = f"/static/avatars/{safe_filename}"
    db.commit()
    
    return {"message": "Аватар загружен", "avatar_url": profile.avatar_url}