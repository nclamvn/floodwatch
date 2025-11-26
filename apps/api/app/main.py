"""
FloodWatch API - Main Application (v2 with Database)
FastAPI backend for flood monitoring system
"""
from fastapi import FastAPI, Query, HTTPException, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timedelta
import os
import csv
import io
import json
import openai

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
from app.services.help_repo import HelpRequestRepository, HelpOfferRepository
from app.services.road_segment_repo import RoadSegmentRepository, RoadSegmentFilters
from app.database.models import RoadSegment, RoadSegmentStatus

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

# Import AI News services
from app.services.news_summary_engine import get_news_summary_engine
from app.services.audio_generator import get_audio_generator
from app.services.regional_summary_service import get_regional_summary_service

# Configure logging (JSON in production, console in dev)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
configure_logging(json_logs=(ENVIRONMENT == "production"))
logger = get_logger(__name__)

# Admin token for /ops dashboard
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "dev-admin-token-123")

# Initialize OpenAI for storm summary
openai.api_key = os.getenv('OPENAI_API_KEY')

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

# CORS configuration - hardened for production
# SECURITY: Be specific with origins, avoid wildcards in production
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS if origin.strip()]

# Allowed methods and headers - be explicit
CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_HEADERS = [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Admin-Token",
    "X-Requested-With",
    "Accept",
    "Origin",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=CORS_METHODS,
    allow_headers=CORS_HEADERS,
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    max_age=600,  # Cache preflight for 10 minutes
)

# Security headers middleware (comprehensive)
from app.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

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
    offset: int = Query(0, ge=0),
    dedupe: bool = Query(True, description="Enable cross-source deduplication (default: true)")
):
    """
    Get reports with optional filters

    Parameters:
    - type: Filter by report type
    - province: Filter by province name
    - since: Time filter (e.g., '6h', '24h', '7d')
    - limit: Max results per page
    - offset: Pagination offset
    - dedupe: Enable cross-source deduplication (default: true)

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

    report_dicts = [report.to_dict() for report in reports]

    # Apply cross-source deduplication (Layer 2)
    if dedupe:
        from app.services.report_dedup import deduplicate_reports
        report_dicts = deduplicate_reports(report_dicts)

    response_data = {
        "total": len(report_dicts) if dedupe else total,
        "limit": limit,
        "offset": offset,
        "dedupe": dedupe,
        "data": report_dicts
    }

    # Scrub PII from public endpoint
    scrubbed_data = scrub_response_data(response_data, request.url.path)

    # Add Cache-Control header for performance (30 seconds)
    return JSONResponse(
        content=scrubbed_data,
        headers={"Cache-Control": "public, max-age=30, stale-while-revalidate=60"}
    )


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


@app.post("/reports/{report_id}/generate-summary")
async def generate_report_summary(
    report_id: str,
    db: Session = Depends(get_db)
):
    """
    Generate AI summary for a report that has no description.
    Uses OpenAI to create context-aware summary from title.
    """
    try:
        # Get report
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        # Generate summary using AI
        from app.services.news_summary_engine import get_news_summary_engine
        engine = get_news_summary_engine()

        summary = engine.generate_article_summary(
            title=report.title,
            source_url=report.source
        )

        if not summary:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate summary"
            )

        return {
            "report_id": report_id,
            "summary": summary
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("generate_summary_error", report_id=report_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


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


@app.get("/api/v1/regional-summary")
@limiter.limit("20/minute")
async def get_regional_summary(
    request: Request,
    db: Session = Depends(get_db),
    province: str = Query(..., min_length=2, description="Province name (e.g., 'Đà Nẵng', 'Quảng Nam')"),
    hours: int = Query(24, ge=1, le=168, description="Time window in hours (1-168)")
):
    """
    Get AI-powered regional disaster summary for a specific province

    Rate limit: 20 requests per minute (to protect OpenAI API costs)

    Args:
        province: Province name (Vietnamese or English, with or without diacritics)
        hours: Time window in hours (default: 24, max: 168 = 1 week)

    Returns:
        - summary_text: AI-generated summary in Vietnamese (markdown format)
        - severity_level: low/moderate/high/critical
        - statistics: Report counts by type, trust scores
        - top_reports: List of most important reports
        - key_points: Bullet-point highlights
        - recommendations: Safety recommendations

    Error responses:
        - 400: Invalid province name (includes suggestions)
        - 500: AI service failure (returns fallback template)
    """
    try:
        logger.info(
            "regional_summary_requested",
            province_query=province,
            hours=hours,
            ip=request.client.host
        )

        # Get service instance
        service = get_regional_summary_service()

        # Generate summary
        result = service.generate_summary(
            db=db,
            province_query=province,
            hours=hours
        )

        if result is None:
            # Province not found
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Province not found",
                    "message": f"Không tìm thấy tỉnh/thành '{province}'. Vui lòng kiểm tra tên tỉnh.",
                    "suggestions": [
                        "Đà Nẵng", "Hà Nội", "Hồ Chí Minh",
                        "Quảng Nam", "Quảng Ngãi", "Thừa Thiên Huế"
                    ]
                }
            )

        logger.info(
            "regional_summary_generated",
            province=result['province'],
            severity=result['severity_level'],
            reports_count=result['statistics']['total_reports']
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("regional_summary_failed", error=str(e), province=province)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate regional summary: {str(e)}"
        )


# ==================== STORM SUMMARY ENDPOINT ====================

# Cache for storm summary (5 minutes)
_storm_summary_cache: dict = {"data": None, "expires_at": None}

@app.get("/api/v1/storm-summary")
@limiter.limit("20/minute")
async def get_storm_summary(
    request: Request,
    db: Session = Depends(get_db),
    hours: int = Query(72, ge=1, le=168, description="Time window in hours (default: 72 = 3 days)"),
    force_refresh: bool = Query(False, description="Force refresh cache")
):
    """
    Get AI-powered summary of Storm #15 (Bão số 15 / Bão Koto) situation

    Searches for reports containing storm-related keywords and generates comprehensive summary

    Rate limit: 20 requests per minute

    Args:
        hours: Time window in hours (default: 72, max: 168 = 1 week)

    Returns:
        - summary_text: AI-generated summary in Vietnamese (markdown format)
        - severity_level: low/moderate/high/critical
        - statistics: Report counts by type, trust scores
        - top_reports: List of most important storm reports
        - key_points: Bullet-point highlights
        - recommendations: Safety recommendations
    """
    global _storm_summary_cache

    try:
        # Check cache first (5 minute TTL)
        cache_key = f"storm_summary_{hours}"
        now = datetime.utcnow()
        if not force_refresh and _storm_summary_cache.get("data") and _storm_summary_cache.get("expires_at"):
            if now < _storm_summary_cache["expires_at"] and _storm_summary_cache.get("hours") == hours:
                logger.info("storm_summary_cache_hit", hours=hours)
                return _storm_summary_cache["data"]

        logger.info(
            "storm_summary_requested",
            hours=hours,
            ip=request.client.host,
            cache_miss=True
        )

        # Define storm keywords
        storm_keywords = [
            "bão số 15", "bão 15", "storm 15", "storm #15",
            "bão koto", "koto", "typhoon koto",
            "cơn bão số 15", "cơn bão 15"
        ]

        # Calculate time cutoff
        time_cutoff = datetime.utcnow() - timedelta(hours=hours)

        # Search for storm-related reports (include both verified and new reports)
        storm_reports = (
            db.query(Report)
            .filter(Report.created_at >= time_cutoff)
            .filter(Report.status.in_(['verified', 'new']))
            .all()
        )

        # Filter reports containing storm keywords (case-insensitive)
        filtered_reports = []
        for report in storm_reports:
            text = f"{report.title} {report.description or ''}".lower()
            if any(keyword.lower() in text for keyword in storm_keywords):
                filtered_reports.append(report)

        logger.info(
            "storm_reports_found",
            total_searched=len(storm_reports),
            storm_related=len(filtered_reports)
        )

        # Calculate statistics
        stats_by_type = {}
        total_trust = 0.0

        for report in filtered_reports:
            type_str = report.type.value if hasattr(report.type, 'value') else str(report.type)
            stats_by_type[type_str] = stats_by_type.get(type_str, 0) + 1
            total_trust += report.trust_score

        avg_trust = total_trust / len(filtered_reports) if filtered_reports else 0.0

        # Sort by trust score and get top reports
        top_reports = sorted(
            filtered_reports,
            key=lambda r: r.trust_score,
            reverse=True
        )[:10]

        # Prepare data for AI summary - use top 10 reports by trust score for faster processing
        sorted_by_trust = sorted(filtered_reports, key=lambda r: r.trust_score, reverse=True)
        reports_data = []
        for report in sorted_by_trust[:10]:  # Use top 10 for faster AI response
            reports_data.append({
                "title": report.title,
                "description": (report.description or "")[:500],  # Limit description length
                "type": report.type.value if hasattr(report.type, 'value') else str(report.type),
                "province": report.province or "Unknown",
                "created_at": report.created_at.isoformat(),
                "trust_score": report.trust_score
            })

        # Default storm info when no user reports found - use real-time AI to get latest info
        if not filtered_reports:
            try:
                # Use AI to generate current storm status based on general knowledge
                prompt = """Bạn là chuyên gia khí tượng thủy văn. Hãy cung cấp thông tin cập nhật về Bão số 15 (Bão Koto) năm 2024 đang hoạt động trên Biển Đông.

Nếu bão Koto đang hoạt động, hãy cung cấp:
1. **Vị trí hiện tại**: Tọa độ và khoảng cách so với bờ biển Việt Nam
2. **Cường độ**: Cấp bão, sức gió mạnh nhất
3. **Hướng di chuyển**: Hướng và tốc độ di chuyển
4. **Dự báo**: Đường đi dự kiến trong 24-48h tới
5. **Cảnh báo**: Các tỉnh cần đề phòng

Nếu không có thông tin về bão Koto hoặc bão đã tan, hãy nói rõ điều đó.

Viết bằng tiếng Việt, định dạng Markdown, ngắn gọn khoảng 200-300 từ."""

                response = openai.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Bạn là trợ lý dự báo thời tiết, chuyên cung cấp thông tin bão và thiên tai tại Việt Nam. Luôn cung cấp thông tin chính xác, cập nhật từ các nguồn chính thống như KTTV, NCHMF."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=800,
                    temperature=0.3
                )

                summary_text = response.choices[0].message.content.strip()

                # Set moderate severity when using AI-generated default info
                severity = "moderate"

            except Exception as ai_error:
                logger.error("ai_default_storm_info_failed", error=str(ai_error))
                # Fallback to static default info
                summary_text = """# Bão số 15 (Bão Koto) - Cập nhật

**Lưu ý:** Hệ thống đang thu thập thông tin từ các nguồn chính thống.

## Theo dõi bão

Để xem đường đi của bão số 15, vui lòng bấm nút **"Đường đi của bão"** ở góc phải để mở bản đồ Windy.

## Nguồn thông tin chính thức

- [Trung tâm Dự báo KTTV Quốc gia](https://nchmf.gov.vn)
- [Ban chỉ đạo PCTT Trung ương](http://phongchongthientai.mard.gov.vn)

## Khuyến nghị

- Thường xuyên cập nhật thông tin từ cơ quan chức năng
- Chuẩn bị sẵn đồ dùng thiết yếu
- Không ra khơi khi có cảnh báo bão"""
                severity = "moderate"

        # Generate AI summary if we have reports from users
        elif filtered_reports:
            try:
                prompt = f"""Tóm tắt tình hình Bão số 15 (Bão Koto) dựa trên {len(filtered_reports)} báo cáo:

{json.dumps(reports_data, ensure_ascii=False, indent=2)}

Hãy tạo bản tóm tắt chi tiết bằng tiếng Việt với:
1. Tình hình tổng quan về bão số 15
2. Vị trí, hướng di chuyển và cường độ hiện tại
3. Các khu vực bị ảnh hưởng
4. Thiệt hại đã ghi nhận (nếu có)
5. Dự báo diễn biến trong 24-48h tới

Format: Markdown, khoảng 300-400 từ."""

                response = openai.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are a disaster management assistant specializing in weather and storm analysis. Provide clear, actionable information in Vietnamese."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1000,
                    temperature=0.7
                )

                summary_text = response.choices[0].message.content.strip()

            except Exception as ai_error:
                logger.error("ai_summary_failed", error=str(ai_error))
                summary_text = f"""# Bão số 15 (Bão Koto)

Hiện có {len(filtered_reports)} báo cáo về bão số 15 trong {hours} giờ qua.

**Không thể tạo bản tóm tắt AI.** Vui lòng xem danh sách báo cáo chi tiết bên dưới."""

        # Determine severity (only if not already set for no-reports case)
        if filtered_reports:
            severity = "unknown"
        if len(filtered_reports) >= 20:
            severity = "critical"
        elif len(filtered_reports) >= 10:
            severity = "high"
        elif len(filtered_reports) >= 5:
            severity = "moderate"
        elif len(filtered_reports) > 0:
            severity = "low"

        # Build response
        result = {
            "province": "Bão số 15 (Koto)",
            "summary_text": summary_text,
            "severity_level": severity,
            "key_points": [
                f"Tìm thấy {len(filtered_reports)} báo cáo về bão số 15",
                f"Độ tin cậy trung bình: {avg_trust * 100:.0f}%",
                f"Thời gian: {hours} giờ qua"
            ],
            "recommendations": [
                "Theo dõi thường xuyên các bản tin cập nhật từ cơ quan chức năng",
                "Chuẩn bị đồ dùng thiết yếu và kế hoạch sơ tán nếu cần",
                "Tránh ra ngoài khi bão đổ bộ, không tự ý vào vùng nguy hiểm"
            ],
            "time_range": f"{hours} giờ qua",
            "statistics": {
                "total_reports": len(filtered_reports),
                "by_type": stats_by_type,
                "avg_trust_score": round(avg_trust, 2)
            },
            "top_reports": [
                {
                    "id": str(report.id),
                    "type": report.type.value if hasattr(report.type, 'value') else str(report.type),
                    "title": report.title,
                    "description": report.description,
                    "trust_score": report.trust_score,
                    "created_at": report.created_at.isoformat(),
                    "source": report.source or "Unknown"
                }
                for report in top_reports
            ],
            "generated_at": datetime.utcnow().isoformat()
        }

        logger.info(
            "storm_summary_generated",
            reports_count=len(filtered_reports),
            severity=severity
        )

        # Save to cache (5 minute TTL)
        _storm_summary_cache["data"] = result
        _storm_summary_cache["expires_at"] = datetime.utcnow() + timedelta(minutes=5)
        _storm_summary_cache["hours"] = hours

        return result

    except Exception as e:
        logger.error("storm_summary_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate storm summary: {str(e)}"
        )


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

    # Add Cache-Control header for performance (60 seconds)
    return JSONResponse(
        content={
            "data": data,
            "pagination": {
                "page": (offset // limit) + 1,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            }
        },
        headers={"Cache-Control": "public, max-age=60, stale-while-revalidate=120"}
    )


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


# Pydantic models for help connection
class HelpRequestCreate(BaseModel):
    """Model for creating a help request"""
    lat: float = Field(ge=-90, le=90, description="Latitude")
    lon: float = Field(ge=-180, le=180, description="Longitude")
    needs_type: Literal["food", "water", "shelter", "medical", "clothing", "transport", "other"]
    urgency: Literal["critical", "high", "medium", "low"]
    description: str = Field(min_length=10, description="Description of what help is needed")
    people_count: Optional[int] = Field(None, ge=1, description="Number of people needing help")
    address: Optional[str] = Field(None, max_length=500)
    contact_name: str = Field(min_length=1, max_length=255)
    contact_phone: str = Field(min_length=1, max_length=50)
    contact_method: Optional[str] = Field(None, max_length=50, description="Preferred contact method (phone, sms, zalo, etc.)")
    contact_email: Optional[str] = Field(None, description="Contact email address")
    has_children: Optional[bool] = Field(False, description="Are there children among those needing help")
    has_elderly: Optional[bool] = Field(False, description="Are there elderly among those needing help")
    has_disabilities: Optional[bool] = Field(False, description="Are there people with disabilities among those needing help")
    water_level_cm: Optional[int] = Field(None, ge=0, description="Current water level in centimeters at location")
    building_floor: Optional[int] = Field(None, description="Floor number where people are located (for evacuation planning)")
    notes: Optional[str] = None
    images: Optional[List[str]] = Field(None, description="Array of image URLs")


class HelpOfferCreate(BaseModel):
    """Model for creating a help offer"""
    lat: float = Field(ge=-90, le=90, description="Latitude")
    lon: float = Field(ge=-180, le=180, description="Longitude")
    service_type: Literal["rescue", "transportation", "medical", "shelter", "food_water", "supplies", "volunteer", "donation", "other"]
    description: str = Field(min_length=10, description="Description of what help is being offered")
    capacity: Optional[int] = Field(None, ge=1, description="How many people can be helped")
    availability: Optional[str] = Field(None, max_length=500, description="Time availability")
    address: Optional[str] = Field(None, max_length=500)
    coverage_radius_km: Optional[float] = Field(None, gt=0, description="Service coverage radius in km")
    contact_name: str = Field(min_length=1, max_length=255)
    contact_phone: str = Field(min_length=1, max_length=50)
    contact_method: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[str] = Field(None, description="Contact email address")
    organization: Optional[str] = Field(None, max_length=255, description="Organization name (if applicable)")
    vehicle_type: Optional[Literal["boat", "truck", "helicopter", "ambulance", "car", "motorcycle", "other"]] = Field(None, description="Type of vehicle available for rescue/transport")
    available_capacity: Optional[int] = Field(None, ge=1, description="Current available capacity (separate from total capacity)")
    notes: Optional[str] = None


# Phase 2: Assignment Schemas
class AssignmentCreate(BaseModel):
    """Model for creating a rescue assignment"""
    help_request_id: str = Field(description="UUID of the help request")
    help_offer_id: str = Field(description="UUID of the help offer")
    assigned_by: Optional[str] = Field(None, description="Who made the assignment (user_id or 'system')")
    estimated_arrival_minutes: Optional[int] = Field(None, ge=0, description="Estimated arrival time in minutes")
    notes: Optional[str] = Field(None, description="Assignment notes")


class AssignmentStatusUpdate(BaseModel):
    """Model for updating assignment status"""
    status: Literal["pending", "accepted", "rejected", "in_progress", "completed", "cancelled"] = Field(description="New status")
    cancellation_reason: Optional[str] = Field(None, description="Reason for cancellation (required if status=cancelled)")


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


# ============================================================================
# HELP CONNECTION ENDPOINTS
# ============================================================================

@app.post("/help/requests")
@limiter.limit("10/hour")
async def create_help_request(
    request: Request,
    request_data: HelpRequestCreate,
    db: Session = Depends(get_db)
):
    """
    Create a help request - people needing assistance during disasters

    Rate limit: 10 requests per hour per IP
    """
    # Create help request
    data = request_data.dict()
    help_request = HelpRequestRepository.create(db, data)

    logger.info(f"Created help request: {help_request.id} (needs={help_request.needs_type.value}, urgency={help_request.urgency.value})")

    return {
        "data": help_request.to_dict(),
        "meta": {
            "message": "Yêu cầu cứu trợ đã được ghi nhận. Chúng tôi sẽ kết nối bạn với những người có thể giúp đỡ."
        }
    }


@app.get("/help/requests")
@limiter.limit("60/minute")
async def get_help_requests(
    request: Request,
    lat: Optional[float] = Query(None, description="Latitude for spatial filtering"),
    lon: Optional[float] = Query(None, description="Longitude for spatial filtering"),
    radius_km: Optional[float] = Query(20, description="Search radius in km"),
    needs_type: Optional[str] = Query(None, description="Comma-separated needs types"),
    urgency: Optional[str] = Query(None, description="Comma-separated urgency levels"),
    status: Optional[str] = Query(None, description="Comma-separated status values"),
    verified_only: bool = Query(False, description="Only return verified requests"),
    sort_by: Optional[str] = Query(None, description="Sort by: created_at, urgency, priority, distance"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get help requests with optional spatial and filtering
    """
    # Parse comma-separated filters
    needs_types = needs_type.split(',') if needs_type else None
    urgency_levels = urgency.split(',') if urgency else None
    statuses = status.split(',') if status else None

    # Determine sort_by: default to distance if lat/lon provided, else created_at
    if sort_by is None:
        sort_by = 'distance' if (lat is not None and lon is not None) else 'created_at'

    if lat is not None and lon is not None:
        # Spatial query
        requests, total, distances = HelpRequestRepository.get_all(
            db, lat=lat, lng=lon, radius_km=radius_km,
            needs_types=needs_types,
            urgency_levels=urgency_levels,
            status=statuses,
            verified_only=verified_only,
            limit=limit,
            offset=offset,
            sort_by=sort_by
        )

        # Add distance to each request
        data = []
        for req, dist in zip(requests, distances):
            req_dict = req.to_dict()
            req_dict['distance_km'] = round(dist, 2)
            data.append(req_dict)
    else:
        # Non-spatial query
        requests, total, _ = HelpRequestRepository.get_all(
            db,
            needs_types=needs_types,
            urgency_levels=urgency_levels,
            status=statuses,
            verified_only=verified_only,
            limit=limit,
            offset=offset,
            sort_by=sort_by
        )
        data = [req.to_dict() for req in requests]

    # Get stats
    stats = HelpRequestRepository.get_stats(db)

    return {
        "data": data,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset
        },
        "meta": {
            "active_count": stats['active'],
            "critical_count": stats['critical_urgent'],
            "fulfilled_count": stats['fulfilled']
        }
    }


@app.post("/help/offers")
@limiter.limit("10/hour")
async def create_help_offer(
    request: Request,
    offer_data: HelpOfferCreate,
    db: Session = Depends(get_db)
):
    """
    Create a help offer - people/organizations offering assistance

    Rate limit: 10 requests per hour per IP
    """
    # Create help offer
    data = offer_data.dict()
    help_offer = HelpOfferRepository.create(db, data)

    logger.info(f"Created help offer: {help_offer.id} (service={help_offer.service_type.value})")

    return {
        "data": help_offer.to_dict(),
        "meta": {
            "message": "Cảm ơn bạn đã đăng ký hỗ trợ! Thông tin của bạn sẽ được hiển thị để kết nối với những người cần giúp đỡ."
        }
    }


@app.get("/help/offers")
@limiter.limit("60/minute")
async def get_help_offers(
    request: Request,
    lat: Optional[float] = Query(None, description="Latitude for spatial filtering"),
    lon: Optional[float] = Query(None, description="Longitude for spatial filtering"),
    radius_km: Optional[float] = Query(50, description="Search radius in km"),
    service_type: Optional[str] = Query(None, description="Comma-separated service types"),
    status: Optional[str] = Query(None, description="Comma-separated status values"),
    verified_only: bool = Query(False, description="Only return verified offers"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get help offers with optional spatial filtering
    """
    # Parse comma-separated filters
    service_types = service_type.split(',') if service_type else None
    statuses = status.split(',') if status else None

    if lat is not None and lon is not None:
        # Spatial query
        offers, total, distances = HelpOfferRepository.get_all(
            db, lat=lat, lng=lon, radius_km=radius_km,
            service_types=service_types,
            status=statuses,
            verified_only=verified_only,
            limit=limit,
            offset=offset,
            sort_by='distance'
        )

        # Add distance to each offer
        data = []
        for offer, dist in zip(offers, distances):
            offer_dict = offer.to_dict()
            offer_dict['distance_km'] = round(dist, 2)
            data.append(offer_dict)
    else:
        # Non-spatial query
        offers, total, _ = HelpOfferRepository.get_all(
            db,
            service_types=service_types,
            status=statuses,
            verified_only=verified_only,
            limit=limit,
            offset=offset
        )
        data = [offer.to_dict() for offer in offers]

    # Get stats
    stats = HelpOfferRepository.get_stats(db)

    return {
        "data": data,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset
        },
        "meta": {
            "active_count": stats['active'],
            "fulfilled_count": stats['fulfilled']
        }
    }


@app.delete("/help/requests/{request_id}")
@limiter.limit("20/hour")
async def delete_help_request(
    request: Request,
    request_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a help request by ID
    """
    from uuid import UUID
    from app.database.models import HelpRequest

    try:
        # Validate UUID
        req_uuid = UUID(request_id)

        # Find the request
        help_request = db.query(HelpRequest).filter(HelpRequest.id == req_uuid).first()

        if not help_request:
            raise HTTPException(status_code=404, detail="Help request not found")

        # Delete the request
        db.delete(help_request)
        db.commit()

        logger.info(f"Deleted help request: {request_id}")

        return {
            "message": "Help request deleted successfully",
            "id": request_id
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting help request {request_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete help request: {str(e)}")


@app.delete("/help/offers/{offer_id}")
@limiter.limit("20/hour")
async def delete_help_offer(
    request: Request,
    offer_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a help offer by ID
    """
    from uuid import UUID
    from app.database.models import HelpOffer

    try:
        # Validate UUID
        off_uuid = UUID(offer_id)

        # Find the offer
        help_offer = db.query(HelpOffer).filter(HelpOffer.id == off_uuid).first()

        if not help_offer:
            raise HTTPException(status_code=404, detail="Help offer not found")

        # Delete the offer
        db.delete(help_offer)
        db.commit()

        logger.info(f"Deleted help offer: {offer_id}")

        return {
            "message": "Help offer deleted successfully",
            "id": offer_id
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid offer ID format")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting help offer {offer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete help offer: {str(e)}")


# Phase 2: Assignment Endpoints
@app.post("/assignments")
@limiter.limit("20/hour")
async def create_assignment(
    request: Request,
    assignment_data: AssignmentCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new rescue assignment between a help request and help offer
    """
    from uuid import UUID
    from datetime import datetime, timezone
    from app.database.models import RescueAssignment, HelpRequest, HelpOffer

    try:
        # Validate UUIDs
        request_id = UUID(assignment_data.help_request_id)
        offer_id = UUID(assignment_data.help_offer_id)

        # Check that both request and offer exist
        help_request = db.query(HelpRequest).filter(HelpRequest.id == request_id).first()
        help_offer = db.query(HelpOffer).filter(HelpOffer.id == offer_id).first()

        if not help_request:
            raise HTTPException(status_code=404, detail="Help request not found")
        if not help_offer:
            raise HTTPException(status_code=404, detail="Help offer not found")

        # Check if request is already assigned
        if help_request.assigned_to_offer_id:
            raise HTTPException(status_code=400, detail="Help request is already assigned to an offer")

        # Calculate distance and priority at assignment time
        distance_km = None
        if help_request.lat and help_request.lon and help_offer.lat and help_offer.lon:
            from app.services.help_repo import HelpRequestRepository
            distance_km = HelpRequestRepository._calculate_distance(
                help_request.lat, help_request.lon,
                help_offer.lat, help_offer.lon
            )

        # Create assignment
        new_assignment = RescueAssignment(
            help_request_id=request_id,
            help_offer_id=offer_id,
            status='pending',
            assigned_at=datetime.now(timezone.utc),
            assigned_by=assignment_data.assigned_by or 'system',
            priority_at_assignment=help_request.priority_score,
            distance_km_at_assignment=distance_km,
            estimated_arrival_minutes=assignment_data.estimated_arrival_minutes,
            notes=assignment_data.notes
        )

        db.add(new_assignment)

        # Update help_request with assignment
        help_request.assigned_to_offer_id = offer_id
        help_request.status = 'assigned'

        # Update help_offer assignment counts
        help_offer.active_assignments_count = (help_offer.active_assignments_count or 0) + 1
        help_offer.total_assignments_count = (help_offer.total_assignments_count or 0) + 1
        help_offer.status = 'assigned'

        db.commit()
        db.refresh(new_assignment)

        return {
            "success": True,
            "message": "Assignment created successfully",
            "data": new_assignment.to_dict()
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create assignment: {str(e)}")


@app.get("/assignments")
@limiter.limit("60/minute")
async def get_assignments(
    request: Request,
    help_request_id: Optional[str] = Query(None, description="Filter by help request ID"),
    help_offer_id: Optional[str] = Query(None, description="Filter by help offer ID"),
    status: Optional[str] = Query(None, description="Comma-separated status values"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get rescue assignments with optional filtering
    """
    from uuid import UUID
    from app.database.models import RescueAssignment

    try:
        query = db.query(RescueAssignment)

        # Filter by help_request_id
        if help_request_id:
            request_uuid = UUID(help_request_id)
            query = query.filter(RescueAssignment.help_request_id == request_uuid)

        # Filter by help_offer_id
        if help_offer_id:
            offer_uuid = UUID(help_offer_id)
            query = query.filter(RescueAssignment.help_offer_id == offer_uuid)

        # Filter by status
        if status:
            statuses = status.split(',')
            query = query.filter(RescueAssignment.status.in_(statuses))

        # Get total count
        total = query.count()

        # Order by created_at DESC (newest first)
        query = query.order_by(RescueAssignment.created_at.desc())

        # Pagination
        assignments = query.limit(limit).offset(offset).all()

        return {
            "data": [assignment.to_dict() for assignment in assignments],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assignments: {str(e)}")


@app.patch("/assignments/{assignment_id}/status")
@limiter.limit("30/hour")
async def update_assignment_status(
    request: Request,
    assignment_id: str,
    status_data: AssignmentStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Update the status of a rescue assignment
    """
    from uuid import UUID
    from datetime import datetime, timezone
    from app.database.models import RescueAssignment, HelpRequest, HelpOffer

    try:
        assignment_uuid = UUID(assignment_id)
        assignment = db.query(RescueAssignment).filter(RescueAssignment.id == assignment_uuid).first()

        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        # Validate cancellation reason
        if status_data.status == 'cancelled' and not status_data.cancellation_reason:
            raise HTTPException(status_code=400, detail="Cancellation reason is required when cancelling an assignment")

        # Update status
        old_status = assignment.status
        assignment.status = status_data.status

        # Update timestamp fields based on status
        now = datetime.now(timezone.utc)
        if status_data.status == 'accepted':
            assignment.accepted_at = now
        elif status_data.status == 'in_progress':
            assignment.started_at = now
        elif status_data.status == 'completed':
            assignment.completed_at = now
        elif status_data.status == 'cancelled':
            assignment.cancelled_at = now
            assignment.cancellation_reason = status_data.cancellation_reason

        # Update related help_request and help_offer
        help_request = db.query(HelpRequest).filter(HelpRequest.id == assignment.help_request_id).first()
        help_offer = db.query(HelpOffer).filter(HelpOffer.id == assignment.help_offer_id).first()

        if help_request:
            if status_data.status == 'in_progress':
                help_request.status = 'in_progress'
            elif status_data.status == 'completed':
                help_request.status = 'rescued'
            elif status_data.status == 'cancelled':
                help_request.status = 'active'
                help_request.assigned_to_offer_id = None

        if help_offer:
            if status_data.status == 'in_progress':
                help_offer.status = 'busy'
            elif status_data.status in ['completed', 'cancelled']:
                # Decrement active assignments
                help_offer.active_assignments_count = max(0, (help_offer.active_assignments_count or 1) - 1)
                # Set status based on remaining assignments
                if help_offer.active_assignments_count == 0:
                    help_offer.status = 'active'

        db.commit()
        db.refresh(assignment)

        return {
            "success": True,
            "message": f"Assignment status updated from {old_status} to {status_data.status}",
            "data": assignment.to_dict()
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update assignment status: {str(e)}")


@app.get("/help/requests/{request_id}/matches")
@limiter.limit("30/minute")
async def find_matching_offers(
    request: Request,
    request_id: str,
    max_distance_km: float = Query(50, description="Maximum distance in km"),
    limit: int = Query(10, le=50, description="Maximum number of matches to return"),
    db: Session = Depends(get_db)
):
    """
    Find matching help offers for a specific help request
    Returns offers sorted by suitability score (distance, capacity, type matching)
    """
    from uuid import UUID
    from app.database.models import HelpRequest, HelpOffer
    from app.services.help_repo import HelpRequestRepository
    from sqlalchemy import or_, and_
    from datetime import datetime

    try:
        request_uuid = UUID(request_id)
        help_request = db.query(HelpRequest).filter(HelpRequest.id == request_uuid).first()

        if not help_request:
            raise HTTPException(status_code=404, detail="Help request not found")

        # Get active help offers near the request
        query = db.query(HelpOffer)

        # Only active offers (not assigned, busy, or offline)
        query = query.filter(HelpOffer.status == 'active')

        # Not expired
        now = datetime.utcnow()
        query = query.filter(
            or_(
                HelpOffer.expires_at.is_(None),
                HelpOffer.expires_at > now
            )
        )

        # Get all potential offers
        all_offers = query.all()

        # Score and filter offers
        matches = []
        for offer in all_offers:
            if not offer.lat or not offer.lon:
                continue

            # Calculate distance
            distance_km = HelpRequestRepository._calculate_distance(
                help_request.lat, help_request.lon,
                offer.lat, offer.lon
            )

            # Skip if too far
            if distance_km > max_distance_km:
                continue

            # Calculate suitability score (0-100, higher is better)
            score = 0.0

            # Distance score (50 points max) - closer is better
            # 0km = 50 points, max_distance_km = 0 points
            distance_score = max(0, 50 * (1 - (distance_km / max_distance_km)))
            score += distance_score

            # Service type matching (30 points)
            # Map needs_type to service_type
            type_matches = {
                'food': ['food_water', 'supplies', 'donation'],
                'water': ['food_water', 'supplies', 'donation'],
                'shelter': ['shelter'],
                'medical': ['medical', 'rescue'],
                'transport': ['transportation', 'rescue'],
                'rescue': ['rescue', 'transportation']
            }

            needs_type = help_request.needs_type
            if needs_type in type_matches and offer.service_type in type_matches[needs_type]:
                score += 30
            elif offer.service_type == 'volunteer':
                score += 15  # Volunteers can help with anything

            # Capacity score (20 points)
            if offer.available_capacity and help_request.people_count:
                if offer.available_capacity >= help_request.people_count:
                    score += 20
                elif offer.available_capacity > 0:
                    score += 10  # Partial capacity
            elif offer.capacity:
                if help_request.people_count and offer.capacity >= help_request.people_count:
                    score += 15
                else:
                    score += 5

            # Add to matches
            match_data = offer.to_dict()
            match_data['distance_km'] = round(distance_km, 2)
            match_data['suitability_score'] = round(score, 1)
            match_data['match_reasons'] = []

            if distance_km < 10:
                match_data['match_reasons'].append('Very close (< 10km)')
            elif distance_km < 25:
                match_data['match_reasons'].append('Close (< 25km)')

            if score >= 30:  # Has type match
                match_data['match_reasons'].append('Service type matches needs')

            if offer.available_capacity and help_request.people_count:
                if offer.available_capacity >= help_request.people_count:
                    match_data['match_reasons'].append('Sufficient capacity available')

            matches.append(match_data)

        # Sort by suitability score (highest first)
        matches.sort(key=lambda x: x['suitability_score'], reverse=True)

        # Limit results
        matches = matches[:limit]

        return {
            "data": matches,
            "meta": {
                "request_id": request_id,
                "request_priority": help_request.priority_score,
                "request_urgency": help_request.urgency,
                "total_matches": len(matches),
                "search_radius_km": max_distance_km
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find matches: {str(e)}")


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

    # Add Cache-Control header for performance (120 seconds - forecasts change slower)
    return JSONResponse(
        content={
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
        },
        headers={"Cache-Control": "public, max-age=120, stale-while-revalidate=300"}
    )


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


# ==================== AI NEWS BULLETIN ====================

# In-memory cache for AI news bulletin
_bulletin_cache = {
    "data": None,
    "generated_at": None,
    "cache_duration_minutes": 10
}

@app.get("/ai-news/latest")
@limiter.limit("100/minute")
async def get_latest_ai_news_bulletin(
    request: Request,
    db: Session = Depends(get_db),
    force_refresh: bool = False
):
    """
    Get the latest AI-generated news bulletin

    Returns the most recent 1-minute audio bulletin with:
    - Summary text (150-200 words)
    - Audio URL (MP3 from Cloudinary)
    - Generated timestamp
    - Priority level and affected regions
    - Key points and recommended actions

    The bulletin is cached for 10 minutes to improve performance.
    Use ?force_refresh=true to bypass cache and regenerate immediately.
    """
    try:
        from datetime import datetime, timezone, timedelta

        logger.info("fetching_latest_ai_news_bulletin")

        # Check if we have valid cached data
        if not force_refresh and _bulletin_cache["data"] and _bulletin_cache["generated_at"]:
            cache_age = datetime.now(timezone.utc) - _bulletin_cache["generated_at"]
            cache_valid_duration = timedelta(minutes=_bulletin_cache["cache_duration_minutes"])

            if cache_age < cache_valid_duration:
                logger.info(
                    "serving_cached_bulletin",
                    cache_age_minutes=cache_age.total_seconds() / 60,
                    cache_remaining_minutes=(cache_valid_duration - cache_age).total_seconds() / 60
                )
                return _bulletin_cache["data"]

        # Cache miss or expired - generate new bulletin
        logger.info("generating_new_bulletin", force_refresh=force_refresh)

        # Get services
        summary_engine = get_news_summary_engine()
        audio_generator = get_audio_generator()

        # Generate latest summary from recent data (last 60 minutes)
        # Changed from 10 to 60 minutes because scrapers run every 30-120 minutes
        summary = summary_engine.generate_summary(db, minutes=60)

        if not summary:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate news summary"
            )

        # Extract summary text
        summary_text = summary.get('summary_text', '')

        # Generate and upload audio
        audio_url, generated_at = audio_generator.generate_bulletin_audio(
            summary_text=summary_text,
            language='vi'
        )

        logger.info(
            "ai_news_bulletin_generated",
            audio_url=audio_url,
            priority=summary.get('priority_level')
        )

        response_data = {
            "data": {
                "title": summary.get('title'),
                "summary_text": summary_text,
                "audio_url": audio_url,
                "generated_at": generated_at.isoformat(),
                "priority_level": summary.get('priority_level', 'low'),
                "regions_affected": summary.get('regions_affected', []),
                "key_points": summary.get('key_points', []),
                "recommended_actions": summary.get('recommended_actions', [])
            },
            "meta": {
                "bulletin_duration_seconds": 60,
                "refresh_interval_minutes": 10,
                "language": "vi",
                "cached": False
            }
        }

        # Update cache with timezone-aware datetime
        _bulletin_cache["data"] = response_data
        # Ensure generated_at is timezone-aware for cache comparison
        if generated_at.tzinfo is None:
            # If naive, assume UTC
            _bulletin_cache["generated_at"] = generated_at.replace(tzinfo=timezone.utc)
        else:
            _bulletin_cache["generated_at"] = generated_at

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error("ai_news_bulletin_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate AI news bulletin: {str(e)}"
        )


@app.post("/ai-news/regenerate")
@limiter.limit("10/minute")
async def regenerate_ai_news_bulletin(
    request: Request,
    db: Session = Depends(get_db),
    api_key: str = Depends(require_api_key)
):
    """
    Manually trigger regeneration of AI news bulletin

    Requires API key with write permissions.

    Useful for:
    - Admin dashboard control
    - Emergency updates
    - Testing the bulletin generation pipeline

    The new bulletin will overwrite the previous one on Cloudinary.
    """
    try:
        logger.info("manual_ai_news_regeneration_triggered")

        # Get services
        summary_engine = get_news_summary_engine()
        audio_generator = get_audio_generator()

        # Generate summary
        summary = summary_engine.generate_summary(db, minutes=10)

        if not summary:
            raise HTTPException(
                status_code=500,
                detail="No data available to generate bulletin"
            )

        # Generate audio
        summary_text = summary.get('summary_text', '')
        audio_url, generated_at = audio_generator.generate_bulletin_audio(
            summary_text=summary_text,
            language='vi'
        )

        logger.info(
            "ai_news_bulletin_regenerated",
            audio_url=audio_url,
            trigger="manual"
        )

        return {
            "data": {
                "title": summary.get('title'),
                "audio_url": audio_url,
                "generated_at": generated_at.isoformat(),
                "priority_level": summary.get('priority_level')
            },
            "meta": {
                "message": "AI news bulletin regenerated successfully",
                "trigger": "manual"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("ai_news_regeneration_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Bulletin regeneration failed: {str(e)}"
        )


# ============================================================================
# ADMIN RESCUE MANAGEMENT ENDPOINTS
# ============================================================================

# Admin password from environment variable (hash it for production)
ADMIN_RESCUE_PASSWORD = os.getenv("ADMIN_RESCUE_PASSWORD", "thongtinmualu2025")

# In-memory admin session tokens (for simplicity, use Redis in production)
admin_sessions: dict = {}

class AdminLoginRequest(BaseModel):
    password: str

class AdminUpdateRequest(BaseModel):
    description: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: Optional[str] = None
    is_verified: Optional[bool] = None
    notes: Optional[str] = None

class BulkActionRequest(BaseModel):
    type: Literal["requests", "offers"]
    ids: List[str]


def verify_admin_token(request: Request) -> bool:
    """Verify admin token from header"""
    token = request.headers.get("X-Admin-Token")
    if not token:
        return False
    return token in admin_sessions and admin_sessions[token] > datetime.utcnow()


def require_admin(request: Request):
    """Dependency to require admin authentication"""
    if not verify_admin_token(request):
        raise HTTPException(status_code=401, detail="Admin authentication required")


@app.post("/api/v1/admin/verify-password")
@limiter.limit("5/minute")
async def admin_verify_password(
    request: Request,
    login_data: AdminLoginRequest
):
    """
    Verify admin password and return session token

    Rate limit: 5 attempts per minute
    """
    import secrets

    if login_data.password == ADMIN_RESCUE_PASSWORD:
        # Generate session token
        token = secrets.token_urlsafe(32)
        # Token expires in 24 hours
        admin_sessions[token] = datetime.utcnow() + timedelta(hours=24)

        logger.info("Admin login successful")

        return {
            "valid": True,
            "token": token,
            "expires_in": 86400  # 24 hours in seconds
        }
    else:
        logger.warning("Admin login failed - invalid password")
        return {
            "valid": False,
            "token": None
        }


@app.post("/api/v1/admin/logout")
async def admin_logout(request: Request):
    """Logout admin and invalidate session token"""
    token = request.headers.get("X-Admin-Token")
    if token and token in admin_sessions:
        del admin_sessions[token]
        logger.info("Admin logout successful")
    return {"message": "Logged out successfully"}


@app.patch("/api/v1/help/requests/{request_id}")
async def admin_update_help_request(
    request: Request,
    request_id: str,
    update_data: AdminUpdateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """
    Update a help request (Admin only)
    """
    from uuid import UUID
    from app.database.models import HelpRequest

    try:
        req_uuid = UUID(request_id)
        help_request = db.query(HelpRequest).filter(HelpRequest.id == req_uuid).first()

        if not help_request:
            raise HTTPException(status_code=404, detail="Help request not found")

        # Update fields if provided
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(help_request, field):
                setattr(help_request, field, value)

        # If verifying, set verified_at timestamp
        if update_data.is_verified is True:
            help_request.verified_at = datetime.utcnow()

        db.commit()
        db.refresh(help_request)

        logger.info(f"Admin updated help request: {request_id}")

        return {
            "message": "Help request updated successfully",
            "data": help_request.to_dict()
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID format")
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating help request {request_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update help request: {str(e)}")


@app.patch("/api/v1/help/offers/{offer_id}")
async def admin_update_help_offer(
    request: Request,
    offer_id: str,
    update_data: AdminUpdateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """
    Update a help offer (Admin only)
    """
    from uuid import UUID
    from app.database.models import HelpOffer

    try:
        off_uuid = UUID(offer_id)
        help_offer = db.query(HelpOffer).filter(HelpOffer.id == off_uuid).first()

        if not help_offer:
            raise HTTPException(status_code=404, detail="Help offer not found")

        # Update fields if provided
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(help_offer, field):
                setattr(help_offer, field, value)

        # If verifying, set verified_at timestamp
        if update_data.is_verified is True:
            help_offer.verified_at = datetime.utcnow()

        db.commit()
        db.refresh(help_offer)

        logger.info(f"Admin updated help offer: {offer_id}")

        return {
            "message": "Help offer updated successfully",
            "data": help_offer.to_dict()
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid offer ID format")
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating help offer {offer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update help offer: {str(e)}")


@app.post("/api/v1/admin/bulk-delete")
async def admin_bulk_delete(
    request: Request,
    bulk_data: BulkActionRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """
    Bulk delete help requests or offers (Admin only)
    """
    from uuid import UUID
    from app.database.models import HelpRequest, HelpOffer

    try:
        uuids = [UUID(id_str) for id_str in bulk_data.ids]

        if bulk_data.type == "requests":
            deleted = db.query(HelpRequest).filter(HelpRequest.id.in_(uuids)).delete(synchronize_session=False)
        else:
            deleted = db.query(HelpOffer).filter(HelpOffer.id.in_(uuids)).delete(synchronize_session=False)

        db.commit()

        logger.info(f"Admin bulk deleted {deleted} {bulk_data.type}")

        return {
            "message": f"Successfully deleted {deleted} {bulk_data.type}",
            "deleted_count": deleted
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format in list")
    except Exception as e:
        db.rollback()
        logger.error(f"Error in bulk delete: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete: {str(e)}")


@app.post("/api/v1/admin/bulk-verify")
async def admin_bulk_verify(
    request: Request,
    bulk_data: BulkActionRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """
    Bulk verify help requests or offers (Admin only)
    """
    from uuid import UUID
    from app.database.models import HelpRequest, HelpOffer

    try:
        uuids = [UUID(id_str) for id_str in bulk_data.ids]

        if bulk_data.type == "requests":
            updated = db.query(HelpRequest).filter(HelpRequest.id.in_(uuids)).update(
                {"is_verified": True, "verified_at": datetime.utcnow()},
                synchronize_session=False
            )
        else:
            updated = db.query(HelpOffer).filter(HelpOffer.id.in_(uuids)).update(
                {"is_verified": True, "verified_at": datetime.utcnow()},
                synchronize_session=False
            )

        db.commit()

        logger.info(f"Admin bulk verified {updated} {bulk_data.type}")

        return {
            "message": f"Successfully verified {updated} {bulk_data.type}",
            "verified_count": updated
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format in list")
    except Exception as e:
        db.rollback()
        logger.error(f"Error in bulk verify: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk verify: {str(e)}")


@app.get("/api/v1/admin/stats")
async def admin_get_stats(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """
    Get admin statistics for rescue management (Admin only)
    """
    from app.database.models import HelpRequest, HelpOffer
    from sqlalchemy import func

    # Request stats
    request_stats = db.query(
        func.count(HelpRequest.id).label('total'),
        func.count(HelpRequest.id).filter(HelpRequest.is_verified == True).label('verified'),
        func.count(HelpRequest.id).filter(HelpRequest.status == 'active').label('active'),
        func.count(HelpRequest.id).filter(HelpRequest.urgency.in_(['critical', 'high'])).label('urgent')
    ).first()

    # Offer stats
    offer_stats = db.query(
        func.count(HelpOffer.id).label('total'),
        func.count(HelpOffer.id).filter(HelpOffer.is_verified == True).label('verified'),
        func.count(HelpOffer.id).filter(HelpOffer.status == 'active').label('active')
    ).first()

    return {
        "requests": {
            "total": request_stats.total or 0,
            "verified": request_stats.verified or 0,
            "active": request_stats.active or 0,
            "urgent": request_stats.urgent or 0
        },
        "offers": {
            "total": offer_stats.total or 0,
            "verified": offer_stats.verified or 0,
            "active": offer_stats.active or 0
        }
    }


# ============================================================================
# ROUTES 2.0 - Road Segment Endpoints (Apple Maps style 4-status system)
# ============================================================================

@app.get("/routes")
async def get_routes(
    db: Session = Depends(get_db),
    province: Optional[str] = Query(None, description="Filter by province"),
    status: Optional[str] = Query(None, description="Filter by status (comma-separated: OPEN,LIMITED,DANGEROUS,CLOSED)"),
    hazard_type: Optional[str] = Query(None, description="Filter by hazard type"),
    since: Optional[str] = Query(None, description="Time filter (e.g., 6h, 24h, 7d)"),
    sort: Optional[str] = Query("risk_score", description="Sort by: risk_score, created_at, status"),
    limit: int = Query(100, ge=1, le=500, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    # Verification filters (for public safety)
    include_unverified: bool = Query(False, description="Admin only: include segments without source_url"),
    max_age_hours: int = Query(72, ge=1, le=168, description="Max age in hours (default 72h = 3 days)")
):
    """
    Get road segments with filters (Routes 2.0)

    IMPORTANT: By default, only returns VERIFIED data:
    - Must have source_url (verifiable news source)
    - Must be within 72 hours (3 days) - older info may be outdated

    This ensures public safety - unverified road alerts can cause harm.

    Status levels (Apple Maps style):
    - OPEN: Normal traffic flow
    - LIMITED: Slow, minor obstruction
    - DANGEROUS: Active hazard, caution
    - CLOSED: Road impassable

    Example: /routes?province=Quảng Bình&status=CLOSED,DANGEROUS&since=24h
    """
    # Parse status filter
    status_list = []
    if status:
        for s in status.split(','):
            s = s.strip().upper()
            if s in ['OPEN', 'LIMITED', 'DANGEROUS', 'CLOSED']:
                status_list.append(RoadSegmentStatus(s))

    filters = RoadSegmentFilters(
        province=province,
        status=status_list if status_list else None,
        hazard_type=hazard_type,
        since=since,
        sort_by=sort or "risk_score",
        # Verification filters - ROUTES 2.5
        # With sync service, we now have source_url from Reports
        require_source_url=not include_unverified,  # Require source_url unless admin override
        max_age_hours=max_age_hours,
        include_unverified=include_unverified
    )

    segments, total = RoadSegmentRepository.get_all(
        db=db,
        filters=filters,
        limit=limit,
        offset=offset
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": [seg.to_dict() for seg in segments]
    }


@app.get("/routes/summary")
async def get_routes_summary(
    db: Session = Depends(get_db),
    province: Optional[str] = Query(None, description="Filter by province")
):
    """
    Get summary statistics for road segments

    Returns:
    - Total count
    - Count by status (OPEN, LIMITED, DANGEROUS, CLOSED)
    - Count by province
    - Last updated timestamp
    """
    summary = RoadSegmentRepository.get_summary(db=db, province=province)

    return summary


@app.get("/routes/risk-index/{province}")
async def get_province_risk_index(
    province: str,
    db: Session = Depends(get_db)
):
    """
    Get risk index for a specific province

    Risk index is a weighted average (0.0-1.0) based on:
    - Status severity
    - Hazard proximity
    - Verification recency
    - Source reliability

    Also returns high-risk segments and status breakdown.
    """
    risk_data = RoadSegmentRepository.get_risk_index(db=db, province=province)

    return risk_data


@app.get("/routes/nearby")
async def get_nearby_routes(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(50, ge=1, le=200, description="Search radius in km"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    db: Session = Depends(get_db)
):
    """
    Get road segments within radius of a point

    Uses PostGIS ST_DWithin for efficient spatial query.
    Results sorted by risk score (highest first).
    """
    segments = RoadSegmentRepository.get_nearby(
        db=db,
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        limit=limit
    )

    return {
        "center": {"lat": lat, "lon": lon},
        "radius_km": radius_km,
        "total": len(segments),
        "data": [seg.to_dict() for seg in segments]
    }


@app.get("/routes/{segment_id}")
async def get_route_detail(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed information for a specific road segment
    """
    from uuid import UUID
    try:
        uuid_id = UUID(segment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")

    segment = RoadSegmentRepository.get_by_id(db=db, segment_id=uuid_id)

    if not segment:
        raise HTTPException(status_code=404, detail="Road segment not found")

    return segment.to_dict()


@app.get("/routes/by-province/{province}")
async def get_routes_by_province(
    province: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Get all road segments for a specific province

    Shorthand for /routes?province={province}
    Results sorted by risk score (highest first).
    """
    segments = RoadSegmentRepository.get_by_province(
        db=db,
        province=province,
        limit=limit
    )

    return {
        "province": province,
        "total": len(segments),
        "data": [seg.to_dict() for seg in segments]
    }


# ============================================================================
# ROUTES 2.5 - Sync Reports to RoadSegments
# ============================================================================

from app.services.routes_sync_service import RoutesSyncService


@app.post("/routes/sync")
async def sync_reports_to_routes(
    db: Session = Depends(get_db),
    hours: int = Query(72, ge=1, le=168, description="Hours to look back for reports"),
    limit: int = Query(500, ge=1, le=2000, description="Max reports to process"),
    dry_run: bool = Query(False, description="If true, don't actually create segments"),
    token: Optional[str] = Query(None, description="Admin token for authentication")
):
    """
    Sync traffic-related Reports to RoadSegments (ROUTES 2.5)

    This endpoint:
    1. Scans recent Reports from /map data
    2. Uses AI/keyword filtering to identify road-related content
    3. Creates RoadSegments with source_url for verification
    4. Deduplicates to avoid duplicates

    Requires admin token for non-dry-run operations.
    """
    # Require token for actual operations
    if not dry_run and token != ADMIN_TOKEN:
        raise HTTPException(
            status_code=403,
            detail="Admin token required for non-dry-run sync"
        )

    try:
        stats = RoutesSyncService.sync_reports_to_segments(
            db=db,
            hours=hours,
            limit=limit,
            dry_run=dry_run
        )

        return {
            "status": "success",
            "message": f"Sync completed: {stats['segments_created']} created, {stats['segments_updated']} updated",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )


@app.get("/routes/sync/status")
async def get_routes_sync_status(db: Session = Depends(get_db)):
    """
    Get status of Routes sync - how many segments have source_url
    """
    from sqlalchemy import func

    total = db.query(func.count(RoadSegment.id)).scalar()
    with_source_url = db.query(func.count(RoadSegment.id)).filter(
        RoadSegment.source_url.isnot(None),
        RoadSegment.source_url != ''
    ).scalar()

    recent_72h = db.query(func.count(RoadSegment.id)).filter(
        RoadSegment.created_at >= datetime.utcnow() - timedelta(hours=72)
    ).scalar()

    return {
        "total_segments": total,
        "with_source_url": with_source_url,
        "without_source_url": total - with_source_url,
        "source_url_percentage": round(with_source_url / total * 100, 1) if total > 0 else 0,
        "recent_72h": recent_72h,
        "sync_recommended": with_source_url < total * 0.5  # Recommend sync if < 50% have source
    }


@app.delete("/routes/cleanup")
async def cleanup_expired_routes(
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None, description="Admin token")
):
    """
    Remove expired road segments (older than expiry date)
    """
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin token required")

    deleted = RoutesSyncService.cleanup_expired_segments(db)

    return {
        "status": "success",
        "deleted_count": deleted
    }


# ============================================================================
# ALERT LIFECYCLE MANAGEMENT
# ============================================================================

from app.services.alert_lifecycle_service import AlertLifecycleService


@app.get("/routes/lifecycle/stats")
async def get_lifecycle_stats(db: Session = Depends(get_db)):
    """
    Get current lifecycle statistics for all alert tables.

    Returns counts of ACTIVE, RESOLVED, ARCHIVED alerts.
    """
    return AlertLifecycleService.get_lifecycle_stats(db)


@app.post("/routes/lifecycle/run")
async def run_lifecycle_job(
    db: Session = Depends(get_db),
    dry_run: bool = Query(True, description="If true, don't commit changes"),
    token: Optional[str] = Query(None, description="Admin token for non-dry-run")
):
    """
    Run the daily lifecycle job manually.

    - ACTIVE alerts not verified in 3 days -> RESOLVED
    - RESOLVED alerts older than 3 days -> ARCHIVED

    Requires admin token for non-dry-run operations.
    """
    if not dry_run and token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin token required for non-dry-run")

    return AlertLifecycleService.run_daily_lifecycle(db, dry_run=dry_run)


@app.post("/routes/{segment_id}/resolve")
async def resolve_segment(
    segment_id: str,
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None, description="Admin token")
):
    """
    Manually mark a road segment as RESOLVED.
    """
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin token required")

    from uuid import UUID
    success = AlertLifecycleService.mark_as_resolved(db, RoadSegment, UUID(segment_id))

    if not success:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "success", "message": "Segment marked as resolved"}


@app.post("/routes/{segment_id}/verify")
async def verify_segment(
    segment_id: str,
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None, description="Admin token")
):
    """
    Update last_verified_at to keep a segment ACTIVE.
    """
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin token required")

    from uuid import UUID
    success = AlertLifecycleService.verify_alert(db, RoadSegment, UUID(segment_id))

    if not success:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "success", "message": "Segment verification updated"}


@app.post("/routes/{segment_id}/reactivate")
async def reactivate_segment(
    segment_id: str,
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None, description="Admin token")
):
    """
    Reactivate a RESOLVED or ARCHIVED segment back to ACTIVE.
    """
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin token required")

    from uuid import UUID
    success = AlertLifecycleService.reactivate_alert(db, RoadSegment, UUID(segment_id))

    if not success:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "success", "message": "Segment reactivated"}


# ============================================================================
# END ROUTES 2.5
# ============================================================================


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
