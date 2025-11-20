"""
AI Forecast Repository - Data access layer for AI/ML forecasts
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, type_coerce
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_Distance
from geoalchemy2 import Geography

from app.database.models import AIForecast, HazardType, SeverityLevel


class AIForecastRepository:
    """Repository for AIForecast operations"""

    @staticmethod
    def create(db: Session, forecast_data: dict) -> AIForecast:
        """
        Create a new AI forecast

        Args:
            db: Database session
            forecast_data: Dictionary with forecast data
                - type: HazardType enum value or string
                - severity: SeverityLevel enum value or string
                - confidence: Float 0.0-1.0
                - lat, lon: Coordinates
                - radius_km: Optional radius in km
                - forecast_time: When the hazard is predicted to occur
                - valid_until: When this forecast expires
                - model_name: Name of the ML model
                - model_version: Version of the model
                - summary: Optional AI-generated summary text
                - predicted_intensity: Optional intensity measure
                - predicted_duration_hours: Optional duration
                - risk_factors: Optional list of risk factors
                - data_sources: List of data sources used
                - raw_output: Optional full model output
                - source: Data source identifier (default: "AI_MODEL")

        Returns:
            Created AIForecast instance
        """
        # Extract lat/lon for geography creation
        lat = forecast_data.get('lat')
        lon = forecast_data.get('lon')

        # Create forecast instance
        forecast = AIForecast(**forecast_data)

        # Set location geography from lat/lon
        if lat is not None and lon is not None:
            forecast.location = f'SRID=4326;POINT({lon} {lat})'

        db.add(forecast)
        db.commit()
        db.refresh(forecast)
        return forecast

    @staticmethod
    def get_by_id(db: Session, forecast_id: UUID) -> Optional[AIForecast]:
        """Get AI forecast by ID"""
        return db.query(AIForecast).filter(AIForecast.id == forecast_id).first()

    @staticmethod
    def get_all(
        db: Session,
        forecast_types: Optional[List[str]] = None,
        severity: Optional[List[str]] = None,
        min_confidence: float = 0.0,
        active_only: bool = True,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = 'forecast_time'
    ) -> Tuple[List[AIForecast], int, List[float]]:
        """
        Get AI forecasts with filters

        Args:
            db: Database session
            forecast_types: List of hazard types to filter
            severity: List of severity levels to filter
            min_confidence: Minimum confidence threshold (0.0-1.0)
            active_only: Only return active (not expired) forecasts
            lat, lng, radius_km: Spatial filter (find forecasts within radius)
            from_time, to_time: Time range filter (forecast_time)
            limit: Max results
            offset: Pagination offset
            sort_by: Sort field ('forecast_time', 'confidence', 'severity', 'distance')

        Returns:
            (forecasts, total_count, distances_km)
        """
        query = db.query(AIForecast)

        # Active status filter
        if active_only:
            query = query.filter(AIForecast.is_active == True)

        # Type filter
        if forecast_types:
            query = query.filter(AIForecast.type.in_(forecast_types))

        # Severity filter
        if severity:
            query = query.filter(AIForecast.severity.in_(severity))

        # Confidence filter
        if min_confidence > 0.0:
            query = query.filter(AIForecast.confidence >= min_confidence)

        # Active/Valid forecasts only
        now = datetime.utcnow()
        if active_only:
            query = query.filter(
                and_(
                    AIForecast.forecast_time >= now - timedelta(hours=1),  # Not too far in the past
                    AIForecast.valid_until > now  # Not expired
                )
            )

        # Time range filter (forecast_time)
        if from_time:
            query = query.filter(AIForecast.forecast_time >= from_time)
        if to_time:
            query = query.filter(AIForecast.forecast_time <= to_time)

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
                    type_coerce(AIForecast.location, Geography),
                    type_coerce(user_point, Geography),
                    radius_m
                )
            )

        # Get total count before pagination
        total = query.count()

        # Sorting
        if sort_by == 'confidence':
            # Order by confidence DESC (highest confidence first)
            query = query.order_by(AIForecast.confidence.desc(), AIForecast.forecast_time.asc())
        elif sort_by == 'severity':
            # Order by severity DESC (critical first)
            query = query.order_by(AIForecast.severity.desc(), AIForecast.confidence.desc())
        elif sort_by == 'distance' and lat is not None and lng is not None:
            # Order by distance ASC (closest first)
            user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
            query = query.order_by(
                ST_Distance(
                    type_coerce(AIForecast.location, Geography),
                    type_coerce(user_point, Geography)
                )
            )
        else:
            # Default: order by forecast_time ASC (soonest forecast first)
            query = query.order_by(AIForecast.forecast_time.asc())

        # Apply pagination
        forecasts = query.limit(limit).offset(offset).all()

        # Calculate distances if spatial query was used
        if lat is not None and lng is not None:
            for forecast in forecasts:
                if forecast.lat and forecast.lon:
                    distance_km = AIForecastRepository._calculate_distance(
                        lat, lng, forecast.lat, forecast.lon
                    )
                    distances.append(distance_km)
                else:
                    distances.append(0.0)
        else:
            distances = [0.0] * len(forecasts)

        return forecasts, total, distances

    @staticmethod
    def update(db: Session, forecast_id: UUID, update_data: dict) -> Optional[AIForecast]:
        """Update an AI forecast"""
        forecast = AIForecastRepository.get_by_id(db, forecast_id)
        if not forecast:
            return None

        # Update fields
        for key, value in update_data.items():
            if hasattr(forecast, key) and value is not None:
                setattr(forecast, key, value)

        # Update location if lat/lon changed
        if 'lat' in update_data and 'lon' in update_data:
            lat = update_data['lat']
            lon = update_data['lon']
            if lat is not None and lon is not None:
                forecast.location = f'SRID=4326;POINT({lon} {lat})'

        db.commit()
        db.refresh(forecast)
        return forecast

    @staticmethod
    def mark_verified(
        db: Session,
        forecast_id: UUID,
        actual_event_id: Optional[UUID] = None
    ) -> Optional[AIForecast]:
        """
        Mark a forecast as verified by a real event

        Args:
            db: Database session
            forecast_id: Forecast to mark as verified
            actual_event_id: Optional ID of the actual HazardEvent that occurred

        Returns:
            Updated forecast or None if not found
        """
        forecast = AIForecastRepository.get_by_id(db, forecast_id)
        if not forecast:
            return None

        forecast.verified_at = datetime.utcnow()
        if actual_event_id:
            forecast.actual_event_id = actual_event_id

        db.commit()
        db.refresh(forecast)
        return forecast

    @staticmethod
    def deactivate(db: Session, forecast_id: UUID) -> Optional[AIForecast]:
        """Deactivate a forecast (soft delete)"""
        forecast = AIForecastRepository.get_by_id(db, forecast_id)
        if not forecast:
            return None

        forecast.is_active = False
        db.commit()
        db.refresh(forecast)
        return forecast

    @staticmethod
    def delete(db: Session, forecast_id: UUID) -> bool:
        """Delete an AI forecast (hard delete)"""
        forecast = AIForecastRepository.get_by_id(db, forecast_id)
        if not forecast:
            return False

        db.delete(forecast)
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
    def get_active_count(db: Session, min_confidence: float = 0.0) -> int:
        """Get count of currently active AI forecasts"""
        now = datetime.utcnow()
        query = db.query(AIForecast).filter(
            and_(
                AIForecast.is_active == True,
                AIForecast.forecast_time >= now - timedelta(hours=1),
                AIForecast.valid_until > now
            )
        )

        if min_confidence > 0.0:
            query = query.filter(AIForecast.confidence >= min_confidence)

        return query.count()

    @staticmethod
    def get_forecast_accuracy_stats(
        db: Session,
        from_date: Optional[datetime] = None
    ) -> dict:
        """
        Get accuracy statistics for forecasts that have been verified

        Args:
            db: Database session
            from_date: Optional start date for stats calculation

        Returns:
            Dictionary with accuracy metrics
        """
        query = db.query(AIForecast).filter(AIForecast.verified_at.isnot(None))

        if from_date:
            query = query.filter(AIForecast.created_at >= from_date)

        verified_forecasts = query.all()

        if not verified_forecasts:
            return {
                "total_verified": 0,
                "avg_confidence": 0.0,
                "accuracy_rate": 0.0,
                "false_positive_rate": 0.0
            }

        total = len(verified_forecasts)
        true_positives = sum(1 for f in verified_forecasts if f.actual_event_id is not None)
        avg_conf = sum(f.confidence for f in verified_forecasts) / total

        return {
            "total_verified": total,
            "true_positives": true_positives,
            "false_positives": total - true_positives,
            "avg_confidence": round(avg_conf, 3),
            "accuracy_rate": round(true_positives / total, 3) if total > 0 else 0.0,
            "false_positive_rate": round((total - true_positives) / total, 3) if total > 0 else 0.0
        }
