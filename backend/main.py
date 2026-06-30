from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic_settings import BaseSettings
from routers.auth import router as auth_router
from routers.documents import router as documents_router
from routers.catalog import router as catalog_router
from routers.inventory import router as inventory_router
from routers.orders import router as orders_router
from models.order import Order, OrderItem
from routers.analytics import router as analytics_router
from routers.audit import router as audit_router
from routers.client import router as client_router
import os
from routers.chat import router as chat_router
from routers.notifications import router as notifications_router
from routers.admin import router as admin_router

class Settings(BaseSettings):
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"

settings = Settings()

app = FastAPI(title="WMS: SKFU", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Раздача статических файлов (аватары, фото)
os.makedirs("static/avatars", exist_ok=True)
os.makedirs("static/reviews", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(client_router)
app.include_router(documents_router)
app.include_router(inventory_router)
app.include_router(orders_router)
app.include_router(analytics_router)
app.include_router(audit_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(admin_router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "wms-backend"}