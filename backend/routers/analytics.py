from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, select, cast, Date
from database import get_db
from core.permissions import require_worker, require_manager
from models.user import User
from models.product import Product
from models.stock import Stock
from models.document import WarehouseDocument, DocStatus
from models.order import Order, OrderStatus, OrderItem
from datetime import datetime, timedelta
from models.document import DocumentItem

router = APIRouter(prefix="/api/analytics", tags=["Аналитика"])

@router.get("/stock-report")
def get_stock_report(db: Session = Depends(get_db), current_user: User = require_worker):
    """Отчёт по складским остаткам с группировкой по товарам"""
    
    results = db.query(
        Product.id,
        Product.sku,
        Product.name,
        Product.category,
        Product.purchase_price,
        Product.sale_price,
        Product.min_stock,
        Product.max_stock,
        func.coalesce(func.sum(Stock.quantity), 0).label('total_qty')
    ).outerjoin(Stock, Stock.product_id == Product.id
    ).group_by(Product.id).all()
    
    result_list = []
    for r in results:
        qty = r.total_qty or 0
        status = "normal"
        if qty == 0:
            status = "critical"
        elif r.min_stock and qty < r.min_stock:
            status = "low"
        elif r.max_stock and qty > r.max_stock:
            status = "overstock"
        
        result_list.append({
            "sku": r.sku or "—",
            "name": r.name or "Без названия",
            "category": r.category or "—",
            "purchase_price": float(r.purchase_price) if r.purchase_price else 0.0,
            "sale_price": float(r.sale_price) if r.sale_price else 0.0,
            "quantity": qty,
            "min_stock": r.min_stock or 0,
            "max_stock": r.max_stock or 0,
            "status": status
        })
    
    return result_list

@router.get("/dashboard-stats")
def get_dashboard_stats(days: int = 30, db: Session = Depends(get_db), current_user: User = require_worker):
    """Статистика для дашборда — С ГРАФИКАМИ"""
    
    # 1. Общий остаток
    total_stock = db.query(func.coalesce(func.sum(Stock.quantity), 0)).scalar() or 0
    
    # 2. Всего товаров
    total_products = db.query(func.count(Product.id)).scalar() or 0
    
    # 3. Товары с низким остатком
    subquery = db.query(
        Product.id
    ).join(Stock, Stock.product_id == Product.id, isouter=True
    ).group_by(Product.id, Product.min_stock
    ).having(
        (Product.min_stock > 0) & 
        (func.coalesce(func.sum(Stock.quantity), 0) < Product.min_stock)
    ).subquery()
    
    low_stock = db.query(func.count(subquery.c.id)).scalar() or 0
    
    # 4. 📊 ОБОРОТ ДОКУМЕНТОВ ПО ДНЯМ (ИСПРАВЛЕНО)
    date_from = datetime.now() - timedelta(days=days)
    daily_turnover = db.query(
        cast(WarehouseDocument.created_at, Date).label('date'),
        func.count(WarehouseDocument.id).label('count')
    ).filter(
        WarehouseDocument.created_at >= date_from,
        WarehouseDocument.status == DocStatus.COMPLETED
    ).group_by(cast(WarehouseDocument.created_at, Date)
    ).order_by(cast(WarehouseDocument.created_at, Date)).all()
    
    daily_turnover_list = [
        {"date": str(d.date), "count": d.count}
        for d in daily_turnover
    ]
    
    # 5. 🏆 ТОП-5 ТОВАРОВ ПО ОБОРОТУ (ИСПРАВЛЕНО)
    # Считаем по проведённым документам отгрузки
    top_products = db.query(
        Product.id,
        Product.name,
        func.sum(DocumentItem.quantity).label('total_qty')
    ).join(DocumentItem, DocumentItem.product_id == Product.id
    ).join(WarehouseDocument, WarehouseDocument.id == DocumentItem.doc_id
    ).filter(
        WarehouseDocument.status == DocStatus.COMPLETED,
        WarehouseDocument.type == "ship",  # Только отгрузки
        WarehouseDocument.created_at >= date_from
    ).group_by(Product.id, Product.name
    ).order_by(func.sum(DocumentItem.quantity).desc()
    ).limit(5).all()
    
    top_products_list = [
        {"name": p.name, "total_qty": p.total_qty}
        for p in top_products
    ]
    
    # 6. Заказы по статусам
    orders_by_status = db.query(
        Order.status,
        func.count(Order.id).label('count')
    ).group_by(Order.status).all()
    
    return {
        "summary": {
            "total_products": total_products,
            "total_stock": total_stock,
            "low_stock": low_stock
        },
        "daily_turnover": daily_turnover_list,  # ← ТЕПЕРЬ НЕ ПУСТОЙ
        "top_products": top_products_list,      # ← ТЕПЕРЬ НЕ ПУСТОЙ
        "order_statuses": [
            {"status": str(s.status.value) if hasattr(s.status, 'value') else str(s.status), "count": s.count} 
            for s in orders_by_status
        ]
    }