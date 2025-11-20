"""
Metrics Middleware

Automatically records HTTP request metrics for all endpoints
"""

import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.monitoring.metrics import metrics


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to record HTTP request metrics

    Records:
    - Request count by method, path, status
    - Request duration in milliseconds
    """

    async def dispatch(self, request: Request, call_next):
        # Start timer
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Record metrics
        metrics.record_http_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms
        )

        return response
