"""
FloodWatch API - Main Application
FastAPI backend for flood monitoring system
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timedelta
import os

# App instance
app = FastAPI(
    title="FloodWatch API",
    description="Real-time flood monitoring and alert system for Vietnam",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELS ====================

class ReportType(str):
    ALERT = "ALERT"
    RAIN = "RAIN"
    ROAD = "ROAD"
    SOS = "SOS"
    NEEDS = "NEEDS"


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


class Report(BaseModel):
    """Response model for reports"""
    id: str
    created_at: datetime
    updated_at: datetime
    type: str
    source: str
    title: str
    description: Optional[str]
    province: Optional[str]
    district: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
    trust_score: float
    status: str


# ==================== IN-MEMORY STORAGE (temp) ====================
# This will be replaced with actual database in next step

MOCK_REPORTS: List[dict] = []

def compute_trust_score(report_data: dict) -> float:
    """Compute trust score based on rules"""
    score = 0.0

    # Source bonus
    if report_data.get("source") in ["KTTV", "NCHMF"]:
        score += 0.5

    # GPS bonus
    if report_data.get("lat") and report_data.get("lon"):
        score += 0.3

    # Media bonus
    if report_data.get("media") and len(report_data.get("media", [])) > 0:
        score += 0.2

    # Province identified
    if report_data.get("province"):
        score += 0.1
    else:
        score -= 0.1

    return min(1.0, max(0.0, score))


# ==================== ENDPOINTS ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "floodwatch-api",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@app.get("/reports")
async def get_reports(
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
    """
    filtered = MOCK_REPORTS.copy()

    # Filter by type
    if type:
        filtered = [r for r in filtered if r["type"] == type.upper()]

    # Filter by province
    if province:
        filtered = [r for r in filtered if r.get("province", "").lower() == province.lower()]

    # Filter by time
    if since:
        try:
            # Parse time string (e.g., "6h", "24h", "7d")
            unit = since[-1]
            value = int(since[:-1])

            if unit == 'h':
                cutoff = datetime.utcnow() - timedelta(hours=value)
            elif unit == 'd':
                cutoff = datetime.utcnow() - timedelta(days=value)
            elif unit == 'm':
                cutoff = datetime.utcnow() - timedelta(minutes=value)
            else:
                raise ValueError("Invalid time unit")

            filtered = [r for r in filtered if datetime.fromisoformat(r["created_at"]) >= cutoff]
        except:
            pass

    # Sort by created_at desc
    filtered.sort(key=lambda x: x["created_at"], reverse=True)

    # Pagination
    total = len(filtered)
    paginated = filtered[offset:offset+limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": paginated
    }


@app.post("/ingest/alerts")
async def ingest_alerts(alerts: List[AlertIngest]):
    """
    Internal endpoint to ingest alerts from KTTV/NCHMF
    """
    ingested_count = 0

    for alert in alerts:
        report_data = {
            "id": f"alert-{len(MOCK_REPORTS) + 1}",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "type": "ALERT",
            "source": alert.source,
            "title": alert.title,
            "description": alert.description,
            "province": alert.province,
            "district": None,
            "ward": None,
            "lat": alert.lat,
            "lon": alert.lon,
            "trust_score": compute_trust_score({
                "source": alert.source,
                "lat": alert.lat,
                "lon": alert.lon,
                "province": alert.province,
                "media": []
            }),
            "media": [],
            "status": "new"
        }

        MOCK_REPORTS.append(report_data)
        ingested_count += 1

    return {
        "status": "success",
        "ingested": ingested_count,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/ingest/community")
async def ingest_community(report: CommunityReport):
    """
    Endpoint to receive community reports from webhooks/forms
    """
    report_data = {
        "id": f"community-{len(MOCK_REPORTS) + 1}",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "type": report.type,
        "source": "COMMUNITY",
        "title": f"{report.type} Report",
        "description": report.text,
        "province": report.province,
        "district": report.district,
        "ward": report.ward,
        "lat": report.lat,
        "lon": report.lon,
        "trust_score": compute_trust_score({
            "source": "COMMUNITY",
            "lat": report.lat,
            "lon": report.lon,
            "province": report.province,
            "media": report.media
        }),
        "media": report.media,
        "status": "new"
    }

    MOCK_REPORTS.append(report_data)

    return {
        "status": "success",
        "report_id": report_data["id"],
        "trust_score": report_data["trust_score"],
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/road-events")
async def get_road_events(
    province: Optional[str] = Query(None, description="Filter by province"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, CLOSED, RESTRICTED)")
):
    """
    Get road event status (mock for now)
    """
    # Mock data - will be replaced with real DB
    mock_roads = [
        {
            "id": "road-1",
            "segment_name": "QL1A Đèo Hải Vân",
            "status": "OPEN",
            "reason": None,
            "province": "Đà Nẵng",
            "lat": 16.1974,
            "lon": 108.1253,
            "last_verified": datetime.utcnow().isoformat()
        },
        {
            "id": "road-2",
            "segment_name": "QL9 Quảng Trị - Lao Bảo",
            "status": "RESTRICTED",
            "reason": "Mưa lớn, giảm tốc độ",
            "province": "Quảng Trị",
            "lat": 16.7463,
            "lon": 106.7303,
            "last_verified": datetime.utcnow().isoformat()
        }
    ]

    filtered = mock_roads

    if province:
        filtered = [r for r in filtered if r["province"].lower() == province.lower()]

    if status:
        filtered = [r for r in filtered if r["status"] == status.upper()]

    return {
        "total": len(filtered),
        "data": filtered
    }


# Startup message
@app.on_event("startup")
async def startup_event():
    print("🚀 FloodWatch API started successfully")
    print(f"📚 API Docs: http://localhost:8000/docs")
    print(f"🔧 Health check: http://localhost:8000/health")
