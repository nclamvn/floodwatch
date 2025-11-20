"""
Road Event Repository - Data access layer for road events
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import RoadEvent, RoadStatus


class RoadEventRepository:
    """Repository for RoadEvent operations"""

    @staticmethod
    def create(db: Session, road_data: dict) -> RoadEvent:
        """Create a new road event"""
        road = RoadEvent(**road_data)

        if road.lat is not None and road.lon is not None:
            road.location = f'SRID=4326;POINT({road.lon} {road.lat})'

        db.add(road)
        db.commit()
        db.refresh(road)
        return road

    @staticmethod
    def get_by_id(db: Session, road_id: UUID) -> Optional[RoadEvent]:
        """Get road event by ID"""
        return db.query(RoadEvent).filter(RoadEvent.id == road_id).first()

    @staticmethod
    def get_all(
        db: Session,
        province: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> tuple[List[RoadEvent], int]:
        """
        Get road events with filters

        Args:
            db: Database session
            province: Filter by province
            status: Filter by status (OPEN, CLOSED, RESTRICTED)
            limit: Max results
            offset: Pagination offset

        Returns:
            (road_events, total_count)
        """
        query = db.query(RoadEvent)

        # Apply filters
        if province:
            query = query.filter(func.lower(RoadEvent.province) == province.lower())

        if status:
            query = query.filter(RoadEvent.status == status.upper())

        # Get total count
        total = query.count()

        # Apply sorting and pagination
        roads = query.order_by(RoadEvent.last_verified.desc()).limit(limit).offset(offset).all()

        return roads, total

    @staticmethod
    def update(db: Session, road_id: UUID, update_data: dict) -> Optional[RoadEvent]:
        """Update a road event"""
        road = db.query(RoadEvent).filter(RoadEvent.id == road_id).first()
        if not road:
            return None

        for key, value in update_data.items():
            setattr(road, key, value)

        # Update location if lat/lon changed
        if 'lat' in update_data or 'lon' in update_data:
            if road.lat and road.lon:
                road.location = f'SRID=4326;POINT({road.lon} {road.lat})'

        db.commit()
        db.refresh(road)
        return road

    @staticmethod
    def upsert_by_segment(
        db: Session,
        segment_name: str,
        province: str,
        update_data: dict
    ) -> RoadEvent:
        """
        Upsert road event by segment name and province
        Used for idempotent ingestion
        """
        # Try to find existing
        road = db.query(RoadEvent).filter(
            func.lower(RoadEvent.segment_name) == segment_name.lower(),
            func.lower(RoadEvent.province) == province.lower()
        ).first()

        if road:
            # Update existing
            for key, value in update_data.items():
                setattr(road, key, value)

            if road.lat and road.lon:
                road.location = f'SRID=4326;POINT({road.lon} {road.lat})'
        else:
            # Create new
            road_data = {
                "segment_name": segment_name,
                "province": province,
                **update_data
            }
            road = RoadEvent(**road_data)

            if road.lat and road.lon:
                road.location = f'SRID=4326;POINT({road.lon} {road.lat})'

            db.add(road)

        db.commit()
        db.refresh(road)
        return road
