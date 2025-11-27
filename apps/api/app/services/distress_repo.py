"""
Distress Report Repository - Data access layer for emergency rescue requests
"""
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
import sqlalchemy as sa
from sqlalchemy import and_, or_, func, Text, ARRAY
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_Distance, ST_DWithin
from geoalchemy2 import Geography

from app.database.models import DistressReport


class DistressReportRepository:
    """Repository for DistressReport operations"""

    @staticmethod
    def create(db: Session, report_data: dict) -> DistressReport:
        """
        Create a new distress report

        Args:
            db: Database session
            report_data: Dictionary with distress report data
                - lat, lon: Coordinates (required)
                - urgency: 'critical'|'high'|'medium'|'low' (required)
                - description: Text description (required, min 10 chars)
                - num_people: Number of people needing rescue (default 1)
                - has_injuries: Boolean
                - has_children: Boolean
                - has_elderly: Boolean
                - contact_name: Optional contact name
                - contact_phone: Optional phone number
                - media_urls: Optional array of image/video URLs
                - source: Data source (default 'user_report')

        Returns:
            Created DistressReport instance
        """
        # Extract lat/lon for geography creation
        lat = report_data.get('lat')
        lon = report_data.get('lon')

        if lat is None or lon is None:
            raise ValueError("lat and lon are required")

        # Create distress report instance
        report = DistressReport(**report_data)

        # Set location geography from lat/lon
        report.location = f'SRID=4326;POINT({lon} {lat})'

        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_by_id(db: Session, report_id: UUID) -> Optional[DistressReport]:
        """Get distress report by ID"""
        return db.query(DistressReport).filter(DistressReport.id == report_id).first()

    @staticmethod
    def get_active(
        db: Session,
        statuses: Optional[List[str]] = None,
        urgencies: Optional[List[str]] = None,
        verified_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[DistressReport], int]:
        """
        Get active distress reports (pending, acknowledged, in_progress)

        Args:
            db: Database session
            statuses: Optional list of status filters (default: active statuses)
            urgencies: Optional list of urgency filters
            verified_only: Only return verified reports
            limit: Max number of results
            offset: Pagination offset

        Returns:
            Tuple of (reports list, total count)
        """
        query = db.query(DistressReport)

        # Default to active statuses
        if statuses is None:
            statuses = ['pending', 'acknowledged', 'in_progress']

        if statuses:
            query = query.filter(DistressReport.status.in_(statuses))

        if urgencies:
            query = query.filter(DistressReport.urgency.in_(urgencies))

        if verified_only:
            query = query.filter(DistressReport.verified == True)

        # Get total count before pagination
        total = query.count()

        # Order by urgency (critical first), then created_at (newest first)
        # Cast enum to text for array_position comparison
        query = query.order_by(
            func.array_position(
                func.cast(func.array(['critical', 'high', 'medium', 'low']), type_=sa.ARRAY(sa.Text)),
                func.cast(DistressReport.urgency, sa.Text)
            ),
            DistressReport.created_at.desc()
        )

        # Apply pagination
        reports = query.limit(limit).offset(offset).all()

        return reports, total

    @staticmethod
    def get_nearby(
        db: Session,
        lat: float,
        lon: float,
        radius_km: float = 10,
        statuses: Optional[List[str]] = None,
        urgencies: Optional[List[str]] = None,
        limit: int = 100
    ) -> Tuple[List[DistressReport], List[float]]:
        """
        Get distress reports within radius of a location

        Args:
            db: Database session
            lat: Latitude of center point
            lon: Longitude of center point
            radius_km: Search radius in kilometers
            statuses: Optional list of status filters
            urgencies: Optional list of urgency filters
            limit: Max number of results

        Returns:
            Tuple of (reports list, distances list in km)
        """
        # Create point for user location
        user_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)

        # Calculate distance in meters
        distance_m = func.ST_Distance(
            DistressReport.location,
            func.cast(user_point, Geography)
        )

        query = db.query(
            DistressReport,
            (distance_m / 1000).label('distance_km')  # Convert to km
        )

        # Spatial filter: within radius
        query = query.filter(
            func.ST_DWithin(
                DistressReport.location,
                func.cast(user_point, Geography),
                radius_km * 1000  # Convert km to meters
            )
        )

        # Status filter
        if statuses is None:
            statuses = ['pending', 'acknowledged', 'in_progress']

        if statuses:
            query = query.filter(DistressReport.status.in_(statuses))

        # Urgency filter
        if urgencies:
            query = query.filter(DistressReport.urgency.in_(urgencies))

        # Order by urgency (critical first), then distance (closest first)
        # Cast enum to text for array_position comparison
        query = query.order_by(
            func.array_position(
                func.cast(func.array(['critical', 'high', 'medium', 'low']), type_=sa.ARRAY(sa.Text)),
                func.cast(DistressReport.urgency, sa.Text)
            ),
            distance_m
        )

        # Apply limit
        query = query.limit(limit)

        results = query.all()

        # Separate reports and distances
        reports = [r[0] for r in results]
        distances = [float(r[1]) for r in results]

        return reports, distances

    @staticmethod
    def update_status(
        db: Session,
        report_id: UUID,
        status: str,
        admin_notes: Optional[str] = None,
        assigned_to: Optional[str] = None,
        verified: Optional[bool] = None,
        verified_by: Optional[str] = None
    ) -> Optional[DistressReport]:
        """
        Update distress report status (admin action)

        Args:
            db: Database session
            report_id: Report ID
            status: New status ('pending'|'acknowledged'|'in_progress'|'resolved'|'false_alarm')
            admin_notes: Optional admin notes
            assigned_to: Optional rescue team assignment
            verified: Optional verification flag
            verified_by: Optional verifier name

        Returns:
            Updated DistressReport or None if not found
        """
        report = DistressReportRepository.get_by_id(db, report_id)
        if not report:
            return None

        report.status = status

        if admin_notes is not None:
            report.admin_notes = admin_notes

        if assigned_to is not None:
            report.assigned_to = assigned_to

        if verified is not None:
            report.verified = verified
            if verified and verified_by:
                report.verified_by = verified_by
                report.verified_at = datetime.utcnow()

        # Note: resolved_at is auto-set by trigger when status = 'resolved'

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_summary_stats(db: Session) -> dict:
        """
        Get summary statistics for distress reports

        Returns:
            Dictionary with counts by status and urgency
        """
        # Active reports by urgency
        active_by_urgency = db.query(
            DistressReport.urgency,
            func.count(DistressReport.id)
        ).filter(
            DistressReport.status.in_(['pending', 'acknowledged', 'in_progress'])
        ).group_by(DistressReport.urgency).all()

        # Total by status
        by_status = db.query(
            DistressReport.status,
            func.count(DistressReport.id)
        ).group_by(DistressReport.status).all()

        # Resolved today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        resolved_today = db.query(func.count(DistressReport.id)).filter(
            and_(
                DistressReport.status == 'resolved',
                DistressReport.resolved_at >= today_start
            )
        ).scalar()

        return {
            'active_by_urgency': {urgency: count for urgency, count in active_by_urgency},
            'by_status': {status: count for status, count in by_status},
            'resolved_today': resolved_today or 0,
            'total_active': sum(count for _, count in active_by_urgency)
        }

    @staticmethod
    def delete(db: Session, report_id: UUID) -> bool:
        """
        Delete a distress report (admin action - use sparingly)

        Args:
            db: Database session
            report_id: Report ID

        Returns:
            True if deleted, False if not found
        """
        report = DistressReportRepository.get_by_id(db, report_id)
        if not report:
            return False

        db.delete(report)
        db.commit()
        return True
