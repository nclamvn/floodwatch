"""
API Key Repository - Data access layer for API keys
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
import hashlib

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import ApiKey


class ApiKeyRepository:
    """Repository for API Key operations"""

    @staticmethod
    def hash_key(api_key: str, salt: str = "salt.") -> str:
        """Hash an API key using SHA-256"""
        return hashlib.sha256((salt + api_key).encode()).hexdigest()

    @staticmethod
    def create(db: Session, name: str, key_plain: str, scopes: list[str] = None, rate_limit: int = 120) -> ApiKey:
        """Create a new API key"""
        if scopes is None:
            scopes = ["read:public"]

        key_hash = ApiKeyRepository.hash_key(key_plain)

        api_key = ApiKey(
            name=name,
            key_hash=key_hash,
            scopes=scopes,
            rate_limit=rate_limit
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        return api_key

    @staticmethod
    def get_by_key(db: Session, key_plain: str) -> Optional[ApiKey]:
        """Get API key by plain key (hashes and looks up)"""
        key_hash = ApiKeyRepository.hash_key(key_plain)
        return db.query(ApiKey).filter(ApiKey.key_hash == key_hash).first()

    @staticmethod
    def get_by_id(db: Session, api_key_id: UUID) -> Optional[ApiKey]:
        """Get API key by ID"""
        return db.query(ApiKey).filter(ApiKey.id == api_key_id).first()

    @staticmethod
    def update_last_used(db: Session, api_key: ApiKey) -> None:
        """Update last_used_at timestamp"""
        api_key.last_used_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def get_all(db: Session, limit: int = 50, offset: int = 0) -> tuple[list[ApiKey], int]:
        """Get all API keys with pagination"""
        query = db.query(ApiKey)
        total = query.count()
        keys = query.order_by(ApiKey.created_at.desc()).limit(limit).offset(offset).all()
        return keys, total

    @staticmethod
    def delete(db: Session, api_key_id: UUID) -> bool:
        """Delete an API key"""
        api_key = db.query(ApiKey).filter(ApiKey.id == api_key_id).first()
        if not api_key:
            return False

        db.delete(api_key)
        db.commit()
        return True
