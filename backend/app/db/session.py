from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings

SessionLocal = sessionmaker(autocommit=False, autoflush=False)


def create_app_engine() -> Engine:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required for database operations")
    return create_engine(settings.database_url, pool_pre_ping=True)


def get_db():
    if SessionLocal.kw.get("bind") is None:
        SessionLocal.configure(bind=create_app_engine())
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
