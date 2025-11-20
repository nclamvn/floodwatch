"""
Report Repository - Data access layer for reports
"""
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint

from app.database.models import Report, ReportType


class ReportRepository:
    """Repository for Report operations"""

    @staticmethod
    def create(db: Session, report_data: dict) -> Report:
        """Create a new report"""
        # Set location geography from lat/lon if provided
        report = Report(**report_data)

        if report.lat is not None and report.lon is not None:
            # PostGIS will handle this through trigger, but we can set it explicitly
            report.location = f'SRID=4326;POINT({report.lon} {report.lat})'

        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_by_id(db: Session, report_id: UUID) -> Optional[Report]:
        """Get report by ID"""
        return db.query(Report).filter(Report.id == report_id).first()

    @staticmethod
    def get_all(
        db: Session,
        type: Optional[str] = None,
        province: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[Report], int]:
        """
        Get reports with filters

        Args:
            db: Database session
            type: Filter by report type
            province: Filter by province
            since: Time filter (e.g., '6h', '24h', '7d')
            limit: Max results
            offset: Pagination offset

        Returns:
            (reports, total_count)
        """
        query = db.query(Report)

        # Apply filters
        if type:
            query = query.filter(Report.type == type.upper())

        if province:
            query = query.filter(func.lower(Report.province) == province.lower())

        if since:
            cutoff = ReportRepository._parse_time_filter(since)
            if cutoff:
                query = query.filter(Report.created_at >= cutoff)

        # Get total count before pagination
        total = query.count()

        # Apply sorting and pagination
        reports = query.order_by(Report.created_at.desc()).limit(limit).offset(offset).all()

        return reports, total

    @staticmethod
    def update(db: Session, report_id: UUID, update_data: dict) -> Optional[Report]:
        """Update a report"""
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return None

        for key, value in update_data.items():
            setattr(report, key, value)

        # Update location if lat/lon changed
        if 'lat' in update_data or 'lon' in update_data:
            if report.lat and report.lon:
                report.location = f'SRID=4326;POINT({report.lon} {report.lat})'

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def delete(db: Session, report_id: UUID) -> bool:
        """Delete a report"""
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return False

        db.delete(report)
        db.commit()
        return True

    @staticmethod
    def get_recent_for_duplicate_check(db: Session, hours: int = 1) -> List[Report]:
        """
        Get recent reports for duplicate detection

        Args:
            db: Database session
            hours: How many hours back to check (default 1)

        Returns:
            List of recent reports
        """
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        return db.query(Report).filter(
            Report.created_at >= cutoff,
            Report.status != 'invalid'  # Don't check against invalid reports
        ).all()

    @staticmethod
    def _parse_time_filter(since: str) -> Optional[datetime]:
        """
        Parse time filter string to datetime

        Examples:
            '6h'  -> 6 hours ago
            '24h' -> 24 hours ago
            '7d'  -> 7 days ago
        """
        try:
            unit = since[-1]
            value = int(since[:-1])

            if unit == 'h':
                return datetime.utcnow() - timedelta(hours=value)
            elif unit == 'd':
                return datetime.utcnow() - timedelta(days=value)
            elif unit == 'm':
                return datetime.utcnow() - timedelta(minutes=value)
        except:
            pass

        return None
