"""
Geocoding Service - Accurate location extraction for Vietnamese addresses.

This service implements a multi-tier geocoding strategy:

TIER 1: Landmark Database Lookup (Most Accurate)
    - Curated database of passes, bridges, roads, flood areas
    - Exact coordinates verified manually
    - Priority for disaster-prone locations

TIER 2: District-Level Geocoding
    - More precise than province-level
    - Uses district context from text

TIER 3: Province-Level Fallback
    - Uses province coordinates as last resort
    - Returns province center coordinates

TIER 4: Nominatim API (Optional, for unknown locations)
    - External geocoding service
    - Rate-limited, cached results
    - Used for completely unknown locations

The service prioritizes accuracy over coverage:
- Better to return None than wrong coordinates
- Log unknown locations for manual addition to landmark database
"""

import re
import logging
import hashlib
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

# Import landmark database
from app.services.landmark_database import (
    find_landmark_in_text,
    find_landmark_with_context,
    extract_district_context,
    Landmark,
)

# Import province extractor for fallback
from app.services.province_extractor import (
    extract_province_from_text,
    get_province_coordinates,
    PROVINCES,
)

logger = logging.getLogger(__name__)


@dataclass
class GeocodingResult:
    """Result from geocoding operation"""
    lat: float
    lon: float
    accuracy: str  # 'landmark', 'district', 'province', 'nominatim', 'unknown'
    confidence: float  # 0.0 to 1.0
    matched_name: str  # What was matched
    province: Optional[str] = None
    district: Optional[str] = None
    source: str = "internal"  # 'internal' or 'nominatim'


# =============================================================================
# DISTRICT DATABASE (More precise than province)
# =============================================================================

# Selected districts with coordinates (expand as needed)
DISTRICTS: Dict[str, Dict[str, Any]] = {
    # Bình Định Province
    "Phù Mỹ": {
        "lat": 14.1500, "lon": 109.0500,
        "province": "Bình Định",
        "aliases": ["Phu My", "huyện Phù Mỹ"]
    },
    "Hoài Nhơn": {
        "lat": 14.5167, "lon": 109.0333,
        "province": "Bình Định",
        "aliases": ["Hoai Nhon", "thị xã Hoài Nhơn"]
    },
    "Quy Nhơn": {
        "lat": 13.7830, "lon": 109.2196,
        "province": "Bình Định",
        "aliases": ["Quy Nhon", "thành phố Quy Nhơn", "TP Quy Nhơn"]
    },
    "An Nhơn": {
        "lat": 13.8833, "lon": 109.1000,
        "province": "Bình Định",
        "aliases": ["An Nhon", "thị xã An Nhơn"]
    },

    # Quảng Bình Province
    "Lệ Thủy": {
        "lat": 17.1000, "lon": 106.7167,
        "province": "Quảng Bình",
        "aliases": ["Le Thuy", "huyện Lệ Thủy"]
    },
    "Quảng Ninh (QB)": {
        "lat": 17.2333, "lon": 106.4833,
        "province": "Quảng Bình",
        "aliases": ["Quang Ninh QB", "huyện Quảng Ninh Quảng Bình"]
    },
    "Đồng Hới": {
        "lat": 17.4833, "lon": 106.6000,
        "province": "Quảng Bình",
        "aliases": ["Dong Hoi", "thành phố Đồng Hới", "TP Đồng Hới"]
    },

    # Quảng Trị Province
    "Đông Hà": {
        "lat": 16.8167, "lon": 107.1000,
        "province": "Quảng Trị",
        "aliases": ["Dong Ha", "thành phố Đông Hà", "TP Đông Hà"]
    },
    "Hải Lăng": {
        "lat": 16.7167, "lon": 107.2167,
        "province": "Quảng Trị",
        "aliases": ["Hai Lang", "huyện Hải Lăng"]
    },
    "Triệu Phong": {
        "lat": 16.8167, "lon": 107.2000,
        "province": "Quảng Trị",
        "aliases": ["Trieu Phong", "huyện Triệu Phong"]
    },

    # Thừa Thiên Huế Province
    "Phong Điền": {
        "lat": 16.5333, "lon": 107.3500,
        "province": "Thừa Thiên Huế",
        "aliases": ["Phong Dien", "huyện Phong Điền"]
    },
    "Quảng Điền": {
        "lat": 16.5667, "lon": 107.4833,
        "province": "Thừa Thiên Huế",
        "aliases": ["Quang Dien", "huyện Quảng Điền"]
    },
    "Huế": {
        "lat": 16.4637, "lon": 107.5909,
        "province": "Thừa Thiên Huế",
        "aliases": ["Hue", "thành phố Huế", "TP Huế"]
    },

    # Quảng Nam Province
    "Đại Lộc": {
        "lat": 15.8500, "lon": 108.0833,
        "province": "Quảng Nam",
        "aliases": ["Dai Loc", "huyện Đại Lộc"]
    },
    "Điện Bàn": {
        "lat": 15.8833, "lon": 108.2000,
        "province": "Quảng Nam",
        "aliases": ["Dien Ban", "thị xã Điện Bàn"]
    },
    "Tam Kỳ": {
        "lat": 15.5736, "lon": 108.4740,
        "province": "Quảng Nam",
        "aliases": ["Tam Ky", "thành phố Tam Kỳ", "TP Tam Kỳ"]
    },
    "Hội An": {
        "lat": 15.8794, "lon": 108.3350,
        "province": "Quảng Nam",
        "aliases": ["Hoi An", "thành phố Hội An", "TP Hội An"]
    },

    # Quảng Ngãi Province
    "Quảng Ngãi (TP)": {
        "lat": 15.1214, "lon": 108.8044,
        "province": "Quảng Ngãi",
        "aliases": ["Quang Ngai TP", "thành phố Quảng Ngãi", "TP Quảng Ngãi"]
    },
    "Đức Phổ": {
        "lat": 14.8000, "lon": 108.9500,
        "province": "Quảng Ngãi",
        "aliases": ["Duc Pho", "thị xã Đức Phổ"]
    },

    # Phú Yên Province
    "Tuy Hòa": {
        "lat": 13.0882, "lon": 109.3167,
        "province": "Phú Yên",
        "aliases": ["Tuy Hoa", "thành phố Tuy Hòa", "TP Tuy Hòa"]
    },
    "Đông Hòa": {
        "lat": 12.9500, "lon": 109.3167,
        "province": "Phú Yên",
        "aliases": ["Dong Hoa", "thị xã Đông Hòa"]
    },

    # Add more districts as needed...
}


def _remove_diacritics(text: str) -> str:
    """Remove Vietnamese diacritics"""
    vietnamese_chars = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'đ': 'd',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    }
    result = text.lower()
    for viet, ascii_char in vietnamese_chars.items():
        result = result.replace(viet, ascii_char)
    return result


def _find_district_in_text(text: str) -> Optional[Tuple[str, Dict]]:
    """
    Find a district mentioned in text.

    Returns:
        Tuple of (district_name, district_data) or None
    """
    if not text:
        return None

    text_lower = text.lower()
    text_normalized = _remove_diacritics(text_lower)

    for district_name, data in DISTRICTS.items():
        # Check canonical name
        if district_name.lower() in text_lower:
            return (district_name, data)

        normalized_name = _remove_diacritics(district_name.lower())
        if normalized_name in text_normalized:
            return (district_name, data)

        # Check aliases
        for alias in data.get("aliases", []):
            if alias.lower() in text_lower:
                return (district_name, data)
            if _remove_diacritics(alias.lower()) in text_normalized:
                return (district_name, data)

    return None


# =============================================================================
# NOMINATIM GEOCODING (Optional external service)
# =============================================================================

# Simple in-memory cache for Nominatim results
_nominatim_cache: Dict[str, Tuple[datetime, Optional[GeocodingResult]]] = {}
_NOMINATIM_CACHE_TTL = timedelta(hours=24)


async def _geocode_with_nominatim(
    query: str,
    country: str = "Vietnam"
) -> Optional[GeocodingResult]:
    """
    Geocode using OpenStreetMap Nominatim API.

    IMPORTANT: This is rate-limited (1 request/second for free tier).
    Results are cached for 24 hours.

    Args:
        query: Search query
        country: Country to search in

    Returns:
        GeocodingResult or None
    """
    try:
        import httpx
    except ImportError:
        logger.warning("httpx not installed, Nominatim geocoding disabled")
        return None

    # Check cache
    cache_key = hashlib.md5(f"{query}:{country}".encode()).hexdigest()
    if cache_key in _nominatim_cache:
        cached_time, cached_result = _nominatim_cache[cache_key]
        if datetime.utcnow() - cached_time < _NOMINATIM_CACHE_TTL:
            return cached_result

    # Make API request
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": f"{query}, {country}",
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1,
                },
                headers={
                    "User-Agent": "FloodWatch/1.0 (disaster-monitoring-app)"
                }
            )

            if response.status_code == 200:
                data = response.json()
                if data:
                    result = data[0]
                    geocoding_result = GeocodingResult(
                        lat=float(result["lat"]),
                        lon=float(result["lon"]),
                        accuracy="nominatim",
                        confidence=0.6,  # Lower confidence for external API
                        matched_name=result.get("display_name", query),
                        source="nominatim"
                    )
                    _nominatim_cache[cache_key] = (datetime.utcnow(), geocoding_result)
                    return geocoding_result

    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for '{query}': {e}")

    # Cache negative result
    _nominatim_cache[cache_key] = (datetime.utcnow(), None)
    return None


# =============================================================================
# MAIN GEOCODING FUNCTION
# =============================================================================

def geocode_vietnamese_text(
    text: str,
    province_hint: Optional[str] = None,
    use_nominatim: bool = False
) -> Optional[GeocodingResult]:
    """
    Geocode Vietnamese text to coordinates.

    This is the main geocoding function that implements the multi-tier strategy:
    1. Landmark database lookup (highest accuracy)
    2. District-level lookup
    3. Province-level fallback
    4. Nominatim API (if enabled)

    Args:
        text: Input text (news article, road name, etc.)
        province_hint: Known/suspected province for disambiguation
        use_nominatim: Whether to use external Nominatim API as fallback

    Returns:
        GeocodingResult with coordinates and accuracy info, or None

    Examples:
        >>> result = geocode_vietnamese_text("Đèo Nhông, huyện Phù Mỹ, Bình Định")
        >>> print(result.lat, result.lon, result.accuracy)
        14.0847 108.9203 landmark

        >>> result = geocode_vietnamese_text("Ngập lụt tại Quảng Bình")
        >>> print(result.accuracy)
        province
    """
    if not text:
        return None

    # =================================
    # TIER 1: Landmark Database Lookup
    # =================================
    # Extract province hint from text if not provided
    if not province_hint:
        province_hint = extract_province_from_text(text, use_fuzzy=False)

    # Extract district context
    district_hint = extract_district_context(text)

    # Try landmark lookup with context
    landmark = find_landmark_with_context(text, province_hint, district_hint)

    if landmark:
        logger.debug(f"Landmark match: '{landmark.name}' for text: {text[:50]}...")
        return GeocodingResult(
            lat=landmark.lat,
            lon=landmark.lon,
            accuracy="landmark",
            confidence=0.95,
            matched_name=landmark.name,
            province=landmark.province,
            district=landmark.district,
            source="internal"
        )

    # =================================
    # TIER 2: District-Level Lookup
    # =================================
    district_match = _find_district_in_text(text)

    if district_match:
        district_name, district_data = district_match
        logger.debug(f"District match: '{district_name}' for text: {text[:50]}...")
        return GeocodingResult(
            lat=district_data["lat"],
            lon=district_data["lon"],
            accuracy="district",
            confidence=0.8,
            matched_name=district_name,
            province=district_data["province"],
            district=district_name,
            source="internal"
        )

    # =================================
    # TIER 3: Province-Level Fallback
    # =================================
    # Use fuzzy matching for province as last resort
    province = extract_province_from_text(text, use_fuzzy=True)

    if province:
        coords = get_province_coordinates(province)
        if coords:
            logger.debug(f"Province match: '{province}' for text: {text[:50]}...")
            return GeocodingResult(
                lat=coords[0],
                lon=coords[1],
                accuracy="province",
                confidence=0.5,  # Lower confidence for province-level
                matched_name=province,
                province=province,
                source="internal"
            )

    # =================================
    # TIER 4: Nominatim API (Optional)
    # =================================
    # Note: This is synchronous version - for async, use geocode_vietnamese_text_async
    if use_nominatim:
        logger.info(f"No internal match, would use Nominatim for: {text[:50]}...")
        # Nominatim requires async - log for now
        # In production, use geocode_vietnamese_text_async()

    # No match found
    logger.warning(f"Geocoding failed for text: {text[:100]}...")
    return None


async def geocode_vietnamese_text_async(
    text: str,
    province_hint: Optional[str] = None,
    use_nominatim: bool = True
) -> Optional[GeocodingResult]:
    """
    Async version of geocode_vietnamese_text with Nominatim support.

    Use this version in async contexts (FastAPI endpoints, async scrapers).
    """
    # Try internal geocoding first
    result = geocode_vietnamese_text(text, province_hint, use_nominatim=False)

    if result:
        return result

    # Fall back to Nominatim
    if use_nominatim:
        # Clean up text for Nominatim query
        # Extract key location terms
        location_patterns = [
            r'(đèo\s+\w+)',
            r'(cầu\s+\w+)',
            r'(quốc\s*lộ\s+\d+\w*)',
            r'(QL\s*\d+\w*)',
            r'(đường\s+[^,]+)',
        ]

        query_parts = []
        for pattern in location_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                query_parts.append(match.group(1))

        # Add province if found
        province = extract_province_from_text(text, use_fuzzy=False)
        if province:
            query_parts.append(province)

        if query_parts:
            query = ", ".join(query_parts)
            return await _geocode_with_nominatim(query)

    return None


# =============================================================================
# DISAMBIGUATION HELPERS
# =============================================================================

def is_ambiguous_location(text: str) -> bool:
    """
    Check if a location name is potentially ambiguous.

    Ambiguous cases:
    - District name that also appears as a province name
    - Common road names without province context
    - Generic location descriptors

    Returns:
        True if location might be ambiguous
    """
    ambiguous_patterns = [
        # District names that match province names
        r'\bquảng ninh\b',  # District in QB vs Province
        r'\bphú mỹ\b',      # District in BD vs could match Phú Yên
        # Generic terms
        r'\btrung tâm\b',
        r'\bnội thành\b',
    ]

    text_lower = text.lower()
    for pattern in ambiguous_patterns:
        if re.search(pattern, text_lower):
            return True

    return False


def get_disambiguation_context(text: str) -> Dict[str, str]:
    """
    Extract all geographic context from text for disambiguation.

    Returns:
        Dict with keys: province, district, ward, road, landmark
    """
    context = {
        "province": None,
        "district": None,
        "ward": None,
        "road": None,
        "landmark": None,
    }

    # Extract province
    context["province"] = extract_province_from_text(text, use_fuzzy=False)

    # Extract district
    context["district"] = extract_district_context(text)

    # Extract ward (xã, phường, thị trấn)
    ward_patterns = [
        r'xã\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'phường\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'thị\s*trấn\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
    ]
    for pattern in ward_patterns:
        match = re.search(pattern, text.lower())
        if match:
            context["ward"] = match.group(1).strip()
            break

    # Extract road
    road_patterns = [
        r'(quốc\s*lộ\s+\d+\w*)',
        r'(QL\s*\d+\w*)',
        r'(tỉnh\s*lộ\s+\d+\w*)',
        r'(TL\s*\d+\w*)',
        r'(đường\s+[^,\.]+)',
    ]
    for pattern in road_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            context["road"] = match.group(1).strip()
            break

    # Check for landmark
    landmark = find_landmark_in_text(text)
    if landmark:
        context["landmark"] = landmark.name

    return context
