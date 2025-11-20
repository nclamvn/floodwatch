"""
FloodWatch API - Main Application (v2 with Database)
FastAPI backend for flood monitoring system
"""
from fastapi import FastAPI, Query, HTTPException, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import os
import csv
import io

from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import database
from app.database import get_db, Report, RoadEvent, ApiKey, Subscription, Delivery, HazardEvent, HazardType, SeverityLevel, DistressReport, DistressStatus, DistressUrgency, TrafficDisruption, DisruptionType, DisruptionSeverity, AIForecast
from app.services.report_repo import ReportRepository
from app.services.road_repo import RoadEventRepository
from app.services.apikey_repo import ApiKeyRepository
from app.services.hazard_repo import HazardEventRepository
from app.services.distress_repo import DistressReportRepository
from app.services.traffic_repo import TrafficDisruptionRepository
from app.services.ai_forecast_repo import AIForecastRepository

# Import trust score calculator
from app.services.trust_score import TrustScoreCalculator

# Import API key middleware
from app.middleware.apikey_auth import require_api_key, get_api_key

# Import PII scrubbing
from app.middleware.pii_scrub import scrub_response_data

# Import monitoring/metrics
from app.monitoring.metrics import metrics
from app.middleware.metrics_middleware import MetricsMiddleware

# Import logging
from app.utils.logging_config import configure_logging, get_logger

# Import telegram handler
from app.telegram_handler import router as telegram_router

# Import ingestion scheduler
from app.services.ingestion_scheduler import start_scheduler, stop_scheduler, get_scheduler_status

# Configure logging (JSON in production, console in dev)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
configure_logging(json_logs=(ENVIRONMENT == "production"))
logger = get_logger(__name__)

# Admin token for /ops dashboard
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "dev-admin-token-123")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# App version
VERSION = "2.0.0"

# App instance
app = FastAPI(
    title="FloodWatch API",
    description="Real-time flood monitoring and alert system for Vietnam",
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Only add HSTS in production
    if os.getenv("ENVIRONMENT", "development") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Metrics middleware (records all HTTP requests)
app.add_middleware(MetricsMiddleware)

# Include routers
app.include_router(telegram_router)

# ==================== MODELS ====================

class AlertIngest(BaseModel):
    """Model for ingesting alerts from KTTV"""
    title: str
    province: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    level: str = "medium"
    source: str = "KTTV"
    description: Optional[str] = None


class CommunityReport(BaseModel):
    """Model for community reports"""
    type: Literal["SOS", "ROAD", "NEEDS"]
    text: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    province: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[str] = None
    media: List[str] = Field(default_factory=list)


class RoadEventIngest(BaseModel):
    """Model for ingesting road events"""
    segment_name: str
    status: Literal["OPEN", "CLOSED", "RESTRICTED"]
    reason: Optional[str] = None
    province: str
    district: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    last_verified: Optional[datetime] = None
    source: str = "PRESS"


class SubscriptionCreate(BaseModel):
    """Model for creating a subscription"""
    org_name: str
    provinces: List[str] = Field(default_factory=list)  # Empty = all provinces
    types: List[str] = Field(default_factory=list)  # Empty = all types
    min_trust: float = Field(0.7, ge=0.0, le=1.0)
    callback_url: str
    secret: Optional[str] = None


class HazardEventCreate(BaseModel):
    """Model for creating a hazard event"""
    type: Literal["heavy_rain", "flood", "dam_release", "landslide", "storm", "tide_surge"]
    severity: Literal["info", "low", "medium", "high", "critical"]
    lat: float = Field(ge=-90, le=90, description="Latitude")
    lon: float = Field(ge=-180, le=180, description="Longitude")
    radius_km: Optional[float] = Field(None, gt=0, le=500, description="Affected radius in km")
    starts_at: datetime = Field(description="Event start time (ISO 8601)")
    ends_at: Optional[datetime] = Field(None, description="Event end time (ISO 8601)")
    source: str = Field(description="Data source (e.g., 'KTTV', 'manual_admin')")
    external_id: Optional[str] = Field(None, description="External system ID")
    raw_payload: Optional[dict] = Field(None, description="Additional data as JSON")


class HazardEventUpdate(BaseModel):
    """Model for updating a hazard event"""
    severity: Optional[Literal["info", "low", "medium", "high", "critical"]] = None
    radius_km: Optional[float] = Field(None, gt=0, le=500)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    raw_payload: Optional[dict] = None


class AIForecastCreate(BaseModel):
    """Model for creating an AI forecast"""
    type: Literal["heavy_rain", "flood", "dam_release", "landslide", "storm", "tide_surge"]
    severity: Literal["info", "low", "medium", "high", "critical"]
    confidence: float = Field(ge=0.0, le=1.0, description="Forecast confidence (0.0-1.0)")
    lat: float = Field(ge=-90, le=90, description="Latitude")
    lon: float = Field(ge=-180, le=180, description="Longitude")
    radius_km: Optional[float] = Field(None, gt=0, le=500, description="Affected radius in km")
    forecast_time: datetime = Field(description="When the hazard is predicted to occur (ISO 8601)")
    valid_until: datetime = Field(description="When this forecast expires (ISO 8601)")
    model_name: str = Field(description="Name of the ML model")
    model_version: str = Field(description="Version of the model")
    training_data_date: Optional[datetime] = Field(None, description="Date of training data")
    summary: Optional[str] = Field(None, description="AI-generated summary text")
    predicted_intensity: Optional[float] = Field(None, description="Model-specific intensity measure")
    predicted_duration_hours: Optional[float] = Field(None, gt=0, description="Predicted duration in hours")
    risk_factors: Optional[List[str]] = Field(None, description="List of contributing risk factors")
    data_sources: Optional[List[str]] = Field(None, description="Data sources used by the model")
    raw_output: Optional[dict] = Field(None, description="Full model output")
    source: Optional[str] = Field("AI_MODEL", description="Data source identifier")


class AIForecastUpdate(BaseModel):
    """Model for updating an AI forecast"""
    severity: Optional[Literal["info", "low", "medium", "high", "critical"]] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    radius_km: Optional[float] = Field(None, gt=0, le=500)
    valid_until: Optional[datetime] = None
    summary: Optional[str] = None
    predicted_intensity: Optional[float] = None
    predicted_duration_hours: Optional[float] = Field(None, gt=0)
    risk_factors: Optional[List[str]] = None
    is_active: Optional[bool] = None
    raw_output: Optional[dict] = None


# ==================== TRUST SCORE ====================
# Trust score calculation is now handled by TrustScoreCalculator in app.services.trust_score


# ==================== ADMIN AUTH ====================

def verify_admin_token(token: Optional[str] = Query(None)):
    """Verify admin token for /ops access"""
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing admin token")
    return True


# ==================== ENDPOINTS ====================

@app.get("/health")
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


@app.get("/metrics")
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
    from fastapi.responses import PlainTextResponse

    metrics_text = metrics.get_prometheus_metrics()
    return PlainTextResponse(content=metrics_text, media_type="text/plain; version=0.0.4")


@app.get("/scheduler/status")
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


@app.post("/admin/trigger-scraper")
async def trigger_scraper_manually(
    source: str = Query(..., description="Scraper source: vnexpress, tuoitre, thanhnien, vtc, baomoi, kttv, pctt, or all"),
    token: str = Query(..., description="Admin token"),
    _: bool = Depends(verify_admin_token)
):
    """
    Manually trigger a specific scraper or all scrapers.

    Useful for testing or forcing data refresh when scheduler is paused.
    """
    from app.services.ingestion_scheduler import (
        run_vnexpress_scraper, run_tuoitre_scraper, run_thanhnien_scraper,
        run_vtc_scraper, run_baomoi_scraper, run_kttv_scraper, run_pctt_scraper
    )

    scrapers = {
        "vnexpress": run_vnexpress_scraper,
        "tuoitre": run_tuoitre_scraper,
        "thanhnien": run_thanhnien_scraper,
        "vtc": run_vtc_scraper,
        "baomoi": run_baomoi_scraper,
        "kttv": run_kttv_scraper,
        "pctt": run_pctt_scraper,
    }

    try:
        if source == "all":
            results = {}
            for name, scraper_func in scrapers.items():
                try:
                    scraper_func()
                    results[name] = "triggered"
                except Exception as e:
                    results[name] = f"error: {str(e)}"

            return {
                "status": "completed",
                "message": "All scrapers triggered",
                "results": results
            }

        elif source in scrapers:
            scrapers[source]()
            return {
                "status": "success",
                "message": f"{source} scraper triggered successfully"
            }

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid source. Must be one of: {', '.join(scrapers.keys())} or 'all'"
            )

    except Exception as e:
        logger.error("trigger_scraper_error", source=source, error=str(e))
        raise HTTPException(status_code=500, detail=f"Scraper error: {str(e)}")


@app.get("/reports")
async def get_reports(
    request: Request,
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="Filter by type (ALERT, RAIN, ROAD, SOS, NEEDS)"),
    province: Optional[str] = Query(None, description="Filter by province"),
    since: Optional[str] = Query(None, description="Filter by time (e.g., '6h', '24h', '7d')"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Get reports with optional filters

    Parameters:
    - type: Filter by report type
    - province: Filter by province name
    - since: Time filter (e.g., '6h', '24h', '7d')
    - limit: Max results per page
    - offset: Pagination offset

    Note: PII (phone numbers, emails) is scrubbed from public responses
    """
    reports, total = ReportRepository.get_all(
        db=db,
        type=type,
        province=province,
        since=since,
        limit=limit,
        offset=offset
    )

    response_data = {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": [report.to_dict() for report in reports]
    }

    # Scrub PII from public endpoint
    return scrub_response_data(response_data, request.url.path)


@app.post("/ingest/alerts")
async def ingest_alerts(alerts: List[AlertIngest], db: Session = Depends(get_db)):
    """
    Internal endpoint to ingest alerts from KTTV/NCHMF
    """
    ingested_count = 0

    # Get recent reports for multi-source agreement check
    existing_reports = ReportRepository.get_recent_for_duplicate_check(db, hours=1)
    existing_reports_dict = [r.to_dict() for r in existing_reports]

    for alert in alerts:
        # Prepare data for trust score calculation
        score_data = {
            "source": alert.source,
            "lat": alert.lat,
            "lon": alert.lon,
            "province": alert.province,
            "media": [],
            "type": "ALERT",
            "created_at": datetime.utcnow()
        }

        # Calculate trust score with multi-source agreement
        trust_score = TrustScoreCalculator.compute_score(score_data, existing_reports_dict)

        report_data = {
            "type": "ALERT",
            "source": alert.source,
            "title": alert.title,
            "description": alert.description,
            "province": alert.province,
            "district": None,
            "ward": None,
            "lat": alert.lat,
            "lon": alert.lon,
            "trust_score": trust_score,
            "media": [],
            "status": "new"
        }

        ReportRepository.create(db, report_data)
        ingested_count += 1

    return {
        "status": "success",
        "ingested": ingested_count,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/ingest/community")
@limiter.limit("30/minute")  # Rate limit: 30 requests per minute per IP
async def ingest_community(
    request: Request,
    report: CommunityReport,
    db: Session = Depends(get_db)
):
    """
    Endpoint to receive community reports from webhooks/forms
    Rate limit: 30 requests per minute per IP address
    """
    # Get recent reports for multi-source agreement and duplicate detection
    existing_reports = ReportRepository.get_recent_for_duplicate_check(db, hours=1)
    existing_reports_dict = [r.to_dict() for r in existing_reports]

    # Prepare data for trust score calculation
    score_data = {
        "source": "COMMUNITY",
        "lat": report.lat,
        "lon": report.lon,
        "province": report.province,
        "media": report.media,
        "type": report.type,
        "title": report.text,
        "created_at": datetime.utcnow()
    }

    # Calculate trust score with multi-source agreement
    trust_score = TrustScoreCalculator.compute_score(score_data, existing_reports_dict)

    # Check for duplicates
    duplicate_ids = TrustScoreCalculator.find_duplicates(score_data, existing_reports_dict)
    duplicate_of = duplicate_ids[0] if duplicate_ids else None

    report_data = {
        "type": report.type,
        "source": "COMMUNITY",
        "title": f"{report.type} Report",
        "description": report.text,
        "province": report.province,
        "district": report.district,
        "ward": report.ward,
        "lat": report.lat,
        "lon": report.lon,
        "trust_score": trust_score,
        "media": report.media,
        "status": "new",
        "duplicate_of": duplicate_of
    }

    created_report = ReportRepository.create(db, report_data)

    # Log with structured logging
    logger.info(
        "community_report_ingested",
        report_id=str(created_report.id),
        type=report.type,
        province=report.province,
        trust_score=created_report.trust_score,
        has_media=len(report.media) > 0,
        is_duplicate=duplicate_of is not None,
        duplicate_of=duplicate_of,
        ip=get_remote_address(request)
    )

    return {
        "status": "success",
        "report_id": str(created_report.id),
        "trust_score": created_report.trust_score,
        "is_duplicate": duplicate_of is not None,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/road-events")
async def get_road_events(
    db: Session = Depends(get_db),
    province: Optional[str] = Query(None, description="Filter by province"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, CLOSED, RESTRICTED)")
):
    """
    Get road event status
    """
    roads, total = RoadEventRepository.get_all(
        db=db,
        province=province,
        status=status
    )

    return {
        "total": total,
        "data": [road.to_dict() for road in roads]
    }


@app.post("/ingest/road-event")
async def ingest_road_event(
    event: RoadEventIngest,
    db: Session = Depends(get_db)
):
    """
    Endpoint to ingest road events from press watch or other sources
    Upserts based on (segment_name, province) - updates if last_verified is newer
    """
    road_data = {
        "status": event.status,
        "reason": event.reason,
        "district": event.district,
        "lat": event.lat,
        "lon": event.lon,
        "last_verified": event.last_verified or datetime.utcnow(),
        "source": event.source
    }

    # Upsert using repository method
    road = RoadEventRepository.upsert_by_segment(
        db=db,
        segment_name=event.segment_name,
        province=event.province,
        update_data=road_data
    )

    # Log with structured logging
    logger.info(
        "road_event_ingested",
        road_id=str(road.id),
        segment=event.segment_name,
        status=event.status,
        province=event.province,
        source=event.source
    )

    return {
        "status": "success",
        "road_id": str(road.id),
        "segment_name": road.segment_name,
        "timestamp": datetime.utcnow().isoformat()
    }


# ==================== OPS DASHBOARD ====================

@app.get("/ops", response_class=HTMLResponse)
async def ops_dashboard(
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """
    Ops dashboard - HTML table showing all reports with actions
    Requires ADMIN_TOKEN for access
    """
    # Get all reports, newest first
    reports, total = ReportRepository.get_all(db, limit=200, offset=0)

    # Build HTML table with mobile optimization
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>FloodWatch Ops Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            h1 { color: #333; margin-bottom: 15px; }
            .stats { background: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; background: white; }
            th { background: #2c3e50; color: white; padding: 12px; text-align: left; position: sticky; top: 0; z-index: 10; }
            td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
            tr:hover { background: #f9f9f9; }
            .status-new { color: #e67e22; font-weight: bold; }
            .status-verified { color: #27ae60; font-weight: bold; }
            .status-merged { color: #3498db; font-weight: bold; }
            .status-resolved { color: #95a5a6; }
            .status-invalid { color: #e74c3c; }
            .score-high { color: #27ae60; font-weight: bold; }
            .score-medium { color: #f39c12; }
            .score-low { color: #e74c3c; }
            .actions { white-space: nowrap; }
            .actions form { display: inline; margin-right: 5px; }
            .btn { padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 500; transition: opacity 0.2s; }
            .btn:active { opacity: 0.7; }
            .btn-verify { background: #27ae60; color: white; }
            .btn-resolve { background: #3498db; color: white; }
            .btn-invalid { background: #e74c3c; color: white; }
            .btn-merge { background: #9b59b6; color: white; }
            .media-count { color: #8e44ad; }
            .duplicate-badge { background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }

            /* Mobile optimization */
            @media (max-width: 768px) {
                body { padding: 10px; }
                h1 { font-size: 20px; }
                .stats { padding: 10px; font-size: 14px; }

                /* Hide less critical columns on mobile */
                th:nth-child(1), td:nth-child(1), /* ID */
                th:nth-child(4), td:nth-child(4), /* Source */
                th:nth-child(8), td:nth-child(8), /* Media */
                th:nth-child(9), td:nth-child(9)  /* Duplicate */
                { display: none; }

                /* Larger tap targets for buttons */
                .btn {
                    min-height: 44px;
                    min-width: 44px;
                    padding: 10px 14px;
                    font-size: 14px;
                    margin-bottom: 5px;
                }

                .actions form { display: block; margin-bottom: 5px; }
                td { font-size: 14px; }
            }
        </style>
        <script>
            function confirmAction(action, reportId) {
                const messages = {
                    'resolve': 'Resolve this report? This marks the issue as fixed.',
                    'merge': 'Merge this report? This will mark it as duplicate.',
                    'invalidate': 'Mark this report as invalid? This action can affect trust scores.'
                };
                return confirm(messages[action] || 'Confirm this action?');
            }
        </script>
    </head>
    <body>
        <h1>🛠️ FloodWatch Ops Dashboard</h1>
        <div class="stats">
            <strong>Total Reports:</strong> {total} |
            <strong>Showing:</strong> {count} |
            <strong>Refresh:</strong> <a href="/ops?token={token}">Reload</a>
        </div>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Province</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Media</th>
                    <th>Duplicate</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    """.format(total=total, count=len(reports), token=token)

    for report in reports:
        # Format trust score
        score_class = "score-high" if report.trust_score >= 0.7 else "score-medium" if report.trust_score >= 0.4 else "score-low"
        score_display = f'<span class="{score_class}">{report.trust_score:.2f}</span>'

        # Format status
        status_class = f"status-{report.status}"
        status_display = f'<span class="{status_class}">{report.status.upper()}</span>'

        # Format media
        media_count = len(report.media) if report.media else 0
        media_display = f'<span class="media-count">{media_count} 📷</span>' if media_count > 0 else '-'

        # Format duplicate
        duplicate_display = f'<span class="duplicate-badge">DUP</span>' if report.duplicate_of else '-'

        # Format time
        time_str = report.created_at.strftime("%m/%d %H:%M") if report.created_at else "-"

        # Actions
        actions_html = ""
        if report.status == "new":
            actions_html += f'''
                <form method="post" action="/ops/verify/{report.id}?token={token}">
                    <button class="btn btn-verify" type="submit">Verify</button>
                </form>
            '''
        if report.status in ["new", "verified"]:
            actions_html += f'''
                <form method="post" action="/ops/resolve/{report.id}?token={token}" onsubmit="return confirmAction('resolve', '{report.id}')">
                    <button class="btn btn-resolve" type="submit">Resolve</button>
                </form>
            '''
        if report.status not in ["invalid", "resolved"]:
            actions_html += f'''
                <form method="post" action="/ops/invalidate/{report.id}?token={token}" onsubmit="return confirmAction('invalidate', '{report.id}')">
                    <button class="btn btn-invalid" type="submit">Invalid</button>
                </form>
            '''

        html += f"""
            <tr>
                <td><small>{str(report.id)[:8]}...</small></td>
                <td>{time_str}</td>
                <td><strong>{report.type.value if hasattr(report.type, 'value') else report.type}</strong></td>
                <td>{report.source}</td>
                <td>{report.province or '-'}</td>
                <td>{score_display}</td>
                <td>{status_display}</td>
                <td>{media_display}</td>
                <td>{duplicate_display}</td>
                <td class="actions">{actions_html}</td>
            </tr>
        """

    html += """
            </tbody>
        </table>
    </body>
    </html>
    """

    return html


@app.post("/ops/verify/{report_id}")
async def ops_verify_report(
    report_id: str,
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Verify a report (set status to 'verified')"""
    from uuid import UUID

    try:
        report_uuid = UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    report = ReportRepository.update(db, report_uuid, {"status": "verified"})

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    logger.info("report_verified", report_id=report_id, admin_action=True)

    return RedirectResponse(url=f"/ops?token={token}", status_code=303)


@app.post("/ops/resolve/{report_id}")
async def ops_resolve_report(
    report_id: str,
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Resolve a report (set status to 'resolved')"""
    from uuid import UUID

    try:
        report_uuid = UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    report = ReportRepository.update(db, report_uuid, {"status": "resolved"})

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    logger.info("report_resolved", report_id=report_id, admin_action=True)

    return RedirectResponse(url=f"/ops?token={token}", status_code=303)


@app.post("/ops/invalidate/{report_id}")
async def ops_invalidate_report(
    report_id: str,
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Mark a report as invalid"""
    from uuid import UUID

    try:
        report_uuid = UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    report = ReportRepository.update(db, report_uuid, {"status": "invalid"})

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    logger.info("report_invalidated", report_id=report_id, admin_action=True)

    return RedirectResponse(url=f"/ops?token={token}", status_code=303)


@app.post("/ops/merge")
async def ops_merge_reports(
    source_id: str = Form(...),
    target_id: str = Form(...),
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Merge source report into target (mark source as duplicate)"""
    from uuid import UUID

    try:
        source_uuid = UUID(source_id)
        target_uuid = UUID(target_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    # Update source report to mark as merged and point to target
    source_report = ReportRepository.update(db, source_uuid, {
        "status": "merged",
        "duplicate_of": target_uuid
    })

    if not source_report:
        raise HTTPException(status_code=404, detail="Source report not found")

    logger.info("reports_merged", source_id=source_id, target_id=target_id, admin_action=True)

    return RedirectResponse(url=f"/ops?token={token}", status_code=303)


# ==================== API DOCUMENTATION ====================

@app.get("/api-docs", response_class=HTMLResponse)
async def api_documentation():
    """
    Static API documentation page
    Shows how to obtain and use API keys
    """
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>FloodWatch API Documentation</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f8f9fa; }
            .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
            header { background: #2c3e50; color: white; padding: 30px 20px; text-align: center; }
            h1 { margin: 0; font-size: 2.5em; }
            .subtitle { margin-top: 10px; opacity: 0.9; }
            .section { background: white; margin: 30px 0; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            code { background: #ecf0f1; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
            pre { background: #2c3e50; color: #ecf0f1; padding: 20px; border-radius: 5px; overflow-x: auto; }
            .endpoint { background: #e8f4f8; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; border-radius: 4px; }
            .method { display: inline-block; background: #27ae60; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold; margin-right: 10px; }
            .param { margin: 10px 0; padding-left: 20px; }
            .param-name { font-weight: bold; color: #e74c3c; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { text-align: left; padding: 12px; border: 1px solid #ddd; }
            th { background: #34495e; color: white; }
            .note { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; border-radius: 4px; }
        </style>
    </head>
    <body>
        <header>
            <h1>📡 FloodWatch API</h1>
            <div class="subtitle">Programmatic access to flood monitoring data</div>
        </header>

        <div class="container">
            <!-- Getting Started -->
            <div class="section">
                <h2>🚀 Getting Started</h2>
                <p>The FloodWatch API provides programmatic access to real-time flood monitoring data for Vietnam.</p>

                <h3>1. Obtain an API Key</h3>
                <p>Contact the FloodWatch team to request an API key. Include:</p>
                <ul>
                    <li>Organization name</li>
                    <li>Use case description</li>
                    <li>Expected request volume</li>
                </ul>

                <div class="note">
                    <strong>⚠️ Note:</strong> API keys are required for all <code>/api/v1/*</code> endpoints. Keep your key secure and do not share it publicly.
                </div>

                <h3>2. Authentication</h3>
                <p>Include your API key in the <code>X-API-Key</code> header with every request:</p>
                <pre>X-API-Key: your_api_key_here</pre>
            </div>

            <!-- Rate Limits -->
            <div class="section">
                <h2>⏱️ Rate Limits</h2>
                <table>
                    <tr>
                        <th>Tier</th>
                        <th>Rate Limit</th>
                        <th>Notes</th>
                    </tr>
                    <tr>
                        <td>Standard</td>
                        <td>120 requests/minute</td>
                        <td>Default for all API keys</td>
                    </tr>
                    <tr>
                        <td>IP-based (no key)</td>
                        <td>30 requests/minute</td>
                        <td>Public endpoints only</td>
                    </tr>
                </table>

                <p>Rate limit headers included in responses:</p>
                <pre>X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1635724800</pre>
            </div>

            <!-- Endpoints -->
            <div class="section">
                <h2>🔌 Endpoints</h2>

                <!-- GET /api/v1/reports -->
                <div class="endpoint">
                    <span class="method">GET</span>
                    <code>/api/v1/reports</code>
                    <p>Retrieve flood reports with optional filters</p>

                    <h4>Query Parameters</h4>
                    <div class="param">
                        <span class="param-name">type</span> (optional): Filter by type - <code>ALERT</code>, <code>SOS</code>, <code>ROAD</code>, <code>NEEDS</code>
                    </div>
                    <div class="param">
                        <span class="param-name">province</span> (optional): Filter by province name (e.g., <code>Quảng Bình</code>)
                    </div>
                    <div class="param">
                        <span class="param-name">since</span> (optional): Time filter - <code>6h</code>, <code>24h</code>, <code>7d</code>
                    </div>
                    <div class="param">
                        <span class="param-name">min_trust</span> (optional): Minimum trust score (0.0 to 1.0)
                    </div>
                    <div class="param">
                        <span class="param-name">limit</span> (optional): Max results (1-200, default 50)
                    </div>
                    <div class="param">
                        <span class="param-name">offset</span> (optional): Pagination offset (default 0)
                    </div>

                    <h4>Example Request</h4>
                    <pre>curl -X GET "https://api.floodwatch.vn/api/v1/reports?province=Quảng%20Nam&since=6h&min_trust=0.7" \\
  -H "X-API-Key: your_api_key_here"</pre>

                    <h4>Example Response</h4>
                    <pre>{
  "total": 15,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": "a3f5c7e9-1234-5678-90ab-cdef12345678",
      "created_at": "2025-10-31T10:30:45.123456Z",
      "type": "SOS",
      "source": "COMMUNITY",
      "title": "SOS Report",
      "province": "Quảng Nam",
      "lat": 15.5697,
      "lon": 108.4746,
      "trust_score": 0.75,
      "status": "new"
    }
  ]
}</pre>
                </div>

                <!-- GET /api/v1/road-events -->
                <div class="endpoint">
                    <span class="method">GET</span>
                    <code>/api/v1/road-events</code>
                    <p>Retrieve road status information</p>

                    <h4>Query Parameters</h4>
                    <div class="param">
                        <span class="param-name">province</span> (optional): Filter by province name
                    </div>
                    <div class="param">
                        <span class="param-name">status</span> (optional): Filter by status - <code>OPEN</code>, <code>CLOSED</code>, <code>RESTRICTED</code>
                    </div>

                    <h4>Example Request</h4>
                    <pre>curl -X GET "https://api.floodwatch.vn/api/v1/road-events?status=CLOSED" \\
  -H "X-API-Key: your_api_key_here"</pre>

                    <h4>Example Response</h4>
                    <pre>{
  "total": 3,
  "data": [
    {
      "id": "b7d8e2f1-5678-90ab-cdef-123456789abc",
      "segment_name": "QL1A",
      "status": "CLOSED",
      "reason": "Sạt lở nghiêm trọng",
      "province": "Quảng Trị",
      "last_verified": "2025-10-31T09:15:30.123456Z",
      "source": "PRESS"
    }
  ]
}</pre>
                </div>
            </div>

            <!-- Response Codes -->
            <div class="section">
                <h2>📋 HTTP Status Codes</h2>
                <table>
                    <tr>
                        <th>Code</th>
                        <th>Description</th>
                    </tr>
                    <tr>
                        <td><code>200</code></td>
                        <td>Success - Request completed successfully</td>
                    </tr>
                    <tr>
                        <td><code>400</code></td>
                        <td>Bad Request - Invalid parameters</td>
                    </tr>
                    <tr>
                        <td><code>401</code></td>
                        <td>Unauthorized - Invalid or missing API key</td>
                    </tr>
                    <tr>
                        <td><code>429</code></td>
                        <td>Rate Limit Exceeded - Too many requests</td>
                    </tr>
                    <tr>
                        <td><code>500</code></td>
                        <td>Internal Server Error - Contact support</td>
                    </tr>
                </table>
            </div>

            <!-- Support -->
            <div class="section">
                <h2>💬 Support</h2>
                <p>For API support, feature requests, or to report issues:</p>
                <ul>
                    <li><strong>Email:</strong> api@floodwatch.vn</li>
                    <li><strong>GitHub:</strong> <a href="https://github.com/floodwatch">github.com/floodwatch</a></li>
                </ul>
            </div>
        </div>
    </body>
    </html>
    """
    return html


# ==================== PUBLIC API (v1) ====================

@app.get("/api/v1/reports")
@limiter.limit("120/minute")
async def api_v1_get_reports(
    request: Request,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(require_api_key),
    type: Optional[str] = Query(None, description="Filter by type (ALERT, RAIN, ROAD, SOS, NEEDS)"),
    province: Optional[str] = Query(None, description="Filter by province"),
    since: Optional[str] = Query(None, description="Time filter (e.g., '6h', '24h', '7d')"),
    min_trust: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum trust score"),
    limit: int = Query(50, ge=1, le=200, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Public API endpoint to get reports (requires API key)

    Rate limit: 120 requests per minute per API key

    Returns reports in JSON format with filtering options

    Note: PII (phone numbers, emails) is scrubbed from responses
    """
    # Get reports with filters
    reports, total = ReportRepository.get_all(
        db=db,
        type=type,
        province=province,
        since=since,
        limit=limit,
        offset=offset
    )

    # Apply trust score filter if provided
    if min_trust is not None:
        reports = [r for r in reports if r.trust_score >= min_trust]
        total = len(reports)

    # Log API usage
    logger.info(
        "api_v1_reports_accessed",
        api_key_id=str(api_key.id),
        api_key_name=api_key.name,
        filters={
            "type": type,
            "province": province,
            "since": since,
            "min_trust": min_trust
        },
        results_count=len(reports)
    )

    response_data = {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": [report.to_dict() for report in reports]
    }

    # Scrub PII from public API
    return scrub_response_data(response_data, request.url.path)


@app.get("/api/v1/road-events")
@limiter.limit("120/minute")
async def api_v1_get_road_events(
    request: Request,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(require_api_key),
    province: Optional[str] = Query(None, description="Filter by province"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, CLOSED, RESTRICTED)")
):
    """
    Public API endpoint to get road events (requires API key)

    Rate limit: 120 requests per minute per API key

    Returns road events with current status
    """
    roads, total = RoadEventRepository.get_all(
        db=db,
        province=province,
        status=status
    )

    # Log API usage
    logger.info(
        "api_v1_road_events_accessed",
        api_key_id=str(api_key.id),
        api_key_name=api_key.name,
        filters={
            "province": province,
            "status": status
        },
        results_count=len(roads)
    )

    return {
        "total": total,
        "data": [road.to_dict() for road in roads]
    }


# ==================== LITE MODE & CSV EXPORT ====================

@app.get("/reports/today", response_class=HTMLResponse)
async def daily_report_preview(
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None, description="Optional admin token for PII access")
):
    """
    Daily Report Preview - Shows today's reports in printable format

    This is the same view that gets exported to PDF daily at 23:55.
    Useful for previewing before PDF generation or manual print.
    """
    from datetime import datetime

    # Get today's reports
    reports, total = ReportRepository.get_all(
        db=db,
        since="24h",
        limit=1000,
        offset=0
    )

    date_str = datetime.now().strftime("%Y-%m-%d")

    # Generate HTML (same as PDF snapshot)
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FloodWatch Daily Report - {date_str}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 11pt; }}
            h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
            h2 {{ color: #34495e; margin-top: 20px; }}
            .summary {{ background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
            .summary table {{ width: 100%; }}
            .summary td {{ padding: 5px; }}
            table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
            th {{ background: #34495e; color: white; padding: 10px; text-align: left; position: sticky; top: 0; }}
            td {{ padding: 8px; border-bottom: 1px solid #ddd; font-size: 9pt; }}
            tr:nth-child(even) {{ background: #f8f9fa; }}
            .type-sos {{ color: #e74c3c; font-weight: bold; }}
            .type-alert {{ color: #e67e22; font-weight: bold; }}
            .type-road {{ color: #f39c12; font-weight: bold; }}
            .status-new {{ color: #e67e22; }}
            .status-verified {{ color: #27ae60; font-weight: bold; }}
            .status-resolved {{ color: #95a5a6; }}
            .footer {{ margin-top: 30px; text-align: center; font-size: 9pt; color: #7f8c8d; border-top: 1px solid #bdc3c7; padding-top: 10px; }}
            @media print {{
                .no-print {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <h1>🌊 FloodWatch Daily Report</h1>
        <p><strong>Date:</strong> {date_str}</p>
        <p><strong>Generated:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>

        <p class="no-print"><a href="/reports/today?token={token}" onclick="window.print(); return false;">📄 Print / Save as PDF</a></p>

        <div class="summary">
            <h2>Summary</h2>
            <table>
                <tr>
                    <td><strong>Total Reports:</strong></td>
                    <td>{total}</td>
                    <td><strong>SOS Reports:</strong></td>
                    <td>{sum(1 for r in reports if r.type.value == "SOS")}</td>
                </tr>
                <tr>
                    <td><strong>Official Alerts:</strong></td>
                    <td>{sum(1 for r in reports if r.type.value == "ALERT")}</td>
                    <td><strong>Road Events:</strong></td>
                    <td>{sum(1 for r in reports if r.type.value == "ROAD")}</td>
                </tr>
                <tr>
                    <td><strong>Verified:</strong></td>
                    <td>{sum(1 for r in reports if r.status == "verified")}</td>
                    <td><strong>Resolved:</strong></td>
                    <td>{sum(1 for r in reports if r.status == "resolved")}</td>
                </tr>
            </table>
        </div>

        <h2>All Reports</h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 12%">Time</th>
                    <th style="width: 8%">Type</th>
                    <th style="width: 10%">Source</th>
                    <th style="width: 15%">Province</th>
                    <th style="width: 40%">Title</th>
                    <th style="width: 8%">Score</th>
                    <th style="width: 7%">Status</th>
                </tr>
            </thead>
            <tbody>
    """

    # Add reports
    for report in reports:
        time_str = report.created_at.strftime("%H:%M") if report.created_at else "-"
        type_class = f"type-{report.type.value.lower()}"
        type_display = report.type.value
        status_class = f"status-{report.status}"
        title = report.title[:60] + "..." if len(report.title) > 60 else report.title

        html += f"""
                <tr>
                    <td>{time_str}</td>
                    <td class="{type_class}">{type_display}</td>
                    <td>{report.source}</td>
                    <td>{report.province or '-'}</td>
                    <td>{title}</td>
                    <td>{report.trust_score:.2f}</td>
                    <td class="{status_class}">{report.status}</td>
                </tr>
        """

    html += """
            </tbody>
        </table>

        <div class="footer">
            <p>FloodWatch - Vietnam Flood Monitoring System</p>
            <p>This report is generated automatically daily at 23:55</p>
        </div>
    </body>
    </html>
    """

    return html


@app.get("/lite", response_class=HTMLResponse)
async def lite_mode(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="Filter by type"),
    province: Optional[str] = Query(None, description="Filter by province"),
    since: Optional[str] = Query("24h", description="Time filter (default 24h)")
):
    """
    Lite mode - Simple HTML table without JavaScript
    Useful for low-bandwidth or print scenarios
    """
    # Get reports with filters
    reports, total = ReportRepository.get_all(
        db=db,
        type=type,
        province=province,
        since=since,
        limit=100,
        offset=0
    )

    # Build simple HTML with mobile optimization
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>FloodWatch - Lite Mode</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; max-width: 1200px; font-size: 16px; }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 15px; }
            .filters { background: #ecf0f1; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            .filters a { margin-right: 15px; text-decoration: none; color: #2980b9; display: inline-block; padding: 5px 0; }
            .filters a:hover { text-decoration: underline; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #34495e; color: white; padding: 12px; text-align: left; border: 1px solid #2c3e50; position: sticky; top: 0; z-index: 10; }
            td { padding: 10px; border: 1px solid #bdc3c7; font-size: 14px; }
            tr:nth-child(even) { background: #f8f9fa; }
            .type-sos { color: #e74c3c; font-weight: bold; }
            .type-alert { color: #e67e22; font-weight: bold; }
            .type-road { color: #f39c12; font-weight: bold; }
            .score { font-weight: bold; }
            .export { margin-top: 20px; padding: 10px; background: #d5f4e6; border-radius: 5px; }

            /* Mobile optimization */
            @media (max-width: 768px) {
                body { padding: 10px; font-size: 14px; }
                h1 { font-size: 20px; }
                .filters { padding: 10px; }
                .filters a { margin-right: 10px; font-size: 14px; }

                /* Convert table to card layout on mobile */
                table, thead, tbody, th, td, tr { display: block; }
                thead tr { position: absolute; top: -9999px; left: -9999px; }
                tr {
                    margin-bottom: 15px;
                    border: 1px solid #bdc3c7;
                    border-radius: 8px;
                    background: white;
                    padding: 0;
                    overflow: hidden;
                }
                td {
                    border: none;
                    border-bottom: 1px solid #ecf0f1;
                    position: relative;
                    padding: 12px 12px 12px 45%;
                    text-align: left;
                    font-size: 15px;
                }
                td:last-child { border-bottom: 0; }
                td::before {
                    content: attr(data-label);
                    position: absolute;
                    left: 10px;
                    width: 40%;
                    font-weight: bold;
                    color: #34495e;
                    font-size: 14px;
                }
            }

            @media print {
                .filters, .export { display: none; }
            }
        </style>
    </head>
    <body>
        <h1>FloodWatch - Lite Mode</h1>
        <div class="filters">
            <strong>Filters:</strong>
            <a href="/lite">All</a> |
            <a href="/lite?since=6h">Last 6h</a> |
            <a href="/lite?since=24h">Last 24h</a> |
            <a href="/lite?since=7d">Last 7d</a>
            <br><strong>By Type:</strong>
            <a href="/lite?type=SOS">SOS</a> |
            <a href="/lite?type=ALERT">Alerts</a> |
            <a href="/lite?type=ROAD">Road</a>
        </div>
        <p><strong>Total Reports:</strong> {total} | <strong>Showing:</strong> {count}</p>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Province</th>
                    <th>District</th>
                    <th>Title</th>
                    <th>Score</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    """.format(total=total, count=len(reports))

    for report in reports:
        time_str = report.created_at.strftime("%Y-%m-%d %H:%M") if report.created_at else "-"
        type_class = f"type-{report.type.value.lower() if hasattr(report.type, 'value') else report.type.lower()}"
        type_display = report.type.value if hasattr(report.type, 'value') else report.type
        title_text = report.title[:80] + "..." if len(report.title) > 80 else report.title

        html += f"""
            <tr>
                <td data-label="Time">{time_str}</td>
                <td data-label="Type" class="{type_class}">{type_display}</td>
                <td data-label="Source">{report.source}</td>
                <td data-label="Province">{report.province or '-'}</td>
                <td data-label="District">{report.district or '-'}</td>
                <td data-label="Title">{title_text}</td>
                <td data-label="Score" class="score">{report.trust_score:.2f}</td>
                <td data-label="Status">{report.status}</td>
            </tr>
        """

    # Build export URL with current filters
    export_params = []
    if type:
        export_params.append(f"type={type}")
    if province:
        export_params.append(f"province={province}")
    if since:
        export_params.append(f"since={since}")
    export_url = "/reports/export?format=csv&" + "&".join(export_params) if export_params else "/reports/export?format=csv"

    html += f"""
            </tbody>
        </table>
        <div class="export">
            <strong>📥 Export:</strong>
            <a href="{export_url}" download>Download as CSV</a>
        </div>
    </body>
    </html>
    """

    return html


@app.get("/reports/export")
async def export_reports(
    db: Session = Depends(get_db),
    format: str = Query("csv", description="Export format (csv)"),
    type: Optional[str] = Query(None, description="Filter by type"),
    province: Optional[str] = Query(None, description="Filter by province"),
    since: Optional[str] = Query(None, description="Time filter")
):
    """
    Export reports to CSV format
    """
    if format != "csv":
        raise HTTPException(status_code=400, detail="Only CSV format is supported")

    # Get reports with filters
    reports, total = ReportRepository.get_all(
        db=db,
        type=type,
        province=province,
        since=since,
        limit=1000,  # Max 1000 for export
        offset=0
    )

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "ID",
        "Created At",
        "Type",
        "Source",
        "Title",
        "Description",
        "Province",
        "District",
        "Ward",
        "Latitude",
        "Longitude",
        "Trust Score",
        "Status",
        "Media Count",
        "Duplicate Of"
    ])

    # Write data rows
    for report in reports:
        writer.writerow([
            str(report.id),
            report.created_at.isoformat() if report.created_at else "",
            report.type.value if hasattr(report.type, 'value') else report.type,
            report.source,
            report.title,
            report.description or "",
            report.province or "",
            report.district or "",
            report.ward or "",
            report.lat or "",
            report.lon or "",
            report.trust_score,
            report.status,
            len(report.media) if report.media else 0,
            str(report.duplicate_of) if report.duplicate_of else ""
        ])

    # Prepare response
    output.seek(0)
    filename = f"floodwatch_reports_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# ==================== SUBSCRIPTIONS & DELIVERIES ====================

@app.post("/subscriptions")
async def create_subscription(
    subscription: SubscriptionCreate,
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """
    Create a new alert subscription (requires ADMIN_TOKEN)

    Subscriptions receive webhooks when reports match filters:
    - provinces: List of provinces to monitor (empty = all)
    - types: List of report types to monitor (empty = all)
    - min_trust: Minimum trust score (0.0 to 1.0)
    - callback_url: Webhook URL to POST alerts
    - secret: Optional HMAC secret for signature verification
    """
    new_subscription = Subscription(
        org_name=subscription.org_name,
        provinces=subscription.provinces,
        types=subscription.types,
        min_trust=subscription.min_trust,
        callback_url=subscription.callback_url,
        secret=subscription.secret
    )

    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    logger.info(
        "subscription_created",
        subscription_id=str(new_subscription.id),
        org_name=subscription.org_name,
        admin_action=True
    )

    return {
        "status": "success",
        "subscription": new_subscription.to_dict()
    }


@app.get("/subscriptions")
async def list_subscriptions(
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """
    List all subscriptions (requires ADMIN_TOKEN)
    """
    subscriptions = db.query(Subscription).order_by(Subscription.created_at.desc()).all()

    return {
        "total": len(subscriptions),
        "data": [sub.to_dict() for sub in subscriptions]
    }


@app.get("/deliveries")
async def list_deliveries(
    token: str = Query(..., description="Admin token"),
    db: Session = Depends(get_db),
    since: Optional[str] = Query("24h", description="Time filter (e.g., '6h', '24h', '7d')"),
    status: Optional[str] = Query(None, description="Filter by status (pending, sent, failed)"),
    _: bool = Depends(verify_admin_token)
):
    """
    List alert deliveries (requires ADMIN_TOKEN)
    """
    query = db.query(Delivery)

    # Apply time filter
    if since:
        from app.services.report_repo import ReportRepository
        cutoff = ReportRepository._parse_time_filter(since)
        if cutoff:
            query = query.filter(Delivery.created_at >= cutoff)

    # Apply status filter
    if status:
        query = query.filter(Delivery.status == status)

    deliveries = query.order_by(Delivery.created_at.desc()).limit(100).all()

    return {
        "total": len(deliveries),
        "data": [delivery.to_dict() for delivery in deliveries]
    }


# ==================== HAZARD EVENTS ====================

@app.get("/hazards")
@limiter.limit("100/minute")
async def get_hazards(
    request: Request,
    db: Session = Depends(get_db),
    types: Optional[str] = Query(None, description="Comma-separated hazard types (e.g., 'flood,heavy_rain')"),
    severity: Optional[str] = Query(None, description="Comma-separated severity levels (e.g., 'high,critical')"),
    active_only: bool = Query(True, description="Only return active or upcoming events"),
    lat: Optional[float] = Query(None, ge=-90, le=90, description="User latitude for spatial filter"),
    lng: Optional[float] = Query(None, ge=-180, le=180, description="User longitude for spatial filter"),
    radius_km: Optional[float] = Query(10, gt=0, le=100, description="Search radius in km"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("starts_at", description="Sort field: 'distance', 'severity', 'starts_at'")
):
    """
    Get hazard events with optional filters

    Supports spatial filtering (find events near a location), type filtering,
    severity filtering, and time-based filtering.
    """
    # Parse types
    hazard_types = types.split(',') if types else None

    # Parse severity levels
    severity_levels = severity.split(',') if severity else None

    # Get hazards from repository
    hazards, total, distances = HazardEventRepository.get_all(
        db=db,
        hazard_types=hazard_types,
        severity=severity_levels,
        active_only=active_only,
        lat=lat,
        lng=lng,
        radius_km=radius_km if (lat and lng) else None,
        limit=limit,
        offset=offset,
        sort_by=sort
    )

    # Convert to dict and add distance if spatial query
    data = []
    for i, hazard in enumerate(hazards):
        hazard_dict = hazard.to_dict()
        if lat and lng and i < len(distances):
            hazard_dict['distance_km'] = round(distances[i], 2)
        data.append(hazard_dict)

    return {
        "data": data,
        "pagination": {
            "page": (offset // limit) + 1,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@app.get("/hazards/{hazard_id}")
@limiter.limit("100/minute")
async def get_hazard(
    request: Request,
    hazard_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a single hazard event by ID
    """
    from uuid import UUID
    try:
        hazard = HazardEventRepository.get_by_id(db, UUID(hazard_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hazard ID format")

    if not hazard:
        raise HTTPException(status_code=404, detail=f"Hazard event not found: {hazard_id}")

    return {
        "data": hazard.to_dict()
    }


@app.post("/hazards")
@limiter.limit("10/minute")
async def create_hazard(
    request: Request,
    hazard_data: HazardEventCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new hazard event

    This endpoint is for creating hazard events from external sources (KTTV, scrapers)
    or manual admin input. Future: require authentication for manual creation.
    """
    # Convert Pydantic model to dict
    data = hazard_data.dict()

    # Create hazard
    hazard = HazardEventRepository.create(db, data)

    logger.info(f"Created hazard event: {hazard.id} (type={hazard.type.value}, severity={hazard.severity.value})")

    return {
        "data": hazard.to_dict(),
        "meta": {
            "message": "Hazard event created successfully"
        }
    }


@app.patch("/hazards/{hazard_id}")
@limiter.limit("20/minute")
async def update_hazard(
    request: Request,
    hazard_id: str,
    update_data: HazardEventUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a hazard event

    Allows updating severity, time range, radius, and raw payload.
    Future: require authentication.
    """
    from uuid import UUID
    try:
        hazard_uuid = UUID(hazard_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hazard ID format")

    # Get update data (exclude None values)
    data = {k: v for k, v in update_data.dict().items() if v is not None}

    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Update hazard
    hazard = HazardEventRepository.update(db, hazard_uuid, data)

    if not hazard:
        raise HTTPException(status_code=404, detail=f"Hazard event not found: {hazard_id}")

    logger.info(f"Updated hazard event: {hazard.id}")

    return {
        "data": hazard.to_dict(),
        "meta": {
            "message": "Hazard event updated successfully",
            "updated_fields": list(data.keys())
        }
    }


@app.delete("/hazards/{hazard_id}")
@limiter.limit("10/minute")
async def delete_hazard(
    request: Request,
    hazard_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a hazard event

    Future: require authentication.
    """
    from uuid import UUID
    try:
        hazard_uuid = UUID(hazard_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hazard ID format")

    success = HazardEventRepository.delete(db, hazard_uuid)

    if not success:
        raise HTTPException(status_code=404, detail=f"Hazard event not found: {hazard_id}")

    logger.info(f"Deleted hazard event: {hazard_id}")

    return {
        "data": {
            "id": hazard_id,
            "deleted": True
        },
        "meta": {
            "message": "Hazard event deleted successfully"
        }
    }


# ============================================================================
# EMERGENCY ENDPOINTS - Distress Reports & Traffic Disruptions
# ============================================================================

# Pydantic models for distress reports
class DistressReportCreate(BaseModel):
    """Model for creating a distress report"""
    lat: float = Field(ge=-90, le=90, description="Latitude")
    lon: float = Field(ge=-180, le=180, description="Longitude")
    urgency: Literal["critical", "high", "medium", "low"]
    description: str = Field(min_length=10, description="Description of emergency situation")
    num_people: int = Field(default=1, ge=1, description="Number of people needing rescue")
    has_injuries: bool = Field(default=False)
    has_children: bool = Field(default=False)
    has_elderly: bool = Field(default=False)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=20)
    media_urls: Optional[List[str]] = Field(None, description="Array of image/video URLs")
    source: str = Field(default="user_report", max_length=50)


class DistressReportUpdate(BaseModel):
    """Model for updating a distress report (admin only)"""
    status: Optional[Literal["pending", "acknowledged", "in_progress", "resolved", "false_alarm"]] = None
    admin_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    verified: Optional[bool] = None
    verified_by: Optional[str] = None


# Pydantic models for traffic disruptions
class TrafficDisruptionCreate(BaseModel):
    """Model for creating a traffic disruption"""
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    type: Literal["flooded_road", "landslide", "bridge_collapsed", "bridge_flooded", "traffic_jam", "road_damaged", "blocked"]
    severity: Literal["impassable", "dangerous", "slow", "warning"]
    location_description: str = Field(min_length=10, description="Description of location")
    road_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    estimated_clearance: Optional[datetime] = None
    alternative_route: Optional[str] = None
    source: str = Field(description="Data source")
    hazard_event_id: Optional[str] = Field(None, description="Related hazard event UUID")
    media_urls: Optional[List[str]] = None


@app.post("/distress")
@limiter.limit("5/hour")
async def create_distress_report(
    request: Request,
    report_data: DistressReportCreate,
    db: Session = Depends(get_db)
):
    """
    Submit an emergency distress report / rescue request

    Rate limit: 5 requests per hour per IP (prevent spam but allow updates)
    """
    # Validate Vietnamese phone number format (optional)
    if report_data.contact_phone:
        import re
        if not re.match(r'^0\d{9}$', report_data.contact_phone):
            raise HTTPException(
                status_code=400,
                detail="Invalid Vietnamese phone number format. Should be 10 digits starting with 0."
            )

    # Create distress report
    data = report_data.dict()
    report = DistressReportRepository.create(db, data)

    logger.info(f"Created distress report: {report.id} (urgency={report.urgency.value}, lat={report.lat}, lon={report.lon})")

    return {
        "data": report.to_dict(),
        "meta": {
            "message": "Báo cáo khẩn cấp đã được tiếp nhận. Lực lượng cứu hộ sẽ liên hệ sớm nhất.",
            "tracking_code": f"DIST-{datetime.utcnow().strftime('%Y%m%d')}-{str(report.id)[:8].upper()}"
        }
    }


@app.get("/distress")
@limiter.limit("60/minute")
async def get_distress_reports(
    request: Request,
    lat: Optional[float] = Query(None, description="Latitude for spatial filtering"),
    lon: Optional[float] = Query(None, description="Longitude for spatial filtering"),
    radius_km: Optional[float] = Query(10, description="Search radius in km"),
    status: Optional[str] = Query(None, description="Comma-separated status list (pending,in_progress,etc)"),
    urgency: Optional[str] = Query(None, description="Comma-separated urgency list (critical,high,etc)"),
    verified_only: bool = Query(False, description="Only return verified reports"),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get distress reports with optional spatial and status filtering
    """
    # Parse comma-separated filters
    statuses = status.split(',') if status else ['pending', 'acknowledged', 'in_progress']
    urgencies = urgency.split(',') if urgency else None

    if lat is not None and lon is not None:
        # Spatial query
        reports, distances = DistressReportRepository.get_nearby(
            db, lat, lon, radius_km,
            statuses=statuses,
            urgencies=urgencies,
            limit=limit
        )

        # Add distance to each report
        data = []
        for report, dist in zip(reports, distances):
            report_dict = report.to_dict()
            report_dict['distance_km'] = round(dist, 2)
            data.append(report_dict)
    else:
        # Non-spatial query
        reports, total = DistressReportRepository.get_active(
            db,
            statuses=statuses,
            urgencies=urgencies,
            verified_only=verified_only,
            limit=limit,
            offset=offset
        )
        data = [report.to_dict() for report in reports]

    # Get summary stats
    stats = DistressReportRepository.get_summary_stats(db)

    return {
        "data": data,
        "pagination": {
            "total": len(data),
            "limit": limit,
            "offset": offset
        },
        "meta": {
            "critical_count": stats['active_by_urgency'].get('critical', 0),
            "high_count": stats['active_by_urgency'].get('high', 0),
            "pending_count": stats['by_status'].get('pending', 0),
            "total_active": stats['total_active']
        }
    }


@app.patch("/distress/{report_id}")
@limiter.limit("10/minute")
async def update_distress_report(
    request: Request,
    report_id: str,
    update_data: DistressReportUpdate,
    db: Session = Depends(get_db)
):
    """
    Update distress report status (admin action)

    Future: require authentication
    """
    from uuid import UUID
    try:
        report_uuid = UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    # Extract update fields
    data = update_data.dict(exclude_unset=True)

    if 'status' in data:
        report = DistressReportRepository.update_status(
            db, report_uuid,
            status=data['status'],
            admin_notes=data.get('admin_notes'),
            assigned_to=data.get('assigned_to'),
            verified=data.get('verified'),
            verified_by=data.get('verified_by')
        )
    else:
        report = DistressReportRepository.get_by_id(db, report_uuid)
        if not report:
            raise HTTPException(status_code=404, detail=f"Distress report not found: {report_id}")

    if not report:
        raise HTTPException(status_code=404, detail=f"Distress report not found: {report_id}")

    logger.info(f"Updated distress report: {report_id} (status={report.status.value})")

    return {
        "data": report.to_dict(),
        "meta": {
            "message": "Distress report updated successfully"
        }
    }


@app.get("/traffic/disruptions")
@limiter.limit("60/minute")
async def get_traffic_disruptions(
    request: Request,
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(30),
    type: Optional[str] = Query(None, description="Comma-separated type list"),
    severity: Optional[str] = Query(None, description="Comma-separated severity list"),
    road_name: Optional[str] = Query(None, description="Road name to search"),
    is_active: bool = Query(True),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get traffic disruptions with spatial and type filtering
    """
    # Parse filters
    types = type.split(',') if type else None
    severities = severity.split(',') if severity else None

    if road_name:
        # Search by road name
        disruptions = TrafficDisruptionRepository.get_by_road(
            db, road_name, active_only=is_active, limit=limit
        )
        data = [d.to_dict() for d in disruptions]
    elif lat is not None and lon is not None:
        # Spatial query
        disruptions, distances = TrafficDisruptionRepository.get_in_area(
            db, lat, lon, radius_km,
            types=types,
            severities=severities,
            active_only=is_active,
            limit=limit
        )

        data = []
        for disruption, dist in zip(disruptions, distances):
            disruption_dict = disruption.to_dict()
            disruption_dict['distance_km'] = round(dist, 2)
            data.append(disruption_dict)
    else:
        # Non-spatial query
        disruptions, total = TrafficDisruptionRepository.get_active(
            db,
            types=types,
            severities=severities,
            limit=limit,
            offset=offset
        )
        data = [d.to_dict() for d in disruptions]

    # Get summary stats
    stats = TrafficDisruptionRepository.get_summary_stats(db)

    return {
        "data": data,
        "pagination": {
            "total": len(data),
            "limit": limit,
            "offset": offset
        },
        "meta": {
            "impassable_count": stats['active_by_severity'].get('impassable', 0),
            "dangerous_count": stats['active_by_severity'].get('dangerous', 0),
            "total_active": stats['total_active'],
            "major_roads_affected": stats['major_roads_affected']
        }
    }


@app.post("/traffic/disruptions")
@limiter.limit("10/hour")
async def create_traffic_disruption(
    request: Request,
    disruption_data: TrafficDisruptionCreate,
    db: Session = Depends(get_db)
):
    """
    Report a traffic disruption (road closure, landslide, etc)

    Rate limit: 10 requests per hour per IP
    """
    # Create disruption
    data = disruption_data.dict()

    # Convert hazard_event_id string to UUID if provided
    if data.get('hazard_event_id'):
        from uuid import UUID
        try:
            data['hazard_event_id'] = UUID(data['hazard_event_id'])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid hazard_event_id format")

    disruption = TrafficDisruptionRepository.create(db, data)

    logger.info(f"Created traffic disruption: {disruption.id} (type={disruption.type.value}, road={disruption.road_name})")

    return {
        "data": disruption.to_dict(),
        "meta": {
            "message": "Cảm ơn bạn đã báo cáo. Thông tin đang được xác minh."
        }
    }


@app.get("/check-area")
@limiter.limit("30/minute")
async def check_area_safety(
    request: Request,
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(5, description="Check radius in km"),
    db: Session = Depends(get_db)
):
    """
    Quick safety check for a location

    Returns nearby hazards, disruptions, and distress reports with risk assessment
    """
    # Get nearby hazards
    from app.services.hazard_repo import HazardEventRepository
    hazards, hazard_distances, _ = HazardEventRepository.get_all(
        db, lat=lat, lng=lon, radius_km=radius_km,
        active_only=True, limit=20
    )

    # Get nearby traffic disruptions
    disruptions, disruption_distances = TrafficDisruptionRepository.get_in_area(
        db, lat, lon, radius_km, active_only=True, limit=20
    )

    # Get nearby distress reports
    distress, distress_distances = DistressReportRepository.get_nearby(
        db, lat, lon, radius_km,
        statuses=['pending', 'acknowledged', 'in_progress'],
        limit=20
    )

    # Calculate risk score (0-10)
    risk_score = 0

    # Hazards contribute most to risk
    for i, hazard in enumerate(hazards):
        if hazard.severity.value == 'critical':
            risk_score += 3
        elif hazard.severity.value == 'high':
            risk_score += 2
        elif hazard.severity.value == 'medium':
            risk_score += 1

    # Many disruptions = dangerous area
    if len(disruptions) >= 3:
        risk_score += 2

    # Critical distress signals = very dangerous
    critical_distress = sum(1 for d in distress if d.urgency.value == 'critical')
    if critical_distress > 0:
        risk_score += 2

    risk_score = min(risk_score, 10)

    # Risk level
    if risk_score >= 7:
        risk_level = 'critical'
        summary = f"Khu vực rất nguy hiểm - có {len(hazards)} cảnh báo thiên tai và {len(disruptions)} tuyến đường bị chia cắt"
    elif risk_score >= 5:
        risk_level = 'high'
        summary = f"Khu vực nguy hiểm - có {len(hazards)} cảnh báo và {len(disruptions)} sự cố giao thông"
    elif risk_score >= 3:
        risk_level = 'medium'
        summary = f"Khu vực có rủi ro - cần thận trọng"
    else:
        risk_level = 'low'
        summary = "Khu vực tương đối an toàn"

    # Recommendations
    recommendations = []
    if risk_score >= 7:
        recommendations.append("🚨 Khu vực nguy hiểm - tránh di chuyển nếu không cần thiết")
    if critical_distress > 0:
        recommendations.append(f"⚠️ Có {critical_distress} báo cáo cứu hộ khẩn cấp gần đây")
    if len(disruptions) >= 2:
        recommendations.append("🚧 Nhiều tuyến đường bị chia cắt - tìm đường thay thế")
    recommendations.append("☎️ Số điện thoại khẩn cấp: 113 (cảnh sát), 114 (cứu hỏa), 115 (y tế)")

    return {
        "location": {
            "lat": lat,
            "lon": lon,
            "radius_km": radius_km
        },
        "risk_assessment": {
            "level": risk_level,
            "score": risk_score,
            "summary": summary
        },
        "nearby_hazards": [
            {
                "type": h.type.value,
                "severity": h.severity.value,
                "distance_km": round(dist, 2)
            }
            for h, dist in zip(hazards, hazard_distances)
        ],
        "nearby_disruptions": [
            {
                "type": d.type.value,
                "severity": d.severity.value,
                "road_name": d.road_name,
                "distance_km": round(dist, 2)
            }
            for d, dist in zip(disruptions, disruption_distances)
        ],
        "nearby_distress": {
            "count": len(distress),
            "critical_count": critical_distress,
            "closest_distance_km": round(min(distress_distances), 2) if distress_distances else None
        },
        "recommendations": recommendations
    }


# ==================== AI FORECASTS ====================

@app.get("/ai-forecasts")
@limiter.limit("100/minute")
async def get_ai_forecasts(
    request: Request,
    db: Session = Depends(get_db),
    types: Optional[str] = Query(None, description="Comma-separated forecast types (e.g., 'flood,heavy_rain')"),
    severity: Optional[str] = Query(None, description="Comma-separated severity levels (e.g., 'high,critical')"),
    min_confidence: float = Query(0.6, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    active_only: bool = Query(True, description="Only return active (not expired) forecasts"),
    lat: Optional[float] = Query(None, ge=-90, le=90, description="User latitude for spatial filter"),
    lng: Optional[float] = Query(None, ge=-180, le=180, description="User longitude for spatial filter"),
    radius_km: Optional[float] = Query(50, gt=0, le=200, description="Search radius in km"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("forecast_time", description="Sort field: 'forecast_time', 'confidence', 'severity', 'distance'")
):
    """
    Get AI/ML forecast events with optional filters

    Returns predictions from ML models with confidence scores.
    Forecasts are distinguished from actual events by their source type.

    Supports spatial filtering (find forecasts near a location), type filtering,
    severity filtering, and confidence threshold filtering.
    """
    # Parse types
    forecast_types = types.split(',') if types else None

    # Parse severity levels
    severity_levels = severity.split(',') if severity else None

    # Get forecasts from repository
    forecasts, total, distances = AIForecastRepository.get_all(
        db=db,
        forecast_types=forecast_types,
        severity=severity_levels,
        min_confidence=min_confidence,
        active_only=active_only,
        lat=lat,
        lng=lng,
        radius_km=radius_km if (lat and lng) else None,
        limit=limit,
        offset=offset,
        sort_by=sort
    )

    # Convert to dict and add distance if spatial query
    data = []
    for i, forecast in enumerate(forecasts):
        forecast_dict = forecast.to_dict()
        if lat and lng and i < len(distances):
            forecast_dict['distance_km'] = round(distances[i], 2)
        data.append(forecast_dict)

    return {
        "data": data,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "total_pages": (total + limit - 1) // limit
        },
        "meta": {
            "min_confidence": min_confidence,
            "active_only": active_only,
            "forecast_horizon_hours": 48
        }
    }


@app.post("/ai-forecasts")
@limiter.limit("20/minute")
async def create_ai_forecast(
    request: Request,
    forecast_data: AIForecastCreate,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key)
):
    """
    Create a new AI forecast (ML model endpoint)

    This endpoint is for creating AI/ML forecasts. Requires API key with 'write:forecasts' scope.

    The forecast should include:
    - Hazard type and severity
    - Confidence score (0.0-1.0)
    - Location (lat/lon and optional radius)
    - Time range (forecast_time and valid_until)
    - Model metadata (name, version)
    - Optional summary text and data sources
    """
    # Convert Pydantic model to dict
    data = forecast_data.dict()

    # Create forecast
    forecast = AIForecastRepository.create(db, data)

    logger.info(
        "ai_forecast_created",
        forecast_id=str(forecast.id),
        type=forecast.type.value,
        severity=forecast.severity.value,
        confidence=forecast.confidence,
        model=f"{forecast.model_name} v{forecast.model_version}"
    )

    return {
        "data": forecast.to_dict(),
        "meta": {
            "message": "AI forecast created successfully"
        }
    }


@app.patch("/ai-forecasts/{forecast_id}")
@limiter.limit("20/minute")
async def update_ai_forecast(
    request: Request,
    forecast_id: str,
    update_data: AIForecastUpdate,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key)
):
    """
    Update an AI forecast

    Allows updating confidence, severity, validity period, and summary text.
    Requires API key.
    """
    from uuid import UUID
    try:
        forecast_uuid = UUID(forecast_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid forecast ID format")

    # Get update data (exclude None values)
    data = {k: v for k, v in update_data.dict().items() if v is not None}

    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Update forecast
    forecast = AIForecastRepository.update(db, forecast_uuid, data)

    if not forecast:
        raise HTTPException(status_code=404, detail=f"AI forecast not found: {forecast_id}")

    logger.info("ai_forecast_updated", forecast_id=forecast_id, updates=list(data.keys()))

    return {
        "data": forecast.to_dict(),
        "meta": {
            "message": "AI forecast updated successfully"
        }
    }


@app.post("/ai-forecasts/{forecast_id}/verify")
@limiter.limit("20/minute")
async def verify_ai_forecast(
    request: Request,
    forecast_id: str,
    actual_event_id: Optional[str] = Query(None, description="ID of the actual event that occurred"),
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key)
):
    """
    Mark an AI forecast as verified by a real event

    This endpoint is used to track forecast accuracy. If the predicted event
    actually occurred, link it to the actual HazardEvent ID.
    """
    from uuid import UUID
    try:
        forecast_uuid = UUID(forecast_id)
        event_uuid = UUID(actual_event_id) if actual_event_id else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    forecast = AIForecastRepository.mark_verified(db, forecast_uuid, event_uuid)

    if not forecast:
        raise HTTPException(status_code=404, detail=f"AI forecast not found: {forecast_id}")

    logger.info(
        "ai_forecast_verified",
        forecast_id=forecast_id,
        actual_event_id=actual_event_id,
        success=actual_event_id is not None
    )

    return {
        "data": forecast.to_dict(),
        "meta": {
            "message": "AI forecast verification recorded",
            "verified": actual_event_id is not None
        }
    }


@app.get("/ai-forecasts/stats/accuracy")
@limiter.limit("60/minute")
async def get_ai_forecast_accuracy_stats(
    request: Request,
    db: Session = Depends(get_db),
    from_date: Optional[str] = Query(None, description="Start date for stats (ISO 8601)")
):
    """
    Get accuracy statistics for AI forecasts

    Returns metrics like total verified forecasts, accuracy rate,
    and false positive rate.
    """
    from_datetime = None
    if from_date:
        try:
            from_datetime = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601.")

    stats = AIForecastRepository.get_forecast_accuracy_stats(db, from_datetime)

    return {
        "data": stats,
        "meta": {
            "from_date": from_date,
            "description": "Accuracy metrics for verified AI forecasts"
        }
    }


# Startup message
@app.on_event("startup")
async def startup_event():
    print(f"🚀 FloodWatch API v{VERSION} started successfully")
    print(f"📚 API Docs: http://localhost:8000/docs")
    print(f"🔧 Health check: http://localhost:8000/health")
    print(f"🛠️  Ops Dashboard: http://localhost:8000/ops?token={ADMIN_TOKEN}")
    print(f"📄 Lite Mode: http://localhost:8000/lite")
    print(f"📡 API Documentation: http://localhost:8000/api-docs")

    # Start ingestion scheduler
    print(f"🤖 Starting data ingestion scheduler...")
    start_scheduler()
    print(f"✅ Ingestion scheduler started (7 sources):")
    print(f"   📰 VnExpress RSS: every 30min")
    print(f"   📰 Tuổi Trẻ RSS: every 30min")
    print(f"   📰 Thanh Niên RSS: every 30min")
    print(f"   📺 VTC News RSS: every 30min")
    print(f"   📰 Baomoi (Aggregator): every 45min")
    print(f"   🌦️  KTTV (Weather): every 60min")
    print(f"   🏛️  PCTT (Gov Disaster): every 120min")


@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shutdown services on app exit."""
    print(f"🛑 Shutting down FloodWatch API...")
    stop_scheduler()
    print(f"✅ Ingestion scheduler stopped")
