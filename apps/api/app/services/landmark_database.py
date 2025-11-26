"""
Landmark Database - Curated coordinates for Vietnamese roads, passes, bridges, and notable locations.

This database provides accurate coordinates for specific landmarks that are commonly
mentioned in flood/disaster news but cannot be reliably geocoded by province-level lookup.

The database is organized by:
1. Passes (Đèo) - Mountain passes, often flood/landslide prone
2. Bridges (Cầu) - Bridges, often flood affected
3. National Roads (Quốc lộ) - Major highway segments
4. Notable flood-prone areas

Each entry contains:
- name: Canonical Vietnamese name
- lat/lon: Accurate coordinates
- province: Parent province
- district: Parent district (optional)
- aliases: Alternative names for matching
- notes: Additional context

IMPORTANT: This is a curated database. Coordinates have been verified.
When adding new entries, always verify coordinates from multiple sources.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re


@dataclass
class Landmark:
    """A geographic landmark with verified coordinates"""
    name: str
    lat: float
    lon: float
    province: str
    district: Optional[str] = None
    landmark_type: str = "other"  # pass, bridge, road, area
    aliases: List[str] = None
    notes: str = ""

    def __post_init__(self):
        if self.aliases is None:
            self.aliases = []


# =============================================================================
# MOUNTAIN PASSES (ĐÈO) - Often landslide/flood prone
# =============================================================================

PASSES: Dict[str, Landmark] = {
    # Bình Định Province
    "Đèo Nhông": Landmark(
        name="Đèo Nhông",
        lat=14.0847,
        lon=108.9203,
        province="Bình Định",
        district="Phù Mỹ",
        landmark_type="pass",
        aliases=["Deo Nhong", "đèo Nhông Phù Mỹ", "Nhong Pass"],
        notes="Pass in Phu My district, Binh Dinh. Often confused with 'Deo Phu My'"
    ),

    "Đèo Cù Mông": Landmark(
        name="Đèo Cù Mông",
        lat=13.6108,
        lon=109.2025,
        province="Bình Định",
        district="",
        landmark_type="pass",
        aliases=["Deo Cu Mong", "Cu Mong Pass", "đèo Cù Mông"],
        notes="Major pass between Binh Dinh and Phu Yen provinces on QL1A"
    ),

    # Phú Yên Province
    "Đèo Cả": Landmark(
        name="Đèo Cả",
        lat=12.9556,
        lon=109.4306,
        province="Phú Yên",
        district="Đông Hòa",
        landmark_type="pass",
        aliases=["Deo Ca", "Ca Pass", "Đèo Cả Phú Yên"],
        notes="Famous pass between Phu Yen and Khanh Hoa on QL1A. Has tunnel."
    ),

    # Khánh Hòa Province
    "Đèo Rù Rì": Landmark(
        name="Đèo Rù Rì",
        lat=12.3861,
        lon=109.1558,
        province="Khánh Hòa",
        district="Nha Trang",
        landmark_type="pass",
        aliases=["Deo Ru Ri", "Ru Ri Pass"],
        notes="Pass near Nha Trang city"
    ),

    # Quảng Nam Province
    "Đèo Lò Xo": Landmark(
        name="Đèo Lò Xo",
        lat=15.4983,
        lon=107.7178,
        province="Quảng Nam",
        district="Nam Giang",
        landmark_type="pass",
        aliases=["Deo Lo Xo", "Lo Xo Pass", "đèo Lò Xo"],
        notes="Dangerous pass on Ho Chi Minh Road, prone to landslides"
    ),

    # Thừa Thiên Huế Province
    "Đèo Hải Vân": Landmark(
        name="Đèo Hải Vân",
        lat=16.1811,
        lon=108.1325,
        province="Thừa Thiên Huế",
        district="",
        landmark_type="pass",
        aliases=["Deo Hai Van", "Hai Van Pass", "Ocean Cloud Pass"],
        notes="Famous pass between Hue and Da Nang. Has tunnel bypass."
    ),

    # Quảng Bình Province
    "Đèo Ngang": Landmark(
        name="Đèo Ngang",
        lat=18.0789,
        lon=106.4308,
        province="Quảng Bình",
        district="",
        landmark_type="pass",
        aliases=["Deo Ngang", "Ngang Pass", "Hoành Sơn"],
        notes="Historic pass between Ha Tinh and Quang Binh"
    ),

    # Lào Cai Province
    "Đèo Ô Quý Hồ": Landmark(
        name="Đèo Ô Quý Hồ",
        lat=22.3542,
        lon=103.7694,
        province="Lào Cai",
        district="Sa Pa",
        landmark_type="pass",
        aliases=["Deo O Quy Ho", "O Quy Ho Pass", "đèo Ô Quý Hồ", "Tramton Pass"],
        notes="Highest pass in Vietnam, prone to fog and landslides"
    ),

    # Sơn La Province
    "Đèo Pha Đin": Landmark(
        name="Đèo Pha Đin",
        lat=21.5731,
        lon=103.5036,
        province="Sơn La",
        district="",
        landmark_type="pass",
        aliases=["Deo Pha Din", "Pha Din Pass"],
        notes="Historic pass on road to Dien Bien Phu"
    ),

    # Hòa Bình Province
    "Đèo Thung Khe": Landmark(
        name="Đèo Thung Khe",
        lat=20.5256,
        lon=105.2472,
        province="Hòa Bình",
        district="Mai Châu",
        landmark_type="pass",
        aliases=["Deo Thung Khe", "Thung Khe Pass", "đèo Thung Khe"],
        notes="Pass on road to Mai Chau, fog prone"
    ),

    # Lâm Đồng Province
    "Đèo Prenn": Landmark(
        name="Đèo Prenn",
        lat=11.9033,
        lon=108.4256,
        province="Lâm Đồng",
        district="Đà Lạt",
        landmark_type="pass",
        aliases=["Deo Prenn", "Prenn Pass"],
        notes="Pass leading to Da Lat city"
    ),

    "Đèo Bảo Lộc": Landmark(
        name="Đèo Bảo Lộc",
        lat=11.5647,
        lon=107.8117,
        province="Lâm Đồng",
        district="Bảo Lộc",
        landmark_type="pass",
        aliases=["Deo Bao Loc", "Bao Loc Pass"],
        notes="Major pass, often has landslides"
    ),

    # Ninh Thuận Province
    "Đèo Ngoạn Mục": Landmark(
        name="Đèo Ngoạn Mục",
        lat=11.6478,
        lon=108.6869,
        province="Ninh Thuận",
        district="",
        landmark_type="pass",
        aliases=["Deo Ngoan Muc", "Ngoan Muc Pass", "đèo Ngoạn Mục"],
        notes="Scenic pass between Ninh Thuan and Lam Dong"
    ),

    # Bình Thuận Province
    "Đèo Cậu": Landmark(
        name="Đèo Cậu",
        lat=11.0447,
        lon=108.0583,
        province="Bình Thuận",
        district="",
        landmark_type="pass",
        aliases=["Deo Cau"],
        notes="Pass in Binh Thuan province"
    ),
}


# =============================================================================
# BRIDGES (CẦU) - Often flood affected
# =============================================================================

BRIDGES: Dict[str, Landmark] = {
    # Major bridges
    "Cầu Long Biên": Landmark(
        name="Cầu Long Biên",
        lat=21.0419,
        lon=105.8569,
        province="Hà Nội",
        district="",
        landmark_type="bridge",
        aliases=["Cau Long Bien", "Long Bien Bridge"],
        notes="Historic bridge across Red River in Hanoi"
    ),

    "Cầu Thăng Long": Landmark(
        name="Cầu Thăng Long",
        lat=21.0811,
        lon=105.7994,
        province="Hà Nội",
        district="",
        landmark_type="bridge",
        aliases=["Cau Thang Long", "Thang Long Bridge"],
        notes="Major bridge in Hanoi"
    ),

    "Cầu Chương Dương": Landmark(
        name="Cầu Chương Dương",
        lat=21.0283,
        lon=105.8742,
        province="Hà Nội",
        district="",
        landmark_type="bridge",
        aliases=["Cau Chuong Duong", "Chuong Duong Bridge"],
        notes="Bridge in Hanoi"
    ),

    "Cầu Mỹ Thuận": Landmark(
        name="Cầu Mỹ Thuận",
        lat=10.2769,
        lon=105.8758,
        province="Vĩnh Long",
        district="",
        landmark_type="bridge",
        aliases=["Cau My Thuan", "My Thuan Bridge"],
        notes="Cable-stayed bridge crossing Mekong River"
    ),

    "Cầu Cần Thơ": Landmark(
        name="Cầu Cần Thơ",
        lat=10.0400,
        lon=105.7394,
        province="Cần Thơ",
        district="",
        landmark_type="bridge",
        aliases=["Cau Can Tho", "Can Tho Bridge"],
        notes="Major bridge in Mekong Delta"
    ),

    "Cầu Rồng": Landmark(
        name="Cầu Rồng",
        lat=16.0614,
        lon=108.2272,
        province="Đà Nẵng",
        district="",
        landmark_type="bridge",
        aliases=["Cau Rong", "Dragon Bridge"],
        notes="Famous dragon-shaped bridge in Da Nang"
    ),

    "Cầu Thuận Phước": Landmark(
        name="Cầu Thuận Phước",
        lat=16.1003,
        lon=108.2106,
        province="Đà Nẵng",
        district="",
        landmark_type="bridge",
        aliases=["Cau Thuan Phuoc", "Thuan Phuoc Bridge"],
        notes="Suspension bridge in Da Nang"
    ),

    # Flood-prone bridges in Central Vietnam
    "Cầu Thạch Hãn": Landmark(
        name="Cầu Thạch Hãn",
        lat=16.7619,
        lon=107.1819,
        province="Quảng Trị",
        district="",
        landmark_type="bridge",
        aliases=["Cau Thach Han", "Thach Han Bridge"],
        notes="Bridge over Thach Han River, often flooded"
    ),

    "Cầu Hiền Lương": Landmark(
        name="Cầu Hiền Lương",
        lat=17.0017,
        lon=107.0011,
        province="Quảng Trị",
        district="",
        landmark_type="bridge",
        aliases=["Cau Hien Luong", "Hien Luong Bridge", "Ben Hai Bridge"],
        notes="Historic bridge on former DMZ"
    ),
}


# =============================================================================
# NATIONAL ROADS (QUỐC LỘ) - Key segments
# =============================================================================

ROADS: Dict[str, Landmark] = {
    # QL1A segments
    "Quốc lộ 1A đoạn Quảng Bình": Landmark(
        name="Quốc lộ 1A đoạn Quảng Bình",
        lat=17.4694,
        lon=106.5994,
        province="Quảng Bình",
        district="",
        landmark_type="road",
        aliases=["QL1A Quang Binh", "QL 1A Quảng Bình"],
        notes="Flood-prone section of QL1A"
    ),

    "Quốc lộ 1A đoạn Quảng Trị": Landmark(
        name="Quốc lộ 1A đoạn Quảng Trị",
        lat=16.7619,
        lon=107.1819,
        province="Quảng Trị",
        district="",
        landmark_type="road",
        aliases=["QL1A Quang Tri", "QL 1A Quảng Trị"],
        notes="Often flooded during monsoon"
    ),

    # Ho Chi Minh Road
    "Đường Hồ Chí Minh đoạn Quảng Bình": Landmark(
        name="Đường Hồ Chí Minh đoạn Quảng Bình",
        lat=17.5500,
        lon=106.2000,
        province="Quảng Bình",
        district="",
        landmark_type="road",
        aliases=["Duong HCM Quang Binh", "Ho Chi Minh Road Quang Binh"],
        notes="Mountain section, landslide prone"
    ),
}


# =============================================================================
# NOTABLE FLOOD-PRONE AREAS
# =============================================================================

FLOOD_AREAS: Dict[str, Landmark] = {
    # Quảng Bình flood areas
    "Lệ Thủy": Landmark(
        name="Lệ Thủy",
        lat=17.1000,
        lon=106.7167,
        province="Quảng Bình",
        district="Lệ Thủy",
        landmark_type="area",
        aliases=["Le Thuy", "huyện Lệ Thủy"],
        notes="Extremely flood-prone district"
    ),

    "Quảng Ninh (Quảng Bình)": Landmark(
        name="Quảng Ninh",
        lat=17.2333,
        lon=106.4833,
        province="Quảng Bình",
        district="Quảng Ninh",
        landmark_type="area",
        aliases=["Quang Ninh Quang Binh", "huyện Quảng Ninh QB"],
        notes="Flood-prone district in Quang Binh (not Quang Ninh province)"
    ),

    # Thừa Thiên Huế flood areas
    "Phong Điền": Landmark(
        name="Phong Điền",
        lat=16.5333,
        lon=107.3500,
        province="Thừa Thiên Huế",
        district="Phong Điền",
        landmark_type="area",
        aliases=["Phong Dien", "huyện Phong Điền"],
        notes="Flood-prone district in Hue"
    ),

    # Quảng Nam flood areas
    "Đại Lộc": Landmark(
        name="Đại Lộc",
        lat=15.8500,
        lon=108.0833,
        province="Quảng Nam",
        district="Đại Lộc",
        landmark_type="area",
        aliases=["Dai Loc", "huyện Đại Lộc"],
        notes="Frequent flooding from Vu Gia River"
    ),

    "Điện Bàn": Landmark(
        name="Điện Bàn",
        lat=15.8833,
        lon=108.2000,
        province="Quảng Nam",
        district="Điện Bàn",
        landmark_type="area",
        aliases=["Dien Ban", "thị xã Điện Bàn"],
        notes="Low-lying area, often flooded"
    ),
}


# =============================================================================
# COMBINED DATABASE
# =============================================================================

# Merge all landmarks into one database
ALL_LANDMARKS: Dict[str, Landmark] = {}
ALL_LANDMARKS.update(PASSES)
ALL_LANDMARKS.update(BRIDGES)
ALL_LANDMARKS.update(ROADS)
ALL_LANDMARKS.update(FLOOD_AREAS)


# =============================================================================
# LOOKUP FUNCTIONS
# =============================================================================

def remove_vietnamese_diacritics(text: str) -> str:
    """Remove Vietnamese diacritics for matching"""
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
        result = result.replace(viet.upper(), ascii_char)
    return result


def normalize_landmark_text(text: str) -> str:
    """Normalize text for landmark matching"""
    if not text:
        return ""

    # Lowercase and remove diacritics
    text = remove_vietnamese_diacritics(text.lower())

    # Normalize common prefixes
    text = re.sub(r'\bdeo\b', 'đèo', text)
    text = re.sub(r'\bcau\b', 'cầu', text)
    text = re.sub(r'\bql\s*(\d)', r'quốc lộ \1', text)
    text = re.sub(r'\bquoc lo\b', 'quốc lộ', text)
    text = re.sub(r'\bduong\b', 'đường', text)

    # Remove extra whitespace
    text = ' '.join(text.split())

    return text


def find_landmark_in_text(text: str) -> Optional[Landmark]:
    """
    Find a landmark mentioned in text.

    This function looks for specific landmark names in the text and returns
    the matching landmark with accurate coordinates.

    Priority:
    1. Exact name match
    2. Alias match
    3. Partial match (landmark name appears in text)

    Args:
        text: Input text (news article, road description, etc.)

    Returns:
        Landmark object if found, None otherwise

    Example:
        >>> find_landmark_in_text("Sạt lở tại đèo Nhông, huyện Phù Mỹ")
        Landmark(name="Đèo Nhông", lat=14.0847, lon=108.9203, ...)
    """
    if not text:
        return None

    normalized_text = normalize_landmark_text(text)
    text_lower = text.lower()

    best_match: Optional[Landmark] = None
    best_match_length = 0

    for name, landmark in ALL_LANDMARKS.items():
        # Check canonical name
        normalized_name = normalize_landmark_text(name)
        if normalized_name in normalized_text or name.lower() in text_lower:
            if len(name) > best_match_length:
                best_match = landmark
                best_match_length = len(name)
                continue

        # Check aliases
        for alias in landmark.aliases:
            normalized_alias = normalize_landmark_text(alias)
            if normalized_alias in normalized_text or alias.lower() in text_lower:
                if len(alias) > best_match_length:
                    best_match = landmark
                    best_match_length = len(alias)

    return best_match


def get_landmark_coordinates(name: str) -> Optional[Tuple[float, float]]:
    """
    Get coordinates for a specific landmark by name.

    Args:
        name: Landmark name (canonical or alias)

    Returns:
        Tuple of (lat, lon) or None if not found
    """
    # Direct lookup
    if name in ALL_LANDMARKS:
        lm = ALL_LANDMARKS[name]
        return (lm.lat, lm.lon)

    # Search by normalized name or alias
    normalized_input = normalize_landmark_text(name)

    for canonical, landmark in ALL_LANDMARKS.items():
        if normalize_landmark_text(canonical) == normalized_input:
            return (landmark.lat, landmark.lon)

        for alias in landmark.aliases:
            if normalize_landmark_text(alias) == normalized_input:
                return (landmark.lat, landmark.lon)

    return None


def get_landmarks_by_province(province: str) -> List[Landmark]:
    """
    Get all landmarks in a specific province.

    Args:
        province: Province name

    Returns:
        List of landmarks in that province
    """
    result = []
    province_lower = province.lower()

    for landmark in ALL_LANDMARKS.values():
        if landmark.province.lower() == province_lower:
            result.append(landmark)

    return result


def get_landmarks_by_type(landmark_type: str) -> List[Landmark]:
    """
    Get all landmarks of a specific type.

    Args:
        landmark_type: One of 'pass', 'bridge', 'road', 'area'

    Returns:
        List of landmarks of that type
    """
    return [lm for lm in ALL_LANDMARKS.values() if lm.landmark_type == landmark_type]


# =============================================================================
# DISAMBIGUATION HELPERS
# =============================================================================

def extract_district_context(text: str) -> Optional[str]:
    """
    Extract district name from text for disambiguation.

    Looks for patterns like:
    - "huyện X"
    - "thị xã X"
    - "quận X"
    - "thành phố X"

    Returns:
        District name if found, None otherwise
    """
    patterns = [
        r'huyện\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'thị\s*xã\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'quận\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'thành\s*phố\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'tx\.\s*([^\s,\.]+(?:\s+[^\s,\.]+)?)',
        r'tp\.\s*([^\s,\.]+(?:\s+[^\s,\.]+)?)',
    ]

    text_lower = text.lower()

    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return match.group(1).strip()

    return None


def find_landmark_with_context(
    text: str,
    province_hint: Optional[str] = None,
    district_hint: Optional[str] = None
) -> Optional[Landmark]:
    """
    Find landmark with additional context for disambiguation.

    This is useful when the same landmark name might exist in multiple provinces,
    or when we have additional geographic context.

    Args:
        text: Input text
        province_hint: Known/suspected province
        district_hint: Known/suspected district

    Returns:
        Best matching Landmark or None
    """
    # First, try to find landmark directly
    landmark = find_landmark_in_text(text)

    if landmark:
        # If we found a landmark, verify it matches hints if provided
        if province_hint and landmark.province.lower() != province_hint.lower():
            # Province mismatch - look for better match
            pass  # Continue to search with context
        else:
            return landmark

    # Extract district from text if not provided
    if not district_hint:
        district_hint = extract_district_context(text)

    # Search with province/district context
    if province_hint or district_hint:
        for lm in ALL_LANDMARKS.values():
            name_in_text = (
                lm.name.lower() in text.lower() or
                any(alias.lower() in text.lower() for alias in lm.aliases)
            )

            if name_in_text:
                province_match = (
                    not province_hint or
                    lm.province.lower() == province_hint.lower()
                )
                district_match = (
                    not district_hint or
                    (lm.district and district_hint.lower() in lm.district.lower())
                )

                if province_match and district_match:
                    return lm

    return landmark  # Return original match or None
