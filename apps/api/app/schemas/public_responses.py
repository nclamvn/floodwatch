"""
Public Response Schemas

Phase 6: Production Security & Hardening
DTOs that redact PII for public API responses.
"""
import re
from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ============================================
# PII REDACTION UTILITIES
# ============================================

def mask_phone(phone: Optional[str]) -> Optional[str]:
    """
    Mask phone number for public display.
    Example: "0901234567" -> "090***4567"
    """
    if not phone:
        return None

    # Remove non-digits
    digits = re.sub(r'\D', '', phone)

    if len(digits) < 7:
        return "***"

    # Show first 3 and last 4 digits
    return f"{digits[:3]}***{digits[-4:]}"


def mask_email(email: Optional[str]) -> Optional[str]:
    """
    Mask email for public display.
    Example: "user@example.com" -> "u***@e***.com"
    """
    if not email or "@" not in email:
        return None

    local, domain = email.rsplit("@", 1)
    domain_parts = domain.split(".")

    masked_local = f"{local[0]}***" if local else "***"
    masked_domain = f"{domain_parts[0][0]}***" if domain_parts else "***"

    return f"{masked_local}@{masked_domain}.{domain_parts[-1] if len(domain_parts) > 1 else 'com'}"


def mask_name(name: Optional[str]) -> Optional[str]:
    """
    Mask name for public display.
    Example: "Nguyen Van A" -> "Nguyen V. A."
    """
    if not name:
        return None

    parts = name.strip().split()
    if len(parts) == 1:
        return f"{parts[0][0]}***" if parts[0] else "***"

    # Keep first name, initial others
    result = [parts[0]]
    for part in parts[1:]:
        if part:
            result.append(f"{part[0]}.")

    return " ".join(result)


def round_coordinates(lat: Optional[float], lon: Optional[float], precision: int = 2) -> tuple:
    """
    Round coordinates for privacy.
    Precision 2 = ~1km accuracy
    Precision 3 = ~100m accuracy
    """
    if lat is None or lon is None:
        return (None, None)

    return (round(lat, precision), round(lon, precision))


# ============================================
# PUBLIC HELP REQUEST SCHEMA
# ============================================

class PublicHelpRequestResponse(BaseModel):
    """Public-facing help request (PII redacted)"""
    id: str
    title: str
    description: str
    category: str
    urgency: str
    status: str

    # Location - slightly rounded for privacy
    lat: Optional[float] = None
    lon: Optional[float] = None
    province: Optional[str] = None
    district: Optional[str] = None

    # Contact info - masked
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Metadata
    people_count: Optional[int] = None
    is_verified: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Media (safe)
    media: List[str] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_db_model(cls, request, redact_pii: bool = True):
        """
        Create public response from database model.

        Args:
            request: HelpRequest database model
            redact_pii: Whether to redact PII (True for public, False for admin)
        """
        if redact_pii:
            lat, lon = round_coordinates(request.lat, request.lon, precision=3)
            contact_name = mask_name(request.contact_name)
            contact_phone = mask_phone(request.contact_phone)
        else:
            lat, lon = request.lat, request.lon
            contact_name = request.contact_name
            contact_phone = request.contact_phone

        return cls(
            id=str(request.id),
            title=request.title or "",
            description=request.description or "",
            category=request.category or "other",
            urgency=request.urgency or "medium",
            status=request.status or "active",
            lat=lat,
            lon=lon,
            province=request.province,
            district=request.district,
            contact_name=contact_name,
            contact_phone=contact_phone,
            people_count=request.people_count,
            is_verified=request.is_verified or False,
            created_at=request.created_at,
            updated_at=request.updated_at,
            media=request.media or []
        )


# ============================================
# PUBLIC HELP OFFER SCHEMA
# ============================================

class PublicHelpOfferResponse(BaseModel):
    """Public-facing help offer (PII redacted)"""
    id: str
    title: str
    description: str
    offer_type: str
    status: str

    # Location - slightly rounded for privacy
    lat: Optional[float] = None
    lon: Optional[float] = None
    coverage_radius_km: Optional[float] = None
    province: Optional[str] = None
    district: Optional[str] = None

    # Contact info - masked
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Metadata
    capacity: Optional[int] = None
    available_until: Optional[datetime] = None
    is_verified: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Media (safe)
    media: List[str] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_db_model(cls, offer, redact_pii: bool = True):
        """Create public response from database model."""
        if redact_pii:
            lat, lon = round_coordinates(offer.lat, offer.lon, precision=3)
            contact_name = mask_name(offer.contact_name)
            contact_phone = mask_phone(offer.contact_phone)
        else:
            lat, lon = offer.lat, offer.lon
            contact_name = offer.contact_name
            contact_phone = offer.contact_phone

        return cls(
            id=str(offer.id),
            title=offer.title or "",
            description=offer.description or "",
            offer_type=offer.offer_type or "general",
            status=offer.status or "active",
            lat=lat,
            lon=lon,
            coverage_radius_km=offer.coverage_radius_km,
            province=offer.province,
            district=offer.district,
            contact_name=contact_name,
            contact_phone=contact_phone,
            capacity=offer.capacity,
            available_until=offer.available_until,
            is_verified=offer.is_verified or False,
            created_at=offer.created_at,
            updated_at=offer.updated_at,
            media=offer.media or []
        )


# ============================================
# PUBLIC DISTRESS REPORT SCHEMA
# ============================================

class PublicDistressResponse(BaseModel):
    """Public-facing distress report (PII redacted)"""
    id: str
    description: str
    urgency: str
    status: str

    # Location - rounded for privacy
    lat: Optional[float] = None
    lon: Optional[float] = None
    province: Optional[str] = None
    district: Optional[str] = None

    # Masked contact
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Metadata
    people_count: Optional[int] = None
    has_children: bool = False
    has_elderly: bool = False
    has_disabled: bool = False
    needs_medical: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_db_model(cls, report, redact_pii: bool = True):
        """Create public response from database model."""
        if redact_pii:
            lat, lon = round_coordinates(report.lat, report.lon, precision=3)
            contact_name = mask_name(report.contact_name)
            contact_phone = mask_phone(report.contact_phone)
        else:
            lat, lon = report.lat, report.lon
            contact_name = report.contact_name
            contact_phone = report.contact_phone

        return cls(
            id=str(report.id),
            description=report.description or "",
            urgency=report.urgency or "medium",
            status=report.status or "pending",
            lat=lat,
            lon=lon,
            province=report.province,
            district=report.district,
            contact_name=contact_name,
            contact_phone=contact_phone,
            people_count=report.people_count,
            has_children=report.has_children or False,
            has_elderly=report.has_elderly or False,
            has_disabled=report.has_disabled or False,
            needs_medical=report.needs_medical or False,
            created_at=report.created_at
        )


# ============================================
# PAGINATED RESPONSE WRAPPER
# ============================================

class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""
    data: List[Any]
    total: int
    page: int
    per_page: int
    total_pages: int

    @classmethod
    def create(cls, items: List[Any], total: int, page: int, per_page: int):
        """Create paginated response"""
        total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        return cls(
            data=items,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )


# ============================================
# PII DOCUMENTATION
# ============================================

PII_FIELDS = {
    "contact_name": {
        "type": "name",
        "description": "Full name of contact person",
        "public_treatment": "Masked to first name + initials",
        "example": "Nguyen Van A -> Nguyen V. A."
    },
    "contact_phone": {
        "type": "phone",
        "description": "Phone number",
        "public_treatment": "Masked middle digits",
        "example": "0901234567 -> 090***4567"
    },
    "contact_email": {
        "type": "email",
        "description": "Email address",
        "public_treatment": "Masked local and domain parts",
        "example": "user@example.com -> u***@e***.com"
    },
    "lat/lon": {
        "type": "coordinates",
        "description": "Exact GPS location",
        "public_treatment": "Rounded to 3 decimal places (~100m accuracy)",
        "example": "10.12345 -> 10.123"
    },
    "address": {
        "type": "address",
        "description": "Full street address",
        "public_treatment": "Show only district/province",
        "example": "123 Nguyen Hue, Q1, HCM -> Q1, HCM"
    }
}


# Export
__all__ = [
    "mask_phone",
    "mask_email",
    "mask_name",
    "round_coordinates",
    "PublicHelpRequestResponse",
    "PublicHelpOfferResponse",
    "PublicDistressResponse",
    "PaginatedResponse",
    "PII_FIELDS",
]
