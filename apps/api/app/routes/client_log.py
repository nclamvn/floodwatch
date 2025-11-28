"""
Client Error Logging Endpoint

Receives error logs from the web frontend and stores them for analysis.
Helps track client-side errors, API failures, and user issues.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

from app.utils.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/client-log", tags=["Logging"])


class ClientLogEntry(BaseModel):
    """Client-side log entry"""
    level: Literal["error", "warning", "info"] = "error"
    message: str = Field(..., max_length=2000)
    error_type: Optional[str] = Field(None, max_length=100)
    stack_trace: Optional[str] = Field(None, max_length=5000)
    url: Optional[str] = Field(None, max_length=500)
    user_agent: Optional[str] = Field(None, max_length=500)
    timestamp: Optional[str] = None
    context: Optional[dict] = None


class ClientLogBatch(BaseModel):
    """Batch of client logs"""
    logs: List[ClientLogEntry] = Field(..., max_items=20)


@router.post("")
async def log_client_error(
    request: Request,
    log_entry: ClientLogEntry
):
    """
    Log a single client-side error

    This endpoint receives errors from the web frontend including:
    - JavaScript errors (window.onerror)
    - Unhandled promise rejections
    - API call failures
    - Map tile loading errors
    """
    # Get client info
    client_ip = _get_client_ip(request)
    server_user_agent = request.headers.get("user-agent", "unknown")

    # Build log context
    log_context = {
        "source": "client",
        "level": log_entry.level,
        "message": log_entry.message,
        "error_type": log_entry.error_type,
        "url": log_entry.url,
        "client_ip": client_ip,
        "user_agent": log_entry.user_agent or server_user_agent,
        "client_timestamp": log_entry.timestamp,
    }

    # Add stack trace if present
    if log_entry.stack_trace:
        log_context["stack_trace"] = log_entry.stack_trace[:2000]

    # Add custom context if present
    if log_entry.context:
        log_context["context"] = log_entry.context

    # Log with appropriate level
    if log_entry.level == "error":
        logger.error("client_error", **log_context)
    elif log_entry.level == "warning":
        logger.warning("client_warning", **log_context)
    else:
        logger.info("client_log", **log_context)

    return {"status": "logged", "received_at": datetime.utcnow().isoformat()}


@router.post("/batch")
async def log_client_errors_batch(
    request: Request,
    batch: ClientLogBatch
):
    """
    Log multiple client-side errors in a batch

    Useful for sending accumulated errors periodically
    """
    client_ip = _get_client_ip(request)
    server_user_agent = request.headers.get("user-agent", "unknown")

    logged_count = 0
    for log_entry in batch.logs:
        log_context = {
            "source": "client",
            "level": log_entry.level,
            "message": log_entry.message,
            "error_type": log_entry.error_type,
            "url": log_entry.url,
            "client_ip": client_ip,
            "user_agent": log_entry.user_agent or server_user_agent,
            "client_timestamp": log_entry.timestamp,
        }

        if log_entry.stack_trace:
            log_context["stack_trace"] = log_entry.stack_trace[:2000]

        if log_entry.context:
            log_context["context"] = log_entry.context

        if log_entry.level == "error":
            logger.error("client_error", **log_context)
        elif log_entry.level == "warning":
            logger.warning("client_warning", **log_context)
        else:
            logger.info("client_log", **log_context)

        logged_count += 1

    return {
        "status": "logged",
        "count": logged_count,
        "received_at": datetime.utcnow().isoformat()
    }


def _get_client_ip(request: Request) -> str:
    """Get client IP, checking for proxy headers"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip

    if request.client:
        return request.client.host

    return "unknown"
