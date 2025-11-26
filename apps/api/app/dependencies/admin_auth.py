"""
Admin Authentication Dependencies

Phase 6: Production Security & Hardening
Provides secure admin authentication using bcrypt password hashing.
"""
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# Try to import bcrypt, fall back to hashlib if not available
try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False
    import warnings
    warnings.warn(
        "bcrypt not installed. Using SHA-256 fallback. "
        "Install bcrypt for production: pip install bcrypt"
    )


# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# Admin password configuration
# In production, use ADMIN_PASSWORD_HASH (bcrypt hash)
# In development, can use ADMIN_RESCUE_PASSWORD (plaintext, for convenience)
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")
ADMIN_RESCUE_PASSWORD = os.getenv("ADMIN_RESCUE_PASSWORD", "thongtinmualu2025")

# Session configuration
SESSION_TTL_HOURS = int(os.getenv("ADMIN_SESSION_TTL_HOURS", "24"))
MAX_SESSIONS_PER_ADMIN = 5  # Limit concurrent sessions

# In-memory session store
# For production, replace with Redis or database-backed store
_admin_sessions: Dict[str, datetime] = {}

# Security token header
security = HTTPBearer(auto_error=False)


class AdminLoginRequest(BaseModel):
    """Request model for admin login"""
    password: str


class AdminLoginResponse(BaseModel):
    """Response model for admin login"""
    valid: bool
    token: Optional[str] = None
    message: Optional[str] = None
    expires_at: Optional[str] = None


def generate_secure_token() -> str:
    """Generate a cryptographically secure session token"""
    return secrets.token_urlsafe(32)


def hash_password_bcrypt(password: str) -> str:
    """Hash password using bcrypt"""
    if not BCRYPT_AVAILABLE:
        raise RuntimeError("bcrypt not available")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password_bcrypt(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash"""
    if not BCRYPT_AVAILABLE:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def hash_password_sha256(password: str, salt: Optional[str] = None) -> str:
    """Fallback: Hash password using SHA-256 with salt"""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}${hashed}"


def verify_password_sha256(password: str, stored_hash: str) -> bool:
    """Fallback: Verify password against SHA-256 hash"""
    try:
        parts = stored_hash.split("$")
        if len(parts) != 2:
            return False
        salt, _ = parts
        return hash_password_sha256(password, salt) == stored_hash
    except Exception:
        return False


def verify_admin_password(password: str) -> bool:
    """
    Verify admin password.

    Checks in order:
    1. ADMIN_PASSWORD_HASH (bcrypt) - production
    2. ADMIN_RESCUE_PASSWORD (plaintext) - development fallback
    """
    # First, try bcrypt hash from environment
    if ADMIN_PASSWORD_HASH:
        if BCRYPT_AVAILABLE:
            return verify_password_bcrypt(password, ADMIN_PASSWORD_HASH)
        # Try SHA-256 fallback format
        if "$" in ADMIN_PASSWORD_HASH:
            return verify_password_sha256(password, ADMIN_PASSWORD_HASH)

    # Development fallback: plaintext password
    if not IS_PRODUCTION and ADMIN_RESCUE_PASSWORD:
        return secrets.compare_digest(password, ADMIN_RESCUE_PASSWORD)

    return False


def create_admin_session() -> tuple[str, datetime]:
    """
    Create a new admin session.

    Returns:
        tuple: (token, expires_at)
    """
    token = generate_secure_token()
    expires_at = datetime.utcnow() + timedelta(hours=SESSION_TTL_HOURS)

    # Cleanup old sessions if too many
    if len(_admin_sessions) > MAX_SESSIONS_PER_ADMIN * 2:
        cleanup_expired_sessions()

    _admin_sessions[token] = expires_at

    return token, expires_at


def validate_admin_session(token: str) -> bool:
    """
    Validate an admin session token.

    Returns:
        True if valid, False otherwise
    """
    if not token:
        return False

    expires_at = _admin_sessions.get(token)
    if not expires_at:
        return False

    if datetime.utcnow() > expires_at:
        # Token expired, remove it
        del _admin_sessions[token]
        return False

    return True


def invalidate_admin_session(token: str) -> bool:
    """
    Invalidate (logout) an admin session.

    Returns:
        True if session was found and removed, False otherwise
    """
    if token in _admin_sessions:
        del _admin_sessions[token]
        return True
    return False


def cleanup_expired_sessions():
    """Remove all expired sessions"""
    now = datetime.utcnow()
    expired = [
        token for token, expires_at in _admin_sessions.items()
        if expires_at < now
    ]
    for token in expired:
        del _admin_sessions[token]


def get_admin_token_from_request(request: Request) -> Optional[str]:
    """
    Extract admin token from request.

    Checks in order:
    1. X-Admin-Token header
    2. Authorization: Bearer header
    """
    # Check X-Admin-Token header (legacy)
    token = request.headers.get("X-Admin-Token")
    if token:
        return token

    # Check Authorization header
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:]

    return None


async def get_current_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    FastAPI dependency to get current admin.

    Raises HTTPException if not authenticated.

    Usage:
        @app.get("/admin/protected")
        async def protected_route(admin: str = Depends(get_current_admin)):
            ...
    """
    token = get_admin_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not validate_admin_session(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return token


async def require_admin(request: Request) -> None:
    """
    FastAPI dependency to require admin authentication.

    Use this when you don't need the token itself.

    Usage:
        @app.delete("/admin/dangerous", dependencies=[Depends(require_admin)])
        async def dangerous_route():
            ...
    """
    await get_current_admin(request)


def admin_login(password: str) -> AdminLoginResponse:
    """
    Authenticate admin and create session.

    Returns AdminLoginResponse with token if successful.
    """
    if not verify_admin_password(password):
        return AdminLoginResponse(
            valid=False,
            message="Invalid password"
        )

    token, expires_at = create_admin_session()

    return AdminLoginResponse(
        valid=True,
        token=token,
        message="Login successful",
        expires_at=expires_at.isoformat() + "Z"
    )


def admin_logout(token: str) -> bool:
    """
    Logout admin session.

    Returns True if successful.
    """
    return invalidate_admin_session(token)


# Helper to generate password hash (run once to generate hash for env var)
def generate_password_hash(password: str) -> str:
    """
    Generate password hash for ADMIN_PASSWORD_HASH env var.

    Usage:
        python -c "from app.dependencies.admin_auth import generate_password_hash; print(generate_password_hash('your-password'))"
    """
    if BCRYPT_AVAILABLE:
        return hash_password_bcrypt(password)
    return hash_password_sha256(password)


# Export for use in other modules
__all__ = [
    "AdminLoginRequest",
    "AdminLoginResponse",
    "get_current_admin",
    "require_admin",
    "admin_login",
    "admin_logout",
    "generate_password_hash",
    "verify_admin_password",
]
