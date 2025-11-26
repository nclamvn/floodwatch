"""
Road Segment Repository - Data access layer for Routes 2.0

Provides CRUD operations and specialized queries for road segments.
"""
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID
from sqlalchemy import func, desc, asc, and_, or_, text
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID

from app.database.models import RoadSegment, RoadSegmentStatus, HazardEvent


class RoadSegmentFilters:
    """Filter parameters for road segment queries"""

    def __init__(
        self,
        province: Optional[str] = None,
        status: Optional[List[RoadSegmentStatus]] = None,
        hazard_type: Optional[str] = None,
        since: Optional[str] = None,  # e.g., "6h", "24h", "7d"
        min_risk_score: Optional[float] = None,
        max_risk_score: Optional[float] = None,
        has_coordinates: Optional[bool] = None,
        sort_by: str = "risk_score",  # risk_score, created_at, status
        sort_order: str = "desc",
        # NEW: Strict verification filters (enabled by default for public safety)
        require_source_url: bool = True,  # Only show segments with verifiable source
        max_age_hours: int = 72,  # Default 3 days - older info may be outdated
        include_unverified: bool = False  # Admin override to see all
    ):
        self.province = province
        self.status = status or []
        self.hazard_type = hazard_type
        self.since = since
        self.min_risk_score = min_risk_score
        self.max_risk_score = max_risk_score
        self.has_coordinates = has_coordinates
        self.sort_by = sort_by
        self.sort_order = sort_order
        # Verification filters
        self.require_source_url = require_source_url
        self.max_age_hours = max_age_hours
        self.include_unverified = include_unverified

    def get_since_datetime(self) -> Optional[datetime]:
        """Convert since string to datetime"""
        if not self.since:
            return None

        now = datetime.utcnow()
        if self.since.endswith('h'):
            hours = int(self.since[:-1])
            return now - timedelta(hours=hours)
        elif self.since.endswith('d'):
            days = int(self.since[:-1])
            return now - timedelta(days=days)
        return None


class RoadSegmentRepository:
    """Repository for RoadSegment data access"""

    @classmethod
    def get_all(
        cls,
        db: Session,
        filters: Optional[RoadSegmentFilters] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[RoadSegment], int]:
        """
        Get road segments with filters, pagination

        IMPORTANT: By default, applies strict verification filters:
        - Only shows segments with source_url (verifiable source)
        - Only shows segments from last 72 hours (3 days)

        This is critical for public safety - unverified or outdated
        road alerts can cause harm if incorrect.

        Returns:
            Tuple of (list of segments, total count)
        """
        query = db.query(RoadSegment)

        # Apply filters
        if filters:
            # CRITICAL: Verification filters for public safety
            if not filters.include_unverified:
                # Require source_url for verifiable information
                if filters.require_source_url:
                    query = query.filter(
                        and_(
                            RoadSegment.source_url.isnot(None),
                            RoadSegment.source_url != ''
                        )
                    )

                # Max age filter - default 72 hours (3 days)
                if filters.max_age_hours > 0:
                    max_age_cutoff = datetime.utcnow() - timedelta(hours=filters.max_age_hours)
                    # Use verified_at if available, otherwise created_at
                    query = query.filter(
                        or_(
                            RoadSegment.verified_at >= max_age_cutoff,
                            and_(
                                RoadSegment.verified_at.is_(None),
                                RoadSegment.created_at >= max_age_cutoff
                            )
                        )
                    )

            if filters.province:
                query = query.filter(RoadSegment.province == filters.province)

            if filters.status:
                query = query.filter(RoadSegment.status.in_(filters.status))

            if filters.min_risk_score is not None:
                query = query.filter(RoadSegment.risk_score >= filters.min_risk_score)

            if filters.max_risk_score is not None:
                query = query.filter(RoadSegment.risk_score <= filters.max_risk_score)

            if filters.has_coordinates is True:
                query = query.filter(
                    and_(
                        RoadSegment.start_lat.isnot(None),
                        RoadSegment.start_lon.isnot(None)
                    )
                )

            since_dt = filters.get_since_datetime()
            if since_dt:
                query = query.filter(RoadSegment.created_at >= since_dt)
            # Sorting (when filters provided)
            if filters.sort_by == 'risk_score':
                # Sort by status severity first, then risk score
                status_order = func.array_position(
                    text("ARRAY['CLOSED', 'DANGEROUS', 'LIMITED', 'OPEN']::road_segment_status[]"),
                    RoadSegment.status
                )
                if filters.sort_order == 'desc':
                    query = query.order_by(status_order, desc(RoadSegment.risk_score))
                else:
                    query = query.order_by(desc(status_order), asc(RoadSegment.risk_score))
            elif filters.sort_by == 'created_at':
                if filters.sort_order == 'desc':
                    query = query.order_by(desc(RoadSegment.created_at))
                else:
                    query = query.order_by(asc(RoadSegment.created_at))
            elif filters.sort_by == 'status':
                status_order = func.array_position(
                    text("ARRAY['CLOSED', 'DANGEROUS', 'LIMITED', 'OPEN']::road_segment_status[]"),
                    RoadSegment.status
                )
                query = query.order_by(status_order)
            else:
                # Default sort
                status_order = func.array_position(
                    text("ARRAY['CLOSED', 'DANGEROUS', 'LIMITED', 'OPEN']::road_segment_status[]"),
                    RoadSegment.status
                )
                query = query.order_by(status_order, desc(RoadSegment.risk_score))
        else:
            # Default filters when no filter object provided
            # Still apply verification for safety
            max_age_cutoff = datetime.utcnow() - timedelta(hours=72)
            query = query.filter(
                and_(
                    RoadSegment.source_url.isnot(None),
                    RoadSegment.source_url != ''
                )
            )
            query = query.filter(
                or_(
                    RoadSegment.verified_at >= max_age_cutoff,
                    and_(
                        RoadSegment.verified_at.is_(None),
                        RoadSegment.created_at >= max_age_cutoff
                    )
                )
            )
            # Default sort: by risk (status then score)
            status_order = func.array_position(
                text("ARRAY['CLOSED', 'DANGEROUS', 'LIMITED', 'OPEN']::road_segment_status[]"),
                RoadSegment.status
            )
            query = query.order_by(status_order, desc(RoadSegment.risk_score))

        # Get total count before pagination
        total = query.count()

        # Apply pagination
        segments = query.offset(offset).limit(limit).all()

        return segments, total

    @classmethod
    def get_by_id(cls, db: Session, segment_id: UUID) -> Optional[RoadSegment]:
        """Get a single road segment by ID"""
        return db.query(RoadSegment).filter(RoadSegment.id == segment_id).first()

    @classmethod
    def get_by_province(cls, db: Session, province: str, limit: int = 50) -> List[RoadSegment]:
        """Get road segments for a specific province"""
        return db.query(RoadSegment)\
            .filter(RoadSegment.province == province)\
            .order_by(desc(RoadSegment.risk_score))\
            .limit(limit)\
            .all()

    @classmethod
    def get_nearby(
        cls,
        db: Session,
        lat: float,
        lon: float,
        radius_km: float = 50,
        limit: int = 20
    ) -> List[RoadSegment]:
        """
        Get road segments within radius of a point

        Uses PostGIS ST_DWithin for efficient spatial query.
        """
        # Convert km to meters for ST_DWithin
        radius_meters = radius_km * 1000

        point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)

        return db.query(RoadSegment)\
            .filter(
                RoadSegment.location.isnot(None),
                func.ST_DWithin(
                    RoadSegment.location,
                    point,
                    radius_meters
                )
            )\
            .order_by(desc(RoadSegment.risk_score))\
            .limit(limit)\
            .all()

    @classmethod
    def get_summary(cls, db: Session, province: Optional[str] = None) -> Dict[str, Any]:
        """
        Get summary statistics for road segments

        Returns:
            {
                "total": 88,
                "by_status": {"OPEN": 45, "LIMITED": 23, "DANGEROUS": 12, "CLOSED": 8},
                "by_province": {"Quảng Bình": 15, ...},
                "last_updated": "2025-11-26T10:30:00Z"
            }
        """
        query = db.query(RoadSegment)

        if province:
            query = query.filter(RoadSegment.province == province)

        # Total count
        total = query.count()

        # Count by status
        status_counts = db.query(
            RoadSegment.status,
            func.count(RoadSegment.id).label('count')
        )
        if province:
            status_counts = status_counts.filter(RoadSegment.province == province)
        status_counts = status_counts.group_by(RoadSegment.status).all()

        by_status = {
            "OPEN": 0,
            "LIMITED": 0,
            "DANGEROUS": 0,
            "CLOSED": 0
        }
        for status, count in status_counts:
            status_key = status.value if hasattr(status, 'value') else status
            by_status[status_key] = count

        # Count by province (only if not filtering by province)
        by_province = {}
        if not province:
            province_counts = db.query(
                RoadSegment.province,
                func.count(RoadSegment.id).label('count')
            ).filter(
                RoadSegment.province.isnot(None)
            ).group_by(RoadSegment.province).all()

            for prov, count in province_counts:
                if prov:
                    by_province[prov] = count

        # Get last updated time
        latest = db.query(func.max(RoadSegment.updated_at)).scalar()

        return {
            "total": total,
            "by_status": by_status,
            "by_province": by_province,
            "last_updated": latest.isoformat() if latest else None
        }

    @classmethod
    def get_risk_index(cls, db: Session, province: str) -> Dict[str, Any]:
        """
        Calculate risk index for a province

        Risk index = weighted average of segment risks
        """
        segments = db.query(RoadSegment)\
            .filter(RoadSegment.province == province)\
            .all()

        if not segments:
            return {
                "province": province,
                "risk_index": 0.0,
                "total_segments": 0,
                "high_risk_segments": [],
                "status_breakdown": {"OPEN": 0, "LIMITED": 0, "DANGEROUS": 0, "CLOSED": 0}
            }

        # Calculate weighted risk index
        total_risk = sum(s.risk_score for s in segments)
        avg_risk = total_risk / len(segments)

        # Get high risk segments (DANGEROUS or CLOSED)
        high_risk = [
            s.to_dict() for s in segments
            if s.status in [RoadSegmentStatus.DANGEROUS, RoadSegmentStatus.CLOSED]
        ][:10]  # Limit to top 10

        # Status breakdown
        status_counts = {"OPEN": 0, "LIMITED": 0, "DANGEROUS": 0, "CLOSED": 0}
        for s in segments:
            status_key = s.status.value if hasattr(s.status, 'value') else s.status
            status_counts[status_key] = status_counts.get(status_key, 0) + 1

        return {
            "province": province,
            "risk_index": round(avg_risk, 3),
            "total_segments": len(segments),
            "high_risk_segments": high_risk,
            "status_breakdown": status_counts
        }

    @classmethod
    def upsert(cls, db: Session, segment: RoadSegment) -> RoadSegment:
        """Insert or update a road segment"""
        db.add(segment)
        db.commit()
        db.refresh(segment)
        return segment

    @classmethod
    def find_duplicate(
        cls,
        db: Session,
        normalized_name: str,
        province: Optional[str] = None,
        time_window_hours: int = 48
    ) -> Optional[RoadSegment]:
        """
        Find existing segment with same normalized name

        Used for deduplication when ingesting new data.
        """
        since = datetime.utcnow() - timedelta(hours=time_window_hours)

        query = db.query(RoadSegment)\
            .filter(RoadSegment.normalized_name == normalized_name)\
            .filter(RoadSegment.created_at >= since)

        if province:
            query = query.filter(RoadSegment.province == province)

        return query.first()

    @classmethod
    def update_status(
        cls,
        db: Session,
        segment_id: UUID,
        status: RoadSegmentStatus,
        reason: Optional[str] = None,
        risk_score: Optional[float] = None
    ) -> Optional[RoadSegment]:
        """Update status of a road segment"""
        segment = cls.get_by_id(db, segment_id)
        if not segment:
            return None

        segment.status = status
        if reason:
            segment.status_reason = reason
        if risk_score is not None:
            segment.risk_score = risk_score
        segment.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(segment)
        return segment

    @classmethod
    def bulk_create(cls, db: Session, segments: List[RoadSegment]) -> int:
        """Bulk insert road segments"""
        db.add_all(segments)
        db.commit()
        return len(segments)

    @classmethod
    def delete_expired(cls, db: Session) -> int:
        """Delete segments that have expired"""
        now = datetime.utcnow()
        deleted = db.query(RoadSegment)\
            .filter(RoadSegment.expires_at < now)\
            .delete(synchronize_session=False)
        db.commit()
        return deleted
