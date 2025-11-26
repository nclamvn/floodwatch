"""
Alert Lifecycle Service - Manages alert states (ACTIVE/RESOLVED/ARCHIVED)

This service implements the daily lifecycle validation:
1. Alerts not verified in 3 days -> RESOLVED (if ACTIVE)
2. Alerts resolved for 3+ days -> ARCHIVED (hidden from map)
3. Logs all state transitions

Run daily via cron or API endpoint.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.database.models import (
    RoadSegment, HazardEvent, TrafficDisruption, RoadEvent,
    AlertLifecycleStatus
)


# Configuration
DAYS_UNTIL_RESOLVED = 3  # Auto-resolve after 3 days without verification
DAYS_UNTIL_ARCHIVED = 3  # Archive 3 days after being resolved


class AlertLifecycleService:
    """
    Manages the lifecycle of map alerts across all alert tables.

    Lifecycle flow:
    ACTIVE (red/orange markers)
        |
        | (no verification for 3 days)
        v
    RESOLVED (green markers, "Đã khắc phục")
        |
        | (3 days after resolution)
        v
    ARCHIVED (hidden from map)
    """

    @classmethod
    def run_daily_lifecycle(cls, db: Session, dry_run: bool = False) -> Dict:
        """
        Run the daily lifecycle check on all alert tables.

        Args:
            db: Database session
            dry_run: If True, don't commit changes

        Returns:
            Statistics about state transitions
        """
        now = datetime.utcnow()
        resolve_cutoff = now - timedelta(days=DAYS_UNTIL_RESOLVED)
        archive_cutoff = now - timedelta(days=DAYS_UNTIL_ARCHIVED)

        stats = {
            "started_at": now.isoformat(),
            "dry_run": dry_run,
            "road_segments": cls._process_table(
                db, RoadSegment, resolve_cutoff, archive_cutoff, now, dry_run
            ),
            "hazard_events": cls._process_table(
                db, HazardEvent, resolve_cutoff, archive_cutoff, now, dry_run
            ),
            "traffic_disruptions": cls._process_table(
                db, TrafficDisruption, resolve_cutoff, archive_cutoff, now, dry_run
            ),
            "road_events": cls._process_table(
                db, RoadEvent, resolve_cutoff, archive_cutoff, now, dry_run
            ),
            "completed_at": datetime.utcnow().isoformat()
        }

        if not dry_run:
            db.commit()

        # Calculate totals
        stats["totals"] = {
            "resolved": sum(s["resolved"] for s in [
                stats["road_segments"], stats["hazard_events"],
                stats["traffic_disruptions"], stats["road_events"]
            ]),
            "archived": sum(s["archived"] for s in [
                stats["road_segments"], stats["hazard_events"],
                stats["traffic_disruptions"], stats["road_events"]
            ]),
        }

        return stats

    @classmethod
    def _process_table(
        cls,
        db: Session,
        model,
        resolve_cutoff: datetime,
        archive_cutoff: datetime,
        now: datetime,
        dry_run: bool
    ) -> Dict:
        """Process lifecycle transitions for a single table."""

        table_stats = {
            "active_count": 0,
            "resolved": 0,
            "archived": 0,
            "resolved_ids": [],
            "archived_ids": []
        }

        # Count current active
        table_stats["active_count"] = db.query(model).filter(
            model.lifecycle_status == AlertLifecycleStatus.ACTIVE
        ).count()

        # 1. Find ACTIVE alerts not verified recently -> RESOLVED
        # Use last_verified_at if set, otherwise fall back to created_at/updated_at
        stale_active = db.query(model).filter(
            model.lifecycle_status == AlertLifecycleStatus.ACTIVE,
            or_(
                and_(
                    model.last_verified_at.isnot(None),
                    model.last_verified_at < resolve_cutoff
                ),
                and_(
                    model.last_verified_at.is_(None),
                    model.created_at < resolve_cutoff
                )
            )
        ).all()

        for alert in stale_active:
            if not dry_run:
                alert.lifecycle_status = AlertLifecycleStatus.RESOLVED
                alert.resolved_at = now
            table_stats["resolved"] += 1
            table_stats["resolved_ids"].append(str(alert.id))

        # 2. Find RESOLVED alerts older than archive cutoff -> ARCHIVED
        old_resolved = db.query(model).filter(
            model.lifecycle_status == AlertLifecycleStatus.RESOLVED,
            model.resolved_at.isnot(None),
            model.resolved_at < archive_cutoff
        ).all()

        for alert in old_resolved:
            if not dry_run:
                alert.lifecycle_status = AlertLifecycleStatus.ARCHIVED
                alert.archived_at = now
            table_stats["archived"] += 1
            table_stats["archived_ids"].append(str(alert.id))

        return table_stats

    @classmethod
    def mark_as_resolved(
        cls,
        db: Session,
        model,
        alert_id: str,
        reason: str = None
    ) -> bool:
        """
        Manually mark an alert as resolved.

        Args:
            db: Database session
            model: The model class (RoadSegment, HazardEvent, etc.)
            alert_id: UUID of the alert
            reason: Optional reason for resolution

        Returns:
            True if successful
        """
        alert = db.query(model).filter(model.id == alert_id).first()
        if not alert:
            return False

        alert.lifecycle_status = AlertLifecycleStatus.RESOLVED
        alert.resolved_at = datetime.utcnow()
        db.commit()
        return True

    @classmethod
    def verify_alert(
        cls,
        db: Session,
        model,
        alert_id: str
    ) -> bool:
        """
        Update last_verified_at to current time (keeps alert ACTIVE).

        Call this when there's new data confirming the alert is still valid.

        Args:
            db: Database session
            model: The model class
            alert_id: UUID of the alert

        Returns:
            True if successful
        """
        alert = db.query(model).filter(model.id == alert_id).first()
        if not alert:
            return False

        alert.last_verified_at = datetime.utcnow()
        db.commit()
        return True

    @classmethod
    def reactivate_alert(
        cls,
        db: Session,
        model,
        alert_id: str
    ) -> bool:
        """
        Reactivate a RESOLVED or ARCHIVED alert back to ACTIVE.

        Use when an issue recurs.

        Args:
            db: Database session
            model: The model class
            alert_id: UUID of the alert

        Returns:
            True if successful
        """
        alert = db.query(model).filter(model.id == alert_id).first()
        if not alert:
            return False

        alert.lifecycle_status = AlertLifecycleStatus.ACTIVE
        alert.resolved_at = None
        alert.archived_at = None
        alert.last_verified_at = datetime.utcnow()
        db.commit()
        return True

    @classmethod
    def get_lifecycle_stats(cls, db: Session) -> Dict:
        """Get current lifecycle statistics across all tables."""
        stats = {}

        for model_name, model in [
            ("road_segments", RoadSegment),
            ("hazard_events", HazardEvent),
            ("traffic_disruptions", TrafficDisruption),
            ("road_events", RoadEvent)
        ]:
            active = db.query(model).filter(
                model.lifecycle_status == AlertLifecycleStatus.ACTIVE
            ).count()
            resolved = db.query(model).filter(
                model.lifecycle_status == AlertLifecycleStatus.RESOLVED
            ).count()
            archived = db.query(model).filter(
                model.lifecycle_status == AlertLifecycleStatus.ARCHIVED
            ).count()

            stats[model_name] = {
                "active": active,
                "resolved": resolved,
                "archived": archived,
                "total": active + resolved + archived
            }

        return stats
