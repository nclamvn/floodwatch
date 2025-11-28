"""
Enhanced Request Logging Middleware

Provides structured JSON logging for all HTTP requests with:
- Unique trace_id for request correlation
- Detailed context (path, method, status, duration)
- Log level based on response time and status
- User agent and IP tracking
"""

import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.utils.logging_config import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Structured request logging middleware

    Features:
    - Generates unique trace_id for each request
    - Logs all requests with consistent JSON structure
    - WARNING for slow requests (>1s)
    - ERROR for server errors (5xx)
    """

    # Paths to skip logging (health checks, metrics)
    SKIP_PATHS = {"/health", "/metrics", "/favicon.ico"}

    # Slow request threshold in seconds
    SLOW_THRESHOLD = 1.0

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip logging for certain paths
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # Generate trace ID
        trace_id = f"req_{uuid.uuid4().hex[:12]}"

        # Store trace_id in request state for use in handlers
        request.state.trace_id = trace_id

        # Start timing
        start_time = time.time()

        # Process request
        response = None
        error = None
        try:
            response = await call_next(request)
        except Exception as e:
            error = e
            raise
        finally:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            duration_s = duration_ms / 1000

            # Prepare log context
            log_context = {
                "trace_id": trace_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params) if request.query_params else None,
                "duration_ms": round(duration_ms, 2),
                "remote_ip": self._get_client_ip(request),
                "user_agent": self._get_user_agent(request),
            }

            if response:
                log_context["status"] = response.status_code

                # Add trace_id to response headers
                response.headers["X-Trace-ID"] = trace_id
                response.headers["X-Response-Time"] = f"{duration_s:.3f}s"

            if error:
                log_context["error"] = str(error)
                log_context["status"] = 500

            # Log with appropriate level
            self._log_request(log_context, duration_s, response)

        return response

    def _log_request(self, context: dict, duration_s: float, response: Response):
        """Log request with appropriate level based on status and duration"""
        status = context.get("status", 0)

        # Error responses (5xx)
        if status >= 500:
            logger.error("http_request", **context)
        # Slow requests
        elif duration_s > self.SLOW_THRESHOLD:
            logger.warning("slow_request", **context)
        # Client errors (4xx) - log at info but could be warning
        elif status >= 400:
            logger.info("http_request", **context)
        # Normal requests
        else:
            logger.info("http_request", **context)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP, checking for proxy headers"""
        # Check for proxy headers
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct client
        if request.client:
            return request.client.host

        return "unknown"

    def _get_user_agent(self, request: Request) -> str:
        """Get user agent, truncated for log brevity"""
        ua = request.headers.get("user-agent", "unknown")
        # Truncate long user agents
        if len(ua) > 100:
            return ua[:100] + "..."
        return ua
