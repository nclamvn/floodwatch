"""
Database configuration and session management
Phase 3 Performance: QueuePool with connection pooling for production
"""
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import QueuePool, NullPool
from tenacity import retry, stop_after_attempt, wait_exponential

# Database URL from environment (handle empty string case)
DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql+psycopg://postgres:postgres@db:5432/floodwatch_dev"

# Environment detection
IS_PRODUCTION = os.getenv("ENV", "development").lower() == "production"

# Create engine with retry
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
def create_db_engine():
    """
    Create database engine with connection retry and pooling

    Phase 3 Performance Optimization:
    - QueuePool: Maintains a pool of reusable connections
    - pool_size=10: Base number of connections to keep open
    - max_overflow=20: Allow up to 30 connections total (10 + 20)
    - pool_pre_ping=True: Check connection health before use
    - pool_recycle=3600: Recycle connections after 1 hour
    """
    # Use QueuePool for production, NullPool for development
    if IS_PRODUCTION:
        return create_engine(
            DATABASE_URL,
            poolclass=QueuePool,
            pool_size=10,           # Keep 10 connections ready
            max_overflow=20,        # Allow 20 more when busy
            pool_pre_ping=True,     # Check connections before use
            pool_recycle=3600,      # Recycle after 1 hour
            pool_timeout=30,        # Wait 30s for connection
            echo=False,
            future=True
        )
    else:
        # Development: Use NullPool for simpler debugging
        return create_engine(
            DATABASE_URL,
            poolclass=NullPool,
            echo=False,
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
