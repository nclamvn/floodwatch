"""
Security Headers Middleware

Phase 6: Production Security & Hardening
Adds comprehensive security headers to all HTTP responses.
"""
import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# Content Security Policy directives
# Customize these based on your needs
CSP_DIRECTIVES = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  # Required for Next.js
    "style-src": ["'self'", "'unsafe-inline'"],  # Required for inline styles
    "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https://*.cloudinary.com",
        "https://res.cloudinary.com",
        "https://*.maptiler.com",
        "https://*.openstreetmap.org",
        "https://*.tile.openstreetmap.org",
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
        "'self'",
        "https://*.maptiler.com",
        "https://api.openai.com",
        "https://*.cloudinary.com",
        "wss://*",  # WebSocket connections
    ],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
}

# Permissions Policy (formerly Feature-Policy)
PERMISSIONS_POLICY = {
    "geolocation": ["self"],  # Allow geolocation for map features
    "camera": [],  # Disable camera
    "microphone": [],  # Disable microphone
    "payment": [],  # Disable payment
    "usb": [],  # Disable USB
}


def build_csp_header() -> str:
    """Build Content-Security-Policy header value"""
    directives = []
    for directive, values in CSP_DIRECTIVES.items():
        if values:
            directives.append(f"{directive} {' '.join(values)}")
        else:
            directives.append(directive)
    return "; ".join(directives)


def build_permissions_policy() -> str:
    """Build Permissions-Policy header value"""
    policies = []
    for feature, allowlist in PERMISSIONS_POLICY.items():
        if allowlist:
            policies.append(f"{feature}=({' '.join(allowlist)})")
        else:
            policies.append(f"{feature}=()")
    return ", ".join(policies)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.

    Headers added:
    - X-Frame-Options: Prevent clickjacking
    - X-Content-Type-Options: Prevent MIME sniffing
    - X-XSS-Protection: XSS filter (legacy but still useful)
    - Referrer-Policy: Control referrer information
    - Strict-Transport-Security: Force HTTPS (production only)
    - Content-Security-Policy: Control resource loading
    - Permissions-Policy: Control browser features
    - X-Permitted-Cross-Domain-Policies: Prevent Adobe cross-domain
    - X-Download-Options: Prevent IE from opening downloads
    - Cache-Control: Prevent caching of sensitive data (API responses)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Basic security headers (always)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["X-Download-Options"] = "noopen"

        # HSTS - only in production with HTTPS
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Content-Security-Policy
        # Use report-only in development to avoid blocking
        csp_header = build_csp_header()
        if IS_PRODUCTION:
            response.headers["Content-Security-Policy"] = csp_header
        else:
            response.headers["Content-Security-Policy-Report-Only"] = csp_header

        # Permissions-Policy
        response.headers["Permissions-Policy"] = build_permissions_policy()

        # Cache-Control for API responses (prevent caching sensitive data)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response


# Security header values for documentation
SECURITY_HEADERS_DOC = {
    "X-Frame-Options": {
        "value": "DENY",
        "description": "Prevents page from being loaded in iframe (clickjacking protection)"
    },
    "X-Content-Type-Options": {
        "value": "nosniff",
        "description": "Prevents MIME type sniffing"
    },
    "X-XSS-Protection": {
        "value": "1; mode=block",
        "description": "Enables browser's XSS filter"
    },
    "Referrer-Policy": {
        "value": "strict-origin-when-cross-origin",
        "description": "Controls referrer information sent with requests"
    },
    "Strict-Transport-Security": {
        "value": "max-age=31536000; includeSubDomains; preload",
        "description": "Forces HTTPS for 1 year (production only)"
    },
    "Content-Security-Policy": {
        "value": "See CSP_DIRECTIVES",
        "description": "Controls which resources can be loaded"
    },
    "Permissions-Policy": {
        "value": "See PERMISSIONS_POLICY",
        "description": "Controls which browser features are allowed"
    }
}
