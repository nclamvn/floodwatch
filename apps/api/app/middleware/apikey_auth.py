"""
API Key Authentication Middleware
"""
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.database import get_db, ApiKey
from app.services.apikey_repo import ApiKeyRepository

# Header scheme for API key
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_api_key(
    api_key: Optional[str] = Depends(api_key_header),
    db: Session = Depends(get_db)
) -> Optional[ApiKey]:
    """
    Get API key from X-API-Key header and validate
    Returns None if no key provided (for optional auth)
    Raises 401 if key provided but invalid
    """
    if not api_key:
        return None

    # Look up key in database
    key_obj = ApiKeyRepository.get_by_key(db, api_key)

    if not key_obj:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )

    # Update last_used_at (async in background ideally, but for MVP this is fine)
    ApiKeyRepository.update_last_used(db, key_obj)

    return key_obj


async def require_api_key(
    api_key: Optional[ApiKey] = Depends(get_api_key)
) -> ApiKey:
    """
    Require API key - raises 401 if not provided or invalid
    """
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Include X-API-Key header."
        )

    return api_key


def get_rate_limit_key(request: Request) -> str:
    """
    Get rate limit key - use API key if present, otherwise IP address
    This is used by slowapi for rate limiting
    """
    # Try to get API key from request state (set by middleware)
    if hasattr(request.state, "api_key") and request.state.api_key:
        return f"apikey:{request.state.api_key.id}"

    # Fallback to IP address
    client_ip = request.client.host if request.client else "unknown"
    return f"ip:{client_ip}"


def get_rate_limit_for_key(request: Request) -> str:
    """
    Get rate limit string for the current request
    Returns format like "120/minute" for API keys or "30/minute" for IP
    """
    if hasattr(request.state, "api_key") and request.state.api_key:
        # Use rate_limit from API key
        return f"{request.state.api_key.rate_limit}/minute"

    # Default IP-based rate limit
    return "30/minute"
