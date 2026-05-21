from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from routers.auth import router as auth_router  # ← НОВОЕ

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

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "wms-backend"}