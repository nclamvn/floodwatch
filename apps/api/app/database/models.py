"""
SQLAlchemy ORM Models for FloodWatch
"""
from datetime import datetime
from uuid import uuid4
from typing import Optional

from sqlalchemy import (
    Column, String, Text, Float, DateTime, Integer, Boolean, Enum as SQLEnum, CheckConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography

from .db import Base

import enum


class ReportType(str, enum.Enum):
    """Report type enum"""
    ALERT = "ALERT"
    RAIN = "RAIN"
    ROAD = "ROAD"
    SOS = "SOS"
    NEEDS = "NEEDS"


class ReportStatus(str, enum.Enum):
    """Report status enum"""
    NEW = "new"
    VERIFIED = "verified"
    MERGED = "merged"
    RESOLVED = "resolved"
    INVALID = "invalid"


class RoadStatus(str, enum.Enum):
    """Road status enum"""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    RESTRICTED = "RESTRICTED"


class HazardType(str, enum.Enum):
    """Hazard type enum"""
    HEAVY_RAIN = "heavy_rain"
    FLOOD = "flood"
    DAM_RELEASE = "dam_release"
    LANDSLIDE = "landslide"
    STORM = "storm"
    TIDE_SURGE = "tide_surge"


class SeverityLevel(str, enum.Enum):
    """Severity level enum"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DistressStatus(str, enum.Enum):
    """Distress report status enum"""
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    FALSE_ALARM = "false_alarm"


class DistressUrgency(str, enum.Enum):
    """Distress report urgency enum"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DisruptionType(str, enum.Enum):
    """Traffic disruption type enum"""
    FLOODED_ROAD = "flooded_road"
    LANDSLIDE = "landslide"
    BRIDGE_COLLAPSED = "bridge_collapsed"
    BRIDGE_FLOODED = "bridge_flooded"
    TRAFFIC_JAM = "traffic_jam"
    ROAD_DAMAGED = "road_damaged"
    BLOCKED = "blocked"


class DisruptionSeverity(str, enum.Enum):
    """Traffic disruption severity enum"""
    IMPASSABLE = "impassable"
    DANGEROUS = "dangerous"
    SLOW = "slow"
    WARNING = "warning"


class Report(Base):
    """
    Report model - stores alerts, community reports, rainfall data
    """
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Type and source
    type = Column(SQLEnum(ReportType, name="report_type"), nullable=False)
    source = Column(String(100), nullable=False)

    # Content
    title = Column(String(500), nullable=False)
    description = Column(Text)

    # Location
    province = Column(String(100))
    district = Column(String(100))
    ward = Column(String(100))
    lat = Column(Float)
    lon = Column(Float)
    location = Column(Geography(geometry_type='POINT', srid=4326))

    # Metadata
    trust_score = Column(Float, default=0.0, nullable=False)
    media = Column(JSONB, default=list, nullable=False, server_default='[]')
    status = Column(String(50), default="new", nullable=False)
    duplicate_of = Column(UUID(as_uuid=True), nullable=True)  # Reference to original report if this is a duplicate

    # Audio (for AI voice news feature)
    audio_url = Column(String(500), nullable=True)  # Cloudinary MP3 URL
    audio_generated_at = Column(DateTime(timezone=True), nullable=True)  # When audio was generated
    audio_language = Column(String(10), default='vi', nullable=True)  # Language code (vi, en, etc.)

    # Constraints
    __table_args__ = (
        CheckConstraint('trust_score >= 0.0 AND trust_score <= 1.0', name='check_trust_score'),
        CheckConstraint("status IN ('new', 'verified', 'merged', 'resolved', 'invalid')", name='check_status'),
    )

    def __repr__(self):
        return f"<Report {self.id} [{self.type}] {self.title[:30]}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "type": self.type.value if isinstance(self.type, enum.Enum) else self.type,
            "source": self.source,
            "title": self.title,
            "description": self.description,
            "province": self.province,
            "district": self.district,
            "ward": self.ward,
            "lat": self.lat,
            "lon": self.lon,
            "trust_score": self.trust_score,
            "media": self.media,
            "status": self.status,
            "duplicate_of": str(self.duplicate_of) if self.duplicate_of else None
        }


class ApiKey(Base):
    """
    API Key model - stores API keys for programmatic access
    """
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True))

    # Key information
    name = Column(String(200), nullable=False)  # Descriptive name for the key
    key_hash = Column(String(64), nullable=False, unique=True)  # SHA-256 hash
    scopes = Column(JSONB, default=list, nullable=False, server_default='["read:public"]')
    rate_limit = Column(Integer, default=120, nullable=False)  # Requests per minute

    def __repr__(self):
        return f"<ApiKey {self.id} [{self.name}]>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "name": self.name,
            "scopes": self.scopes,
            "rate_limit": self.rate_limit
        }


class Subscription(Base):
    """
    Subscription model - stores webhook/telegram alert subscriptions
    """
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Organization info
    org_name = Column(String(200), nullable=False)

    # Filters
    provinces = Column(JSONB, default=list, nullable=False, server_default='[]')  # Empty = all provinces
    types = Column(JSONB, default=list, nullable=False, server_default='[]')  # Empty = all types
    min_trust = Column(Float, default=0.0, nullable=False)  # Minimum trust score

    # Delivery config
    callback_url = Column(Text, nullable=False)  # Webhook URL
    secret = Column(String(200), nullable=True)  # HMAC secret for webhooks

    def __repr__(self):
        return f"<Subscription {self.id} [{self.org_name}]>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "org_name": self.org_name,
            "provinces": self.provinces,
            "types": self.types,
            "min_trust": self.min_trust,
            "callback_url": self.callback_url
            # Note: secret is not included in public API response
        }


class Delivery(Base):
    """
    Delivery model - tracks alert deliveries to subscriptions
    """
    __tablename__ = "deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True))

    # References
    subscription_id = Column(UUID(as_uuid=True), nullable=False)
    report_id = Column(UUID(as_uuid=True), nullable=False)

    # Status tracking
    status = Column(String(50), default="pending", nullable=False)  # pending, sent, failed
    attempts = Column(Integer, default=0, nullable=False)
    last_error = Column(Text)

    def __repr__(self):
        return f"<Delivery {self.id} [{self.status}]>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "subscription_id": str(self.subscription_id),
            "report_id": str(self.report_id),
            "status": self.status,
            "attempts": self.attempts,
            "last_error": self.last_error
        }


class RoadEvent(Base):
    """
    Road Event model - stores road status information
    """
    __tablename__ = "road_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Road information
    segment_name = Column(String(500), nullable=False)
    status = Column(SQLEnum(RoadStatus, name="road_status"), nullable=False)
    reason = Column(Text)

    # Location
    province = Column(String(100))
    district = Column(String(100))
    lat = Column(Float)
    lon = Column(Float)
    location = Column(Geography(geometry_type='POINT', srid=4326))

    # Verification
    last_verified = Column(DateTime(timezone=True))
    source = Column(String(100), default="PRESS")

    def __repr__(self):
        return f"<RoadEvent {self.id} [{self.status}] {self.segment_name[:30]}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "segment_name": self.segment_name,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "reason": self.reason,
            "province": self.province,
            "district": self.district,
            "lat": self.lat,
            "lon": self.lon,
            "last_verified": self.last_verified.isoformat() if self.last_verified else None,
            "source": self.source
        }


class TelegramSubscription(Base):
    """
    Telegram Subscription model - stores Telegram bot subscriptions
    """
    __tablename__ = "telegram_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Telegram user info
    chat_id = Column(Integer, unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=True)

    # Subscription settings
    is_active = Column(Boolean, default=True, nullable=False)
    provinces = Column(JSONB, default=list, nullable=False, server_default='[]')
    min_trust_score = Column(Float, default=0.5, nullable=False)  # Only send alerts with trust >= 0.5

    def __repr__(self):
        return f"<TelegramSubscription {self.id} chat_id={self.chat_id}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "chat_id": self.chat_id,
            "username": self.username,
            "is_active": self.is_active,
            "provinces": self.provinces,
            "min_trust_score": self.min_trust_score
        }


class HazardEvent(Base):
    """
    Hazard Event model - stores natural disaster events
    """
    __tablename__ = "hazard_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Event classification
    type = Column(SQLEnum(HazardType, name="hazard_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    severity = Column(SQLEnum(SeverityLevel, name="severity_level", values_callable=lambda x: [e.value for e in x]), nullable=False)

    # Spatial data (PostGIS)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    affected_area = Column(Geography(geometry_type='POLYGON', srid=4326), nullable=True)
    radius_km = Column(Float, nullable=True)

    # Lat/lon for convenience (auto-populated from location via trigger)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)

    # Time range
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)

    # Data source
    source = Column(String(100), nullable=False)
    external_id = Column(String(255), nullable=True)
    raw_payload = Column(JSONB, nullable=True)

    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('radius_km IS NULL OR radius_km > 0', name='check_valid_radius'),
    )

    def __repr__(self):
        return f"<HazardEvent {self.id} [{self.type.value}] severity={self.severity.value}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "type": self.type.value if isinstance(self.type, enum.Enum) else self.type,
            "severity": self.severity.value if isinstance(self.severity, enum.Enum) else self.severity,
            "lat": self.lat,
            "lon": self.lon,
            "radius_km": self.radius_km,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "source": self.source,
            "external_id": self.external_id,
            "raw_payload": self.raw_payload,
            "created_by": str(self.created_by) if self.created_by else None
        }


class DistressReport(Base):
    """
    Distress Report model - emergency rescue requests from citizens
    """
    __tablename__ = "distress_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Location (PostGIS)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)

    # Status & Urgency
    status = Column(SQLEnum(DistressStatus, name="distress_status", values_callable=lambda x: [e.value for e in x]), nullable=False, server_default="pending")
    urgency = Column(SQLEnum(DistressUrgency, name="distress_urgency", values_callable=lambda x: [e.value for e in x]), nullable=False, server_default="high")

    # Report Details
    description = Column(Text, nullable=False)
    num_people = Column(Integer, nullable=False, server_default="1")
    has_injuries = Column(Boolean, nullable=False, server_default="false")
    has_children = Column(Boolean, nullable=False, server_default="false")
    has_elderly = Column(Boolean, nullable=False, server_default="false")

    # Contact Info
    contact_name = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)

    # Media
    from sqlalchemy.dialects.postgresql import ARRAY
    media_urls = Column(ARRAY(Text), nullable=True)

    # Source & Verification
    source = Column(String(50), nullable=False, server_default="user_report")
    verified = Column(Boolean, nullable=False, server_default="false")
    verified_by = Column(String(255), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    # Admin
    admin_notes = Column(Text, nullable=True)
    assigned_to = Column(String(255), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('num_people >= 1', name='check_positive_people_count'),
        CheckConstraint('char_length(description) >= 10', name='check_min_description_length'),
    )

    def __repr__(self):
        return f"<DistressReport {self.id} [{self.urgency.value}] status={self.status.value}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "urgency": self.urgency.value if isinstance(self.urgency, enum.Enum) else self.urgency,
            "lat": self.lat,
            "lon": self.lon,
            "description": self.description,
            "num_people": self.num_people,
            "has_injuries": self.has_injuries,
            "has_children": self.has_children,
            "has_elderly": self.has_elderly,
            "contact_name": self.contact_name,
            "contact_phone": self.contact_phone,
            "media_urls": self.media_urls,
            "source": self.source,
            "verified": self.verified,
            "verified_by": self.verified_by,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "admin_notes": self.admin_notes,
            "assigned_to": self.assigned_to,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }


class AIForecast(Base):
    """
    AI Forecast model - ML-based predictions for future hazard events
    """
    __tablename__ = "ai_forecasts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Forecast classification
    type = Column(SQLEnum(HazardType, name="forecast_hazard_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    severity = Column(SQLEnum(SeverityLevel, name="forecast_severity", values_callable=lambda x: [e.value for e in x]), nullable=False)
    confidence = Column(Float, nullable=False)  # 0.0-1.0

    # Spatial data (PostGIS)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    affected_area = Column(Geography(geometry_type='POLYGON', srid=4326), nullable=True)
    radius_km = Column(Float, nullable=True)

    # Lat/lon for convenience
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)

    # Timing - when the forecast is for
    forecast_time = Column(DateTime(timezone=True), nullable=False)  # When the hazard is predicted to occur
    valid_until = Column(DateTime(timezone=True), nullable=False)  # When this forecast expires

    # AI Model metadata
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False)
    training_data_date = Column(DateTime(timezone=True), nullable=True)

    # Prediction details
    summary = Column(Text, nullable=True)  # AI-generated summary text
    predicted_intensity = Column(Float, nullable=True)  # Model-specific intensity measure
    predicted_duration_hours = Column(Float, nullable=True)
    risk_factors = Column(JSONB, nullable=True)  # List of contributing risk factors
    data_sources = Column(JSONB, default=list, nullable=False, server_default='[]')  # Sources used by model
    raw_output = Column(JSONB, nullable=True)  # Full model output for debugging

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)  # If later confirmed by real event
    actual_event_id = Column(UUID(as_uuid=True), nullable=True)  # Link to HazardEvent if forecast became reality

    # Source
    source = Column(String(100), nullable=False, server_default="AI_MODEL")
    created_by = Column(UUID(as_uuid=True), nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('confidence >= 0.0 AND confidence <= 1.0', name='check_forecast_confidence'),
        CheckConstraint('radius_km IS NULL OR radius_km > 0', name='check_forecast_radius'),
        CheckConstraint('predicted_duration_hours IS NULL OR predicted_duration_hours > 0', name='check_forecast_duration'),
    )

    def __repr__(self):
        return f"<AIForecast {self.id} [{self.type.value}] confidence={self.confidence:.2f}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "type": self.type.value if isinstance(self.type, enum.Enum) else self.type,
            "severity": self.severity.value if isinstance(self.severity, enum.Enum) else self.severity,
            "confidence": self.confidence,
            "lat": self.lat,
            "lon": self.lon,
            "radius_km": self.radius_km,
            "forecast_time": self.forecast_time.isoformat() if self.forecast_time else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "training_data_date": self.training_data_date.isoformat() if self.training_data_date else None,
            "summary": self.summary,
            "predicted_intensity": self.predicted_intensity,
            "predicted_duration_hours": self.predicted_duration_hours,
            "risk_factors": self.risk_factors,
            "data_sources": self.data_sources,
            "raw_output": self.raw_output,
            "is_active": self.is_active,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "actual_event_id": str(self.actual_event_id) if self.actual_event_id else None,
            "source": self.source,
            "created_by": str(self.created_by) if self.created_by else None
        }


class TrafficDisruption(Base):
    """
    Traffic Disruption model - road closures, bridge collapses, landslides
    """
    __tablename__ = "traffic_disruptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Location
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    road_geometry = Column(Geography(geometry_type='LINESTRING', srid=4326), nullable=True)

    # Disruption Details
    type = Column(SQLEnum(DisruptionType, name="disruption_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    severity = Column(SQLEnum(DisruptionSeverity, name="disruption_severity", values_callable=lambda x: [e.value for e in x]), nullable=False, server_default="impassable")

    # Location Description
    road_name = Column(String(255), nullable=True)
    location_description = Column(Text, nullable=False)

    # Impact
    description = Column(Text, nullable=True)
    estimated_clearance = Column(DateTime(timezone=True), nullable=True)
    alternative_route = Column(Text, nullable=True)

    # Time Range
    starts_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ends_at = Column(DateTime(timezone=True), nullable=True)

    # Source & Status
    source = Column(String(100), nullable=False)
    verified = Column(Boolean, nullable=False, server_default="false")
    is_active = Column(Boolean, nullable=False, server_default="true")

    # Related Hazard
    hazard_event_id = Column(UUID(as_uuid=True), nullable=True)

    # Media
    from sqlalchemy.dialects.postgresql import ARRAY
    media_urls = Column(ARRAY(Text), nullable=True)

    # Admin
    admin_notes = Column(Text, nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('char_length(location_description) >= 10', name='check_min_location_description'),
    )

    def __repr__(self):
        return f"<TrafficDisruption {self.id} [{self.type.value}] {self.severity.value}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "type": self.type.value if isinstance(self.type, enum.Enum) else self.type,
            "severity": self.severity.value if isinstance(self.severity, enum.Enum) else self.severity,
            "lat": self.lat,
            "lon": self.lon,
            "road_name": self.road_name,
            "location_description": self.location_description,
            "description": self.description,
            "estimated_clearance": self.estimated_clearance.isoformat() if self.estimated_clearance else None,
            "alternative_route": self.alternative_route,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "source": self.source,
            "verified": self.verified,
            "is_active": self.is_active,
            "hazard_event_id": str(self.hazard_event_id) if self.hazard_event_id else None,
            "media_urls": self.media_urls,
            "admin_notes": self.admin_notes
        }


class NeedsType(str, enum.Enum):
    """Help request needs type enum"""
    FOOD = "food"
    WATER = "water"
    SHELTER = "shelter"
    MEDICAL = "medical"
    CLOTHING = "clothing"
    TRANSPORT = "transport"
    OTHER = "other"


class ServiceType(str, enum.Enum):
    """Help offer service type enum"""
    RESCUE = "rescue"
    TRANSPORTATION = "transportation"
    MEDICAL = "medical"
    SHELTER = "shelter"
    FOOD_WATER = "food_water"
    SUPPLIES = "supplies"
    VOLUNTEER = "volunteer"
    DONATION = "donation"
    OTHER = "other"


class HelpStatus(str, enum.Enum):
    """Help connection status enum"""
    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    FULFILLED = "fulfilled"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class HelpUrgency(str, enum.Enum):
    """Help request urgency enum"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class HelpRequest(Base):
    """
    Help Request model - people requesting assistance during disasters
    """
    __tablename__ = "help_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Request details
    needs_type = Column(SQLEnum(NeedsType, name="needs_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    urgency = Column(SQLEnum(HelpUrgency, name="help_urgency", values_callable=lambda x: [e.value for e in x]), nullable=False)
    status = Column(SQLEnum(HelpStatus, name="help_status", values_callable=lambda x: [e.value for e in x]), nullable=False, server_default="active")
    description = Column(Text, nullable=False)
    people_count = Column(Integer, nullable=True)

    # Spatial data (PostGIS)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    address = Column(String(500), nullable=True)

    # Contact information
    contact_name = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=False)
    contact_method = Column(String(50), nullable=True)

    # Verification
    is_verified = Column(Boolean, nullable=False, server_default="false")
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(UUID(as_uuid=True), nullable=True)

    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    notes = Column(Text, nullable=True)
    images = Column(JSONB, nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('people_count IS NULL OR people_count > 0', name='check_positive_people_count'),
    )

    def __repr__(self):
        return f"<HelpRequest {self.id} [{self.needs_type.value}] urgency={self.urgency.value}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "needs_type": self.needs_type.value if isinstance(self.needs_type, enum.Enum) else self.needs_type,
            "urgency": self.urgency.value if isinstance(self.urgency, enum.Enum) else self.urgency,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "description": self.description,
            "people_count": self.people_count,
            "lat": self.lat,
            "lon": self.lon,
            "address": self.address,
            "contact_name": self.contact_name,
            "contact_phone": self.contact_phone,
            "contact_method": self.contact_method,
            "is_verified": self.is_verified,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "verified_by": str(self.verified_by) if self.verified_by else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "notes": self.notes,
            "images": self.images
        }


class HelpOffer(Base):
    """
    Help Offer model - people/organizations offering assistance during disasters
    """
    __tablename__ = "help_offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Offer details
    service_type = Column(SQLEnum(ServiceType, name="service_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    status = Column(SQLEnum(HelpStatus, name="help_status", values_callable=lambda x: [e.value for e in x]), nullable=False, server_default="active")
    description = Column(Text, nullable=False)
    capacity = Column(Integer, nullable=True)
    availability = Column(String(500), nullable=True)

    # Spatial data (PostGIS)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    address = Column(String(500), nullable=True)
    coverage_radius_km = Column(Float, nullable=True)

    # Contact information
    contact_name = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=False)
    contact_method = Column(String(50), nullable=True)
    organization = Column(String(255), nullable=True)

    # Verification
    is_verified = Column(Boolean, nullable=False, server_default="false")
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(UUID(as_uuid=True), nullable=True)

    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    notes = Column(Text, nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint('capacity IS NULL OR capacity > 0', name='check_positive_capacity'),
        CheckConstraint('coverage_radius_km IS NULL OR coverage_radius_km > 0', name='check_positive_coverage_radius'),
    )

    def __repr__(self):
        return f"<HelpOffer {self.id} [{self.service_type.value}] status={self.status.value}>"

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "service_type": self.service_type.value if isinstance(self.service_type, enum.Enum) else self.service_type,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "description": self.description,
            "capacity": self.capacity,
            "availability": self.availability,
            "lat": self.lat,
            "lon": self.lon,
            "address": self.address,
            "coverage_radius_km": self.coverage_radius_km,
            "contact_name": self.contact_name,
            "contact_phone": self.contact_phone,
            "contact_method": self.contact_method,
            "organization": self.organization,
            "is_verified": self.is_verified,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "verified_by": str(self.verified_by) if self.verified_by else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "notes": self.notes
        }
