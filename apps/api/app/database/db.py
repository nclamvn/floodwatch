"""
Database configuration and session management
"""
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import NullPool
from tenacity import retry, stop_after_attempt, wait_exponential

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://fw_user:fw_pass@db:5432/floodwatch")

# Create engine with retry
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
def create_db_engine():
    """Create database engine with connection retry"""
    return create_engine(
        DATABASE_URL,
        poolclass=NullPool,  # Use NullPool for development
        echo=False,  # Set to True for SQL debugging
        future=True
    )

# Engine and session
engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session

    Usage:
        @app.get("/")
        def route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for database session

    Usage:
        with get_db_context() as db:
            ...
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
