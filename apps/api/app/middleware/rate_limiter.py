"""
Rate Limiting Middleware

Phase 6: Production Security & Hardening
Provides configurable rate limiting for API endpoints.
"""
import os
import time
import hashlib
from typing import Optional, Dict, Callable
from collections import defaultdict
from dataclasses import dataclass, field
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse


# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"


@dataclass
class RateLimitConfig:
    """Configuration for a rate limit rule"""
    requests: int  # Number of requests allowed
    window_seconds: int  # Time window in seconds
    key_func: Optional[Callable[[Request], str]] = None  # Custom key function

    @property
    def description(self) -> str:
        return f"{self.requests} requests per {self.window_seconds} seconds"


# Default rate limit configurations
RATE_LIMITS = {
    # Public write endpoints - moderate limits
    "public_write": RateLimitConfig(requests=20, window_seconds=300),  # 20 per 5 min

    # Admin login - strict limits to prevent brute force
    "admin_login": RateLimitConfig(requests=5, window_seconds=900),  # 5 per 15 min

    # Report submission - moderate limits
    "report": RateLimitConfig(requests=10, window_seconds=300),  # 10 per 5 min

    # Help request/offer - moderate limits
    "help": RateLimitConfig(requests=15, window_seconds=300),  # 15 per 5 min

    # Distress reporting - slightly more lenient (emergency)
    "distress": RateLimitConfig(requests=30, window_seconds=300),  # 30 per 5 min

    # AI endpoints - expensive operations
    "ai": RateLimitConfig(requests=10, window_seconds=60),  # 10 per minute

    # Read endpoints - more lenient
    "read": RateLimitConfig(requests=100, window_seconds=60),  # 100 per minute

    # Default fallback
    "default": RateLimitConfig(requests=60, window_seconds=60),  # 60 per minute
}


@dataclass
class RateLimitEntry:
    """Tracks request count for a single key"""
    count: int = 0
    window_start: float = field(default_factory=time.time)


class InMemoryRateLimiter:
    """
    In-memory rate limiter implementation.

    For production with multiple workers, replace with Redis-based implementation.
    This implementation is suitable for:
    - Single-worker deployments
    - Development/testing
    - Low-traffic applications
    """

    def __init__(self):
        self._storage: Dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # Clean up every 5 minutes

    def _cleanup_expired(self):
        """Remove expired entries to prevent memory bloat"""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        # Find and remove expired entries
        expired_keys = [
            key for key, entry in self._storage.items()
            if now - entry.window_start > 3600  # Remove entries older than 1 hour
        ]
        for key in expired_keys:
            del self._storage[key]

        self._last_cleanup = now

    def is_allowed(
        self,
        key: str,
        config: RateLimitConfig
    ) -> tuple[bool, Dict[str, int]]:
        """
        Check if request is allowed under rate limit.

        Returns:
            tuple: (is_allowed, headers_dict)
            - is_allowed: True if request is allowed
            - headers_dict: Rate limit headers to include in response
        """
        self._cleanup_expired()

        now = time.time()
        entry = self._storage[key]

        # Check if we're in a new window
        if now - entry.window_start >= config.window_seconds:
            # Reset window
            entry.count = 1
            entry.window_start = now
            is_allowed = True
        else:
            # Same window - check limit
            entry.count += 1
            is_allowed = entry.count <= config.requests

        # Calculate headers
        remaining = max(0, config.requests - entry.count)
        reset_time = int(entry.window_start + config.window_seconds)

        headers = {
            "X-RateLimit-Limit": config.requests,
            "X-RateLimit-Remaining": remaining,
            "X-RateLimit-Reset": reset_time,
        }

        if not is_allowed:
            headers["Retry-After"] = int(reset_time - now)

        return is_allowed, headers


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


def get_client_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.

    Priority:
    1. API key (if present)
    2. X-Forwarded-For header (for proxied requests)
    3. Client IP address
    """
    # Check for API key
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Hash the API key for privacy
        return f"apikey:{hashlib.sha256(api_key.encode()).hexdigest()[:16]}"

    # Check for forwarded IP (behind proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP (original client)
        client_ip = forwarded_for.split(",")[0].strip()
        return f"ip:{client_ip}"

    # Fallback to direct client IP
    if request.client:
        return f"ip:{request.client.host}"

    return "ip:unknown"


def get_rate_limit_config(request: Request) -> RateLimitConfig:
    """
    Determine which rate limit config to use based on the request path.
    """
    path = request.url.path.lower()
    method = request.method.upper()

    # Admin login - strictest limits
    if "/admin/verify-password" in path or "/admin/login" in path:
        return RATE_LIMITS["admin_login"]

    # AI endpoints
    if "/ai/" in path or "/summary" in path or "/forecast" in path:
        return RATE_LIMITS["ai"]

    # Distress endpoints
    if "/distress" in path and method == "POST":
        return RATE_LIMITS["distress"]

    # Help endpoints (write)
    if "/help/" in path and method in ("POST", "PUT", "PATCH"):
        return RATE_LIMITS["help"]

    # Report endpoints (write)
    if "/report" in path and method == "POST":
        return RATE_LIMITS["report"]

    # General write operations
    if method in ("POST", "PUT", "PATCH", "DELETE"):
        return RATE_LIMITS["public_write"]

    # Read operations
    if method == "GET":
        return RATE_LIMITS["read"]

    return RATE_LIMITS["default"]


def check_rate_limit(request: Request) -> Optional[JSONResponse]:
    """
    Check rate limit for a request.

    Returns:
        None if allowed, JSONResponse with 429 if rate limited
    """
    # Skip rate limiting for health checks
    if request.url.path in ("/health", "/healthz", "/ready"):
        return None

    # Get client identifier and config
    client_id = get_client_identifier(request)
    config = get_rate_limit_config(request)

    # Build rate limit key
    rate_limit_key = f"{client_id}:{request.url.path}"

    # Check rate limit
    is_allowed, headers = rate_limiter.is_allowed(rate_limit_key, config)

    if not is_allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "rate_limit_exceeded",
                "message": "Too many requests. Please try again later.",
                "detail": f"Rate limit: {config.description}",
                "retry_after": headers.get("Retry-After", 60)
            },
            headers={k: str(v) for k, v in headers.items()}
        )

    return None


def rate_limit_dependency(
    limit_type: str = "default"
) -> Callable:
    """
    FastAPI dependency for rate limiting specific endpoints.

    Usage:
        @app.post("/some-endpoint", dependencies=[Depends(rate_limit_dependency("admin_login"))])
        async def some_endpoint():
            ...
    """
    config = RATE_LIMITS.get(limit_type, RATE_LIMITS["default"])

    async def _check_rate_limit(request: Request):
        client_id = get_client_identifier(request)
        rate_limit_key = f"{client_id}:{limit_type}"

        is_allowed, headers = rate_limiter.is_allowed(rate_limit_key, config)

        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": "Too many requests. Please try again later.",
                    "retry_after": headers.get("Retry-After", 60)
                },
                headers={k: str(v) for k, v in headers.items()}
            )

    return _check_rate_limit


# Endpoint-specific rate limit decorators (for use with existing slowapi)
RATE_LIMIT_STRINGS = {
    "admin_login": "5/15minute",
    "public_write": "20/5minute",
    "report": "10/5minute",
    "help": "15/5minute",
    "distress": "30/5minute",
    "ai": "10/minute",
    "read": "100/minute",
    "default": "60/minute",
}
