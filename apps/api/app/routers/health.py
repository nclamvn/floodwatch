"""
Health & Monitoring Router
Endpoints: /health, /metrics, /scheduler/status
"""
from fastapi import APIRouter, Query, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import os

from app.database import get_db
from app.monitoring.metrics import metrics
from app.services.ingestion_scheduler import get_scheduler_status

router = APIRouter(tags=["Health & Monitoring"])

# Admin token for protected endpoints
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "dev-admin-token-123")
VERSION = "2.0.0"


def verify_admin_token(token: str = Query(..., description="Admin token")):
    """Verify admin token for protected access"""
    from fastapi import HTTPException
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing admin token")
    return True


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint with database connectivity check"""
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "service": "floodwatch-api",
        "version": VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status
    }


@router.get("/metrics")
async def get_metrics(
    token: str = Query(..., description="Admin token"),
    _: bool = Depends(verify_admin_token)
):
    """
    Prometheus metrics endpoint

    Returns application metrics in Prometheus text format:
    - HTTP request counters and durations
    - Report counters by type/source/status
    - Cron job execution counters
    - Database query performance

    Requires ADMIN_TOKEN for access
    """
    metrics_text = metrics.get_prometheus_metrics()
    return PlainTextResponse(content=metrics_text, media_type="text/plain; version=0.0.4")


@router.get("/scheduler/status")
async def scheduler_status(
    token: str = Query(..., description="Admin token"),
    _: bool = Depends(verify_admin_token)
):
    """
    Get ingestion scheduler status

    Shows which scraping jobs are running and when they will next execute.
    Requires ADMIN_TOKEN for access.
    """
    status = get_scheduler_status()

    return {
        "scheduler": {
            "running": status["running"],
            "jobs_count": len(status["jobs"])
        },
        "jobs": status["jobs"],
        "timestamp": datetime.utcnow().isoformat()
    }
