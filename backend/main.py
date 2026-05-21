from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from routers.auth import router as auth_router  # ← НОВОЕ
from routers.documents import router as documents_router
from routers.catalog import router as catalog_router  # ← НОВОЕ
from routers.inventory import router as inventory_router
from routers.orders import router as orders_router
from models.order import Order, OrderItem

class Settings(BaseSettings):
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"

settings = Settings()

app = FastAPI(title="WMS: Фабрика мебели СК", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)  # ← НОВОЕ
app.include_router(catalog_router)  # ← НОВОЕ (после auth_router)
app.include_router(documents_router)
app.include_router(inventory_router)
app.include_router(orders_router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "wms-backend"}