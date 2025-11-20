"""
Hazard Event Repository - Data access layer for hazard events
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text, type_coerce
from sqlalchemy.types import UserDefinedType
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_Distance
from geoalchemy2 import Geography

from app.database.models import HazardEvent, HazardType, SeverityLevel


class HazardEventRepository:
    """Repository for HazardEvent operations"""

    @staticmethod
    def create(db: Session, hazard_data: dict) -> HazardEvent:
        """
        Create a new hazard event

        Args:
            db: Database session
            hazard_data: Dictionary with hazard event data
                - type: HazardType enum value or string
                - severity: SeverityLevel enum value or string
                - lat, lon: Coordinates
                - radius_km: Optional radius in km
                - starts_at: Timestamp
                - ends_at: Optional end timestamp
                - source: Data source identifier
                - external_id: Optional external ID
                - raw_payload: Optional JSONB data

        Returns:
            Created HazardEvent instance
        """
        # Extract lat/lon for geography creation
        lat = hazard_data.get('lat')
        lon = hazard_data.get('lon')

        # Create hazard instance
        # Note: Keep type and severity as strings, SQLAlchemy will convert to enums
        hazard = HazardEvent(**hazard_data)

        # Set location geography from lat/lon
        if lat is not None and lon is not None:
            hazard.location = f'SRID=4326;POINT({lon} {lat})'

        db.add(hazard)
        db.commit()
        db.refresh(hazard)
        return hazard

    @staticmethod
    def get_by_id(db: Session, hazard_id: UUID) -> Optional[HazardEvent]:
        """Get hazard event by ID"""
        return db.query(HazardEvent).filter(HazardEvent.id == hazard_id).first()

    @staticmethod
    def get_all(
        db: Session,
        hazard_types: Optional[List[str]] = None,
        severity: Optional[List[str]] = None,
        active_only: bool = True,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = 'starts_at'
    ) -> Tuple[List[HazardEvent], int, List[float]]:
        """
        Get hazard events with filters

        Args:
            db: Database session
            hazard_types: List of hazard types to filter
            severity: List of severity levels to filter
            active_only: Only return active or upcoming events
            lat, lng, radius_km: Spatial filter (find events within radius)
            from_time, to_time: Time range filter
            limit: Max results
            offset: Pagination offset
            sort_by: Sort field ('starts_at', 'severity', 'distance')

        Returns:
            (hazards, total_count, distances_km)
        """
        query = db.query(HazardEvent)

        # Type filter
        if hazard_types:
            query = query.filter(HazardEvent.type.in_(hazard_types))

        # Severity filter
        if severity:
            query = query.filter(HazardEvent.severity.in_(severity))

        # Active only filter
        now = datetime.utcnow()
        if active_only:
            query = query.filter(
                and_(
                    HazardEvent.starts_at < now + timedelta(hours=24),  # Starts within 24h
                    or_(
                        HazardEvent.ends_at.is_(None),  # Ongoing
                        HazardEvent.ends_at > now  # Not ended yet
                    )
                )
            )

        # Time range filter
        if from_time:
            query = query.filter(HazardEvent.starts_at >= from_time)
        if to_time:
            query = query.filter(HazardEvent.starts_at <= to_time)

        # Spatial filter
        distances = []
        if lat is not None and lng is not None and radius_km is not None:
            # Use PostGIS ST_DWithin for spatial query
            # Convert km to meters
            radius_m = radius_km * 1000

            # Create point from user coordinates
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

            # Filter by distance
            # Use type_coerce instead of text() to avoid caching issues
            query = query.filter(
                func.ST_DWithin(
                    type_coerce(HazardEvent.location, Geography),
                    type_coerce(user_point, Geography),
                    radius_m
                )
            )

        # Get total count before pagination
        total = query.count()

        # Sorting
        if sort_by == 'severity':
            # Order by severity DESC (critical first)
            query = query.order_by(HazardEvent.severity.desc(), HazardEvent.starts_at.desc())
        elif sort_by == 'distance' and lat is not None and lng is not None:
            # Order by distance ASC (closest first)
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
            query = query.order_by(
                ST_Distance(
                    type_coerce(HazardEvent.location, Geography),
                    type_coerce(user_point, Geography)
                )
            )
        else:
            # Default: order by starts_at DESC (newest first)
            query = query.order_by(HazardEvent.starts_at.desc())

        # Apply pagination
        hazards = query.limit(limit).offset(offset).all()

        # Calculate distances if spatial query was used
        if lat is not None and lng is not None:
            for hazard in hazards:
                if hazard.lat and hazard.lon:
                    distance_km = HazardEventRepository._calculate_distance(
                        lat, lng, hazard.lat, hazard.lon
                    )
                    distances.append(distance_km)
                else:
                    distances.append(0.0)
        else:
            distances = [0.0] * len(hazards)

        return hazards, total, distances

    @staticmethod
    def update(db: Session, hazard_id: UUID, update_data: dict) -> Optional[HazardEvent]:
        """Update a hazard event"""
        hazard = HazardEventRepository.get_by_id(db, hazard_id)
        if not hazard:
            return None

        # Update fields
        for key, value in update_data.items():
            if hasattr(hazard, key) and value is not None:
                setattr(hazard, key, value)

        db.commit()
        db.refresh(hazard)
        return hazard

    @staticmethod
    def delete(db: Session, hazard_id: UUID) -> bool:
        """Delete a hazard event (hard delete for now)"""
        hazard = HazardEventRepository.get_by_id(db, hazard_id)
        if not hazard:
            return False

        db.delete(hazard)
        db.commit()
        return True

    @staticmethod
    def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two points using Haversine formula

        Returns:
            Distance in kilometers
        """
        from math import radians, cos, sin, asin, sqrt

        # Convert to radians
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers

        return c * r

    @staticmethod
    def get_active_count(db: Session) -> int:
        """Get count of currently active hazard events"""
        now = datetime.utcnow()
        return db.query(HazardEvent).filter(
            and_(
                HazardEvent.starts_at <= now,
                or_(
                    HazardEvent.ends_at.is_(None),
                    HazardEvent.ends_at > now
                )
            )
        ).count()
