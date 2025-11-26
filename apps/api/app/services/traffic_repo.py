"""
Traffic Disruption Repository - Data access layer for road closures and traffic issues
"""
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_Distance, ST_DWithin
from geoalchemy2 import Geography

from app.database.models import TrafficDisruption, AlertLifecycleStatus


class TrafficDisruptionRepository:
    """Repository for TrafficDisruption operations"""

    @staticmethod
    def create(db: Session, disruption_data: dict) -> TrafficDisruption:
        """
        Create a new traffic disruption

        Args:
            db: Database session
            disruption_data: Dictionary with disruption data
                - lat, lon: Coordinates (required)
                - type: Disruption type (required)
                - severity: Severity level (required)
                - location_description: Text description of location (required, min 10 chars)
                - road_name: Optional road name
                - description: Optional detailed description
                - estimated_clearance: Optional datetime when road will be clear
                - alternative_route: Optional alternative route suggestion
                - source: Data source (required)
                - hazard_event_id: Optional linked hazard event UUID

        Returns:
            Created TrafficDisruption instance
        """
        # Extract lat/lon for geography creation
        lat = disruption_data.get('lat')
        lon = disruption_data.get('lon')

        if lat is None or lon is None:
            raise ValueError("lat and lon are required")

        # Create disruption instance
        disruption = TrafficDisruption(**disruption_data)

        # Set location geography from lat/lon
        disruption.location = f'SRID=4326;POINT({lon} {lat})'

        db.add(disruption)
        db.commit()
        db.refresh(disruption)
        return disruption

    @staticmethod
    def get_by_id(db: Session, disruption_id: UUID) -> Optional[TrafficDisruption]:
        """Get traffic disruption by ID"""
        return db.query(TrafficDisruption).filter(TrafficDisruption.id == disruption_id).first()

    @staticmethod
    def get_active(
        db: Session,
        types: Optional[List[str]] = None,
        severities: Optional[List[str]] = None,
        verified_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[TrafficDisruption], int]:
        """
        Get active traffic disruptions (is_active=true, ends_at is NULL or future)

        Args:
            db: Database session
            types: Optional list of disruption types
            severities: Optional list of severity levels
            verified_only: Only return verified disruptions
            limit: Max number of results
            offset: Pagination offset

        Returns:
            Tuple of (disruptions list, total count)
        """
        query = db.query(TrafficDisruption)

        # Filter active disruptions
        query = query.filter(TrafficDisruption.is_active == True)
        query = query.filter(
            or_(
                TrafficDisruption.ends_at.is_(None),
                TrafficDisruption.ends_at > datetime.utcnow()
            )
        )

        # Exclude ARCHIVED alerts (lifecycle filter)
        query = query.filter(
            TrafficDisruption.lifecycle_status.in_([
                AlertLifecycleStatus.ACTIVE,
                AlertLifecycleStatus.RESOLVED
            ])
        )

        # Type filter
        if types:
            query = query.filter(TrafficDisruption.type.in_(types))

        # Severity filter
        if severities:
            query = query.filter(TrafficDisruption.severity.in_(severities))

        # Verified filter
        if verified_only:
            query = query.filter(TrafficDisruption.verified == True)

        # Get total count before pagination
        total = query.count()

        # Order by severity (impassable first), then created_at (newest first)
        query = query.order_by(
            func.array_position(
                ['impassable', 'dangerous', 'slow', 'warning'],
                TrafficDisruption.severity
            ),
            TrafficDisruption.created_at.desc()
        )

        # Apply pagination
        disruptions = query.limit(limit).offset(offset).all()

        return disruptions, total

    @staticmethod
    def get_in_area(
        db: Session,
        lat: float,
        lon: float,
        radius_km: float = 30,
        types: Optional[List[str]] = None,
        severities: Optional[List[str]] = None,
        active_only: bool = True,
        limit: int = 100
    ) -> Tuple[List[TrafficDisruption], List[float]]:
        """
        Get traffic disruptions within radius of a location

        Args:
            db: Database session
            lat: Latitude of center point
            lon: Longitude of center point
            radius_km: Search radius in kilometers (default 30km for traffic)
            types: Optional list of disruption types
            severities: Optional list of severity levels
            active_only: Only return active disruptions (default True)
            limit: Max number of results

        Returns:
            Tuple of (disruptions list, distances list in km)
        """
        # Create point for user location
        user_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)

        # Calculate distance in meters
        distance_m = func.ST_Distance(
            TrafficDisruption.location,
            func.cast(user_point, Geography)
        )

        query = db.query(
            TrafficDisruption,
            (distance_m / 1000).label('distance_km')  # Convert to km
        )

        # Spatial filter: within radius
        query = query.filter(
            func.ST_DWithin(
                TrafficDisruption.location,
                func.cast(user_point, Geography),
                radius_km * 1000  # Convert km to meters
            )
        )

        # Active filter
        if active_only:
            query = query.filter(TrafficDisruption.is_active == True)
            query = query.filter(
                or_(
                    TrafficDisruption.ends_at.is_(None),
                    TrafficDisruption.ends_at > datetime.utcnow()
                )
            )
            # Exclude ARCHIVED alerts (lifecycle filter)
            query = query.filter(
                TrafficDisruption.lifecycle_status.in_([
                    AlertLifecycleStatus.ACTIVE,
                    AlertLifecycleStatus.RESOLVED
                ])
            )

        # Type filter
        if types:
            query = query.filter(TrafficDisruption.type.in_(types))

        # Severity filter
        if severities:
            query = query.filter(TrafficDisruption.severity.in_(severities))

        # Order by severity (impassable first), then distance (closest first)
        query = query.order_by(
            func.array_position(
                ['impassable', 'dangerous', 'slow', 'warning'],
                TrafficDisruption.severity
            ),
            distance_m
        )

        # Apply limit
        query = query.limit(limit)

        results = query.all()

        # Separate disruptions and distances
        disruptions = [r[0] for r in results]
        distances = [float(r[1]) for r in results]

        return disruptions, distances

    @staticmethod
    def get_by_road(
        db: Session,
        road_name: str,
        active_only: bool = True,
        limit: int = 50
    ) -> List[TrafficDisruption]:
        """
        Get traffic disruptions for a specific road

        Args:
            db: Database session
            road_name: Road name to search (e.g., "QL1A", "QL27")
            active_only: Only return active disruptions
            limit: Max number of results

        Returns:
            List of disruptions
        """
        query = db.query(TrafficDisruption)

        # Road name filter (case-insensitive partial match)
        query = query.filter(TrafficDisruption.road_name.ilike(f'%{road_name}%'))

        # Active filter
        if active_only:
            query = query.filter(TrafficDisruption.is_active == True)
            query = query.filter(
                or_(
                    TrafficDisruption.ends_at.is_(None),
                    TrafficDisruption.ends_at > datetime.utcnow()
                )
            )
            # Exclude ARCHIVED alerts (lifecycle filter)
            query = query.filter(
                TrafficDisruption.lifecycle_status.in_([
                    AlertLifecycleStatus.ACTIVE,
                    AlertLifecycleStatus.RESOLVED
                ])
            )

        # Order by severity, then created_at
        query = query.order_by(
            func.array_position(
                ['impassable', 'dangerous', 'slow', 'warning'],
                TrafficDisruption.severity
            ),
            TrafficDisruption.created_at.desc()
        )

        return query.limit(limit).all()

    @staticmethod
    def mark_resolved(
        db: Session,
        disruption_id: UUID,
        admin_notes: Optional[str] = None
    ) -> Optional[TrafficDisruption]:
        """
        Mark traffic disruption as resolved (set is_active=false)

        Args:
            db: Database session
            disruption_id: Disruption ID
            admin_notes: Optional admin notes

        Returns:
            Updated TrafficDisruption or None if not found
        """
        disruption = TrafficDisruptionRepository.get_by_id(db, disruption_id)
        if not disruption:
            return None

        disruption.is_active = False

        if admin_notes is not None:
            disruption.admin_notes = admin_notes

        # Note: ends_at is auto-set by trigger when is_active changes to false

        db.commit()
        db.refresh(disruption)
        return disruption

    @staticmethod
    def update(
        db: Session,
        disruption_id: UUID,
        update_data: dict
    ) -> Optional[TrafficDisruption]:
        """
        Update traffic disruption (admin action)

        Args:
            db: Database session
            disruption_id: Disruption ID
            update_data: Dictionary with fields to update
                - severity: Optional new severity
                - estimated_clearance: Optional estimated clearance time
                - alternative_route: Optional alternative route
                - verified: Optional verification flag
                - admin_notes: Optional admin notes

        Returns:
            Updated TrafficDisruption or None if not found
        """
        disruption = TrafficDisruptionRepository.get_by_id(db, disruption_id)
        if not disruption:
            return None

        # Update allowed fields
        allowed_fields = [
            'severity', 'estimated_clearance', 'alternative_route',
            'verified', 'admin_notes', 'description'
        ]

        for field, value in update_data.items():
            if field in allowed_fields and value is not None:
                setattr(disruption, field, value)

        db.commit()
        db.refresh(disruption)
        return disruption

    @staticmethod
    def get_summary_stats(db: Session) -> dict:
        """
        Get summary statistics for traffic disruptions

        Returns:
            Dictionary with counts by type and severity
        """
        # Active disruptions by severity
        active_by_severity = db.query(
            TrafficDisruption.severity,
            func.count(TrafficDisruption.id)
        ).filter(
            and_(
                TrafficDisruption.is_active == True,
                or_(
                    TrafficDisruption.ends_at.is_(None),
                    TrafficDisruption.ends_at > datetime.utcnow()
                )
            )
        ).group_by(TrafficDisruption.severity).all()

        # Active by type
        active_by_type = db.query(
            TrafficDisruption.type,
            func.count(TrafficDisruption.id)
        ).filter(
            and_(
                TrafficDisruption.is_active == True,
                or_(
                    TrafficDisruption.ends_at.is_(None),
                    TrafficDisruption.ends_at > datetime.utcnow()
                )
            )
        ).group_by(TrafficDisruption.type).all()

        # Major roads affected (group by road_name)
        major_roads = db.query(
            TrafficDisruption.road_name,
            func.count(TrafficDisruption.id)
        ).filter(
            and_(
                TrafficDisruption.is_active == True,
                TrafficDisruption.road_name.isnot(None),
                or_(
                    TrafficDisruption.ends_at.is_(None),
                    TrafficDisruption.ends_at > datetime.utcnow()
                )
            )
        ).group_by(TrafficDisruption.road_name).all()

        return {
            'active_by_severity': {severity: count for severity, count in active_by_severity},
            'active_by_type': {dtype: count for dtype, count in active_by_type},
            'major_roads_affected': [road for road, count in major_roads if count > 0],
            'total_active': sum(count for _, count in active_by_severity)
        }

    @staticmethod
    def delete(db: Session, disruption_id: UUID) -> bool:
        """
        Delete a traffic disruption (admin action - use sparingly)

        Args:
            db: Database session
            disruption_id: Disruption ID

        Returns:
            True if deleted, False if not found
        """
        disruption = TrafficDisruptionRepository.get_by_id(db, disruption_id)
        if not disruption:
            return False

        db.delete(disruption)
        db.commit()
        return True
