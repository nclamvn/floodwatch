"""
Subscriptions & Deliveries Router
Endpoints: /subscriptions, /deliveries
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
from typing import List
import os

from app.database import get_db, Subscription, Delivery
from app.utils.logging_config import get_logger

router = APIRouter(tags=["Subscriptions"])
logger = get_logger(__name__)

# Admin token for protected endpoints
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "dev-admin-token-123")


def verify_admin_token(token: str = Query(..., description="Admin token")):
    """Verify admin token for protected access"""
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing admin token")
    return True


class SubscriptionCreate(BaseModel):
    """Model for creating a subscription"""
    org_name: str
    provinces: List[str] = Field(default_factory=list)
    types: List[str] = Field(default_factory=list)
    min_trust: float = Field(0.7, ge=0.0, le=1.0)
    callback_url: str
    secret: Optional[str] = None


@router.post("/subscriptions")
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


@router.get("/subscriptions")
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


@router.get("/deliveries")
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
