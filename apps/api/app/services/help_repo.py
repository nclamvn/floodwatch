"""
Help Connection Repository - Data access layer for help requests and offers
Phase 3 Performance: Added in-memory caching for stats queries
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID
import threading

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, type_coerce, case, literal
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_Distance
from geoalchemy2 import Geography

from app.database.models import (
    HelpRequest, HelpOffer,
    NeedsType, ServiceType, HelpStatus, HelpUrgency
)


# ==========================================
# Phase 3: In-memory cache for stats queries
# ==========================================
class StatsCache:
    """Thread-safe in-memory cache for stats with TTL"""

    def __init__(self, ttl_seconds: int = 300):  # 5 minute default TTL
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._ttl = timedelta(seconds=ttl_seconds)

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get cached value if not expired"""
        with self._lock:
            if key not in self._cache:
                return None

            entry = self._cache[key]
            if datetime.utcnow() > entry['expires']:
                del self._cache[key]
                return None

            return entry['data']

    def set(self, key: str, data: Dict[str, Any]) -> None:
        """Cache a value with TTL"""
        with self._lock:
            self._cache[key] = {
                'data': data,
                'expires': datetime.utcnow() + self._ttl
            }

    def invalidate(self, key: str) -> None:
        """Invalidate a specific cache key"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]

    def clear(self) -> None:
        """Clear all cached values"""
        with self._lock:
            self._cache.clear()


# Global stats cache instances (5 minute TTL)
_help_request_stats_cache = StatsCache(ttl_seconds=300)
_help_offer_stats_cache = StatsCache(ttl_seconds=300)


class HelpRequestRepository:
    """Repository for HelpRequest operations"""

    @staticmethod
    def create(db: Session, request_data: dict) -> HelpRequest:
        """
        Create a new help request

        Args:
            db: Database session
            request_data: Dictionary with request data
                - needs_type: NeedsType enum value or string
                - urgency: HelpUrgency enum value or string
                - description: Text description
                - people_count: Optional number of people
                - lat, lon: Coordinates
                - address: Optional address string
                - contact_name: Contact person name
                - contact_phone: Contact phone number
                - contact_method: Optional preferred contact method
                - notes: Optional additional notes
                - images: Optional JSONB array of image URLs

        Returns:
            Created HelpRequest instance
        """
        # Extract lat/lon for geography creation
        lat = request_data.get('lat')
        lon = request_data.get('lon')

        # Create request instance
        request = HelpRequest(**request_data)

        # Set location geography from lat/lon
        if lat is not None and lon is not None:
            request.location = f'SRID=4326;POINT({lon} {lat})'

        db.add(request)
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def get_by_id(db: Session, request_id: UUID) -> Optional[HelpRequest]:
        """Get help request by ID"""
        return db.query(HelpRequest).filter(HelpRequest.id == request_id).first()

    @staticmethod
    def get_all(
        db: Session,
        needs_types: Optional[List[str]] = None,
        urgency_levels: Optional[List[str]] = None,
        status: Optional[List[str]] = None,
        verified_only: bool = False,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = 'created_at'
    ) -> Tuple[List[HelpRequest], int, List[float]]:
        """
        Get help requests with filters

        Args:
            db: Database session
            needs_types: List of needs types to filter
            urgency_levels: List of urgency levels to filter
            status: List of status values to filter
            verified_only: Only return verified requests
            lat, lng, radius_km: Spatial filter (find requests within radius)
            limit: Max results
            offset: Pagination offset
            sort_by: Sort field ('created_at', 'urgency', 'priority', 'distance')

        Returns:
            (requests, total_count, distances_km)
        """
        query = db.query(HelpRequest)

        # Type filter
        if needs_types:
            query = query.filter(HelpRequest.needs_type.in_(needs_types))

        # Urgency filter
        if urgency_levels:
            query = query.filter(HelpRequest.urgency.in_(urgency_levels))

        # Status filter (default to active if not specified)
        if status:
            query = query.filter(HelpRequest.status.in_(status))
        else:
            query = query.filter(HelpRequest.status == 'active')

        # Verification filter
        if verified_only:
            query = query.filter(HelpRequest.is_verified == True)

        # Exclude expired requests
        now = datetime.utcnow()
        query = query.filter(
            or_(
                HelpRequest.expires_at.is_(None),
                HelpRequest.expires_at > now
            )
        )

        # Spatial filter
        distances = []
        if lat is not None and lng is not None and radius_km is not None:
            # Use PostGIS ST_DWithin for spatial query
            radius_m = radius_km * 1000

            # Create point from user coordinates
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

            # Filter by distance
            query = query.filter(
                func.ST_DWithin(
                    type_coerce(HelpRequest.location, Geography),
                    type_coerce(user_point, Geography),
                    radius_m
                )
            )

        # Get total count before pagination
        total = query.count()

        # Sorting
        if sort_by == 'priority':
            # Order by priority score DESC (highest priority first), then by created_at DESC
            query = query.order_by(HelpRequest.priority_score.desc(), HelpRequest.created_at.desc())
        elif sort_by == 'urgency':
            # Order by urgency DESC (critical first), then by created_at DESC
            query = query.order_by(HelpRequest.urgency.desc(), HelpRequest.created_at.desc())
        elif sort_by == 'distance' and lat is not None and lng is not None:
            # Order by distance ASC (closest first)
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
            query = query.order_by(
                ST_Distance(
                    type_coerce(HelpRequest.location, Geography),
                    type_coerce(user_point, Geography)
                )
            )
        else:
            # Default: order by created_at DESC (newest first)
            query = query.order_by(HelpRequest.created_at.desc())

        # Apply pagination
        requests = query.limit(limit).offset(offset).all()

        # Calculate distances if spatial query was used
        if lat is not None and lng is not None:
            for request in requests:
                if request.lat and request.lon:
                    distance_km = HelpRequestRepository._calculate_distance(
                        lat, lng, request.lat, request.lon
                    )
                    distances.append(distance_km)
                else:
                    distances.append(0.0)
        else:
            distances = [0.0] * len(requests)

        return requests, total, distances

    @staticmethod
    def update(db: Session, request_id: UUID, update_data: dict) -> Optional[HelpRequest]:
        """Update a help request"""
        request = HelpRequestRepository.get_by_id(db, request_id)
        if not request:
            return None

        # Update fields
        for key, value in update_data.items():
            if hasattr(request, key) and value is not None:
                setattr(request, key, value)

        # Update location if lat/lon changed
        if 'lat' in update_data and 'lon' in update_data:
            lat = update_data['lat']
            lon = update_data['lon']
            if lat is not None and lon is not None:
                request.location = f'SRID=4326;POINT({lon} {lat})'

        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def mark_verified(
        db: Session,
        request_id: UUID,
        verified_by: Optional[UUID] = None
    ) -> Optional[HelpRequest]:
        """
        Mark a help request as verified

        Args:
            db: Database session
            request_id: Request to mark as verified
            verified_by: Optional UUID of the verifier

        Returns:
            Updated request or None if not found
        """
        request = HelpRequestRepository.get_by_id(db, request_id)
        if not request:
            return None

        request.is_verified = True
        request.verified_at = datetime.utcnow()
        if verified_by:
            request.verified_by = verified_by

        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def update_status(
        db: Session,
        request_id: UUID,
        new_status: str
    ) -> Optional[HelpRequest]:
        """Update request status"""
        request = HelpRequestRepository.get_by_id(db, request_id)
        if not request:
            return None

        request.status = new_status
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def delete(db: Session, request_id: UUID) -> bool:
        """Delete a help request"""
        request = HelpRequestRepository.get_by_id(db, request_id)
        if not request:
            return False

        db.delete(request)
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
    def get_active_count(db: Session, urgency: Optional[str] = None) -> int:
        """Get count of currently active help requests"""
        now = datetime.utcnow()
        query = db.query(HelpRequest).filter(
            and_(
                HelpRequest.status == 'active',
                or_(
                    HelpRequest.expires_at.is_(None),
                    HelpRequest.expires_at > now
                )
            )
        )

        if urgency:
            query = query.filter(HelpRequest.urgency == urgency)

        return query.count()

    @staticmethod
    def get_stats(db: Session, use_cache: bool = True) -> dict:
        """
        Get statistics about help requests

        Phase 3 Performance: Uses 5-minute cache for stats

        Args:
            db: Database session
            use_cache: Whether to use cached stats (default True)

        Returns:
            Dictionary with request metrics
        """
        cache_key = "help_request_stats"

        # Check cache first
        if use_cache:
            cached = _help_request_stats_cache.get(cache_key)
            if cached:
                return cached

        # Compute fresh stats with single aggregate query (5 queries → 1)
        # Performance: Reduces DB round-trips from 5 to 1
        result = db.query(
            func.count(HelpRequest.id).label('total'),
            func.sum(case((HelpRequest.status == 'active', 1), else_=0)).label('active'),
            func.sum(case((HelpRequest.status == 'fulfilled', 1), else_=0)).label('fulfilled'),
            func.sum(case((HelpRequest.is_verified == True, 1), else_=0)).label('verified'),
            func.sum(case(
                (and_(HelpRequest.status == 'active', HelpRequest.urgency == 'critical'), 1),
                else_=0
            )).label('critical')
        ).first()

        stats = {
            "total": result.total or 0,
            "active": result.active or 0,
            "fulfilled": result.fulfilled or 0,
            "verified": result.verified or 0,
            "critical_urgent": result.critical or 0
        }

        # Cache the result
        _help_request_stats_cache.set(cache_key, stats)

        return stats

    @staticmethod
    def invalidate_stats_cache() -> None:
        """Invalidate the stats cache (call after create/update/delete)"""
        _help_request_stats_cache.invalidate("help_request_stats")


class HelpOfferRepository:
    """Repository for HelpOffer operations"""

    @staticmethod
    def create(db: Session, offer_data: dict) -> HelpOffer:
        """
        Create a new help offer

        Args:
            db: Database session
            offer_data: Dictionary with offer data
                - service_type: ServiceType enum value or string
                - description: Text description
                - capacity: Optional number of people that can be helped
                - availability: Optional time availability string
                - lat, lon: Coordinates
                - address: Optional address string
                - coverage_radius_km: Optional service coverage radius
                - contact_name: Contact person name
                - contact_phone: Contact phone number
                - contact_method: Optional preferred contact method
                - organization: Optional organization name
                - notes: Optional additional notes

        Returns:
            Created HelpOffer instance
        """
        # Extract lat/lon for geography creation
        lat = offer_data.get('lat')
        lon = offer_data.get('lon')

        # Create offer instance
        offer = HelpOffer(**offer_data)

        # Set location geography from lat/lon
        if lat is not None and lon is not None:
            offer.location = f'SRID=4326;POINT({lon} {lat})'

        db.add(offer)
        db.commit()
        db.refresh(offer)
        return offer

    @staticmethod
    def get_by_id(db: Session, offer_id: UUID) -> Optional[HelpOffer]:
        """Get help offer by ID"""
        return db.query(HelpOffer).filter(HelpOffer.id == offer_id).first()

    @staticmethod
    def get_all(
        db: Session,
        service_types: Optional[List[str]] = None,
        status: Optional[List[str]] = None,
        verified_only: bool = False,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = 'created_at'
    ) -> Tuple[List[HelpOffer], int, List[float]]:
        """
        Get help offers with filters

        Args:
            db: Database session
            service_types: List of service types to filter
            status: List of status values to filter
            verified_only: Only return verified offers
            lat, lng, radius_km: Spatial filter (find offers within radius)
            limit: Max results
            offset: Pagination offset
            sort_by: Sort field ('created_at', 'distance')

        Returns:
            (offers, total_count, distances_km)
        """
        query = db.query(HelpOffer)

        # Type filter
        if service_types:
            query = query.filter(HelpOffer.service_type.in_(service_types))

        # Status filter (default to active if not specified)
        if status:
            query = query.filter(HelpOffer.status.in_(status))
        else:
            query = query.filter(HelpOffer.status == 'active')

        # Verification filter
        if verified_only:
            query = query.filter(HelpOffer.is_verified == True)

        # Exclude expired offers
        now = datetime.utcnow()
        query = query.filter(
            or_(
                HelpOffer.expires_at.is_(None),
                HelpOffer.expires_at > now
            )
        )

        # Spatial filter
        distances = []
        if lat is not None and lng is not None and radius_km is not None:
            # Use PostGIS ST_DWithin for spatial query
            radius_m = radius_km * 1000

            # Create point from user coordinates
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

            # Filter by distance
            query = query.filter(
                func.ST_DWithin(
                    type_coerce(HelpOffer.location, Geography),
                    type_coerce(user_point, Geography),
                    radius_m
                )
            )

        # Get total count before pagination
        total = query.count()

        # Sorting
        if sort_by == 'distance' and lat is not None and lng is not None:
            # Order by distance ASC (closest first)
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
            query = query.order_by(
                ST_Distance(
                    type_coerce(HelpOffer.location, Geography),
                    type_coerce(user_point, Geography)
                )
            )
        else:
            # Default: order by created_at DESC (newest first)
            query = query.order_by(HelpOffer.created_at.desc())

        # Apply pagination
        offers = query.limit(limit).offset(offset).all()

        # Calculate distances if spatial query was used
        if lat is not None and lng is not None:
            for offer in offers:
                if offer.lat and offer.lon:
                    distance_km = HelpOfferRepository._calculate_distance(
                        lat, lng, offer.lat, offer.lon
                    )
                    distances.append(distance_km)
                else:
                    distances.append(0.0)
        else:
            distances = [0.0] * len(offers)

        return offers, total, distances

    @staticmethod
    def update(db: Session, offer_id: UUID, update_data: dict) -> Optional[HelpOffer]:
        """Update a help offer"""
        offer = HelpOfferRepository.get_by_id(db, offer_id)
        if not offer:
            return None

        # Update fields
        for key, value in update_data.items():
            if hasattr(offer, key) and value is not None:
                setattr(offer, key, value)

        # Update location if lat/lon changed
        if 'lat' in update_data and 'lon' in update_data:
            lat = update_data['lat']
            lon = update_data['lon']
            if lat is not None and lon is not None:
                offer.location = f'SRID=4326;POINT({lon} {lat})'

        db.commit()
        db.refresh(offer)
        return offer

    @staticmethod
    def mark_verified(
        db: Session,
        offer_id: UUID,
        verified_by: Optional[UUID] = None
    ) -> Optional[HelpOffer]:
        """
        Mark a help offer as verified

        Args:
            db: Database session
            offer_id: Offer to mark as verified
            verified_by: Optional UUID of the verifier

        Returns:
            Updated offer or None if not found
        """
        offer = HelpOfferRepository.get_by_id(db, offer_id)
        if not offer:
            return None

        offer.is_verified = True
        offer.verified_at = datetime.utcnow()
        if verified_by:
            offer.verified_by = verified_by

        db.commit()
        db.refresh(offer)
        return offer

    @staticmethod
    def update_status(
        db: Session,
        offer_id: UUID,
        new_status: str
    ) -> Optional[HelpOffer]:
        """Update offer status"""
        offer = HelpOfferRepository.get_by_id(db, offer_id)
        if not offer:
            return None

        offer.status = new_status
        db.commit()
        db.refresh(offer)
        return offer

    @staticmethod
    def delete(db: Session, offer_id: UUID) -> bool:
        """Delete a help offer"""
        offer = HelpOfferRepository.get_by_id(db, offer_id)
        if not offer:
            return False

        db.delete(offer)
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
    def get_active_count(db: Session, service_type: Optional[str] = None) -> int:
        """Get count of currently active help offers"""
        now = datetime.utcnow()
        query = db.query(HelpOffer).filter(
            and_(
                HelpOffer.status == 'active',
                or_(
                    HelpOffer.expires_at.is_(None),
                    HelpOffer.expires_at > now
                )
            )
        )

        if service_type:
            query = query.filter(HelpOffer.service_type == service_type)

        return query.count()

    @staticmethod
    def get_stats(db: Session, use_cache: bool = True) -> dict:
        """
        Get statistics about help offers

        Phase 3 Performance: Uses 5-minute cache for stats

        Args:
            db: Database session
            use_cache: Whether to use cached stats (default True)

        Returns:
            Dictionary with offer metrics
        """
        cache_key = "help_offer_stats"

        # Check cache first
        if use_cache:
            cached = _help_offer_stats_cache.get(cache_key)
            if cached:
                return cached

        # Compute fresh stats with single aggregate query (4 queries → 1)
        # Performance: Reduces DB round-trips from 4 to 1
        result = db.query(
            func.count(HelpOffer.id).label('total'),
            func.sum(case((HelpOffer.status == 'active', 1), else_=0)).label('active'),
            func.sum(case((HelpOffer.status == 'fulfilled', 1), else_=0)).label('fulfilled'),
            func.sum(case((HelpOffer.is_verified == True, 1), else_=0)).label('verified')
        ).first()

        stats = {
            "total": result.total or 0,
            "active": result.active or 0,
            "fulfilled": result.fulfilled or 0,
            "verified": result.verified or 0
        }

        # Cache the result
        _help_offer_stats_cache.set(cache_key, stats)

        return stats

    @staticmethod
    def invalidate_stats_cache() -> None:
        """Invalidate the stats cache (call after create/update/delete)"""
        _help_offer_stats_cache.invalidate("help_offer_stats")
