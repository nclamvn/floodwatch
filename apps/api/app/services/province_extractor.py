"""
Province extraction utility for Vietnamese text.

Extracts province names from news articles, weather reports, and other text sources.
Includes coordinates for mapping and various name variations for matching.
"""

import re
from typing import Optional, Tuple
from difflib import SequenceMatcher

# Comprehensive province database with coordinates (lat, lon) and name variations
PROVINCES = {
    "Hà Nội": {
        "lat": 21.0285, "lon": 105.8542,
        "variations": ["Ha Noi", "Hanoi", "Hà Nội", "Thủ đô", "Thu do"]
    },
    "Hồ Chí Minh": {
        "lat": 10.8231, "lon": 106.6297,
        "variations": ["Ho Chi Minh", "Sài Gòn", "Saigon", "TP.HCM", "TPHCM", "TP HCM"]
    },

    # Northern Provinces
    "Quảng Ninh": {
        "lat": 21.0064, "lon": 107.2925,
        "variations": ["Quang Ninh", "Hạ Long", "Ha Long", "Cẩm Phả", "Cam Pha"]
    },
    "Hải Phòng": {
        "lat": 20.8449, "lon": 106.6881,
        "variations": ["Hai Phong", "Haiphong"]
    },
    "Hải Dương": {
        "lat": 20.9373, "lon": 106.3148,
        "variations": ["Hai Duong", "Haiduong"]
    },
    "Bắc Ninh": {
        "lat": 21.1214, "lon": 106.1110,
        "variations": ["Bac Ninh", "Bacninh"]
    },
    "Thái Nguyên": {
        "lat": 21.5671, "lon": 105.8252,
        "variations": ["Thai Nguyen", "Thainguyen"]
    },
    "Lào Cai": {
        "lat": 22.4809, "lon": 103.9755,
        "variations": ["Lao Cai", "Sa Pa", "Sapa"]
    },
    "Điện Biên": {
        "lat": 21.8042, "lon": 103.2318,
        "variations": ["Dien Bien", "Điện Biên Phủ", "Dien Bien Phu"]
    },
    "Hòa Bình": {
        "lat": 20.6861, "lon": 105.3388,
        "variations": ["Hoa Binh", "Hoabinh"]
    },
    "Sơn La": {
        "lat": 21.1022, "lon": 103.7289,
        "variations": ["Son La", "Sonla"]
    },
    "Lai Châu": {
        "lat": 22.3864, "lon": 103.4704,
        "variations": ["Lai Chau", "Laichau"]
    },
    "Yên Bái": {
        "lat": 21.7168, "lon": 104.8986,
        "variations": ["Yen Bai", "Yenbai"]
    },
    "Phú Thọ": {
        "lat": 21.2680, "lon": 105.2045,
        "variations": ["Phu Tho", "Phutho", "Việt Trì", "Viet Tri"]
    },
    "Vĩnh Phúc": {
        "lat": 21.3609, "lon": 105.5474,
        "variations": ["Vinh Phuc", "Vinhphuc"]
    },
    "Bắc Giang": {
        "lat": 21.2819, "lon": 106.1975,
        "variations": ["Bac Giang", "Bacgiang"]
    },
    "Lạng Sơn": {
        "lat": 21.8537, "lon": 106.7615,
        "variations": ["Lang Son", "Langson"]
    },
    "Cao Bằng": {
        "lat": 22.6356, "lon": 106.2522,
        "variations": ["Cao Bang", "Caobang"]
    },
    "Bắc Kạn": {
        "lat": 22.3032, "lon": 105.8348,
        "variations": ["Bac Kan", "Backan", "Ba Bể", "Ba Be"]
    },
    "Tuyên Quang": {
        "lat": 21.8267, "lon": 105.2280,
        "variations": ["Tuyen Quang", "Tuyenquang"]
    },
    "Hà Giang": {
        "lat": 22.8025, "lon": 104.9784,
        "variations": ["Ha Giang", "Hagiang"]
    },
    "Hưng Yên": {
        "lat": 20.6464, "lon": 106.0511,
        "variations": ["Hung Yen", "Hungyen"]
    },
    "Hà Nam": {
        "lat": 20.5835, "lon": 105.9230,
        "variations": ["Ha Nam", "Hanam", "Phủ Lý", "Phu Ly"]
    },
    "Nam Định": {
        "lat": 20.4388, "lon": 106.1621,
        "variations": ["Nam Dinh", "Namdinh"]
    },
    "Thái Bình": {
        "lat": 20.4464, "lon": 106.3365,
        "variations": ["Thai Binh", "Thaibinh"]
    },
    "Ninh Bình": {
        "lat": 20.2506, "lon": 105.9745,
        "variations": ["Ninh Binh", "Ninhbinh", "Tam Cốc", "Tam Coc"]
    },

    # Central Provinces (High flood risk areas)
    "Thanh Hóa": {
        "lat": 19.8067, "lon": 105.7851,
        "variations": ["Thanh Hoa", "Thanhhoa"]
    },
    "Nghệ An": {
        "lat": 18.6792, "lon": 105.6811,
        "variations": ["Nghe An", "Nghean", "Vinh"]
    },
    "Hà Tĩnh": {
        "lat": 18.3559, "lon": 105.8892,
        "variations": ["Ha Tinh", "Hatinh"]
    },
    "Quảng Bình": {
        "lat": 17.6102, "lon": 106.3487,
        "variations": ["Quang Binh", "Quangbinh", "Đồng Hới", "Dong Hoi"]
    },
    "Quảng Trị": {
        "lat": 16.8194, "lon": 107.0997,
        "variations": ["Quang Tri", "Quangtri", "Đông Hà", "Dong Ha"]
    },
    "Thừa Thiên Huế": {
        "lat": 16.4637, "lon": 107.5909,
        "variations": ["Thua Thien Hue", "Huế", "Hue"]
    },
    "Đà Nẵng": {
        "lat": 16.0544, "lon": 108.2022,
        "variations": ["Da Nang", "Danang"]
    },
    "Quảng Nam": {
        "lat": 15.5394, "lon": 108.0191,
        "variations": ["Quang Nam", "Quangnam", "Hội An", "Hoi An", "Tam Kỳ", "Tam Ky"]
    },
    "Quảng Ngãi": {
        "lat": 15.1214, "lon": 108.8044,
        "variations": ["Quang Ngai", "Quangngai"]
    },
    "Bình Định": {
        "lat": 13.7830, "lon": 109.2196,
        "variations": ["Binh Dinh", "Binhdinh", "Quy Nhơn", "Quy Nhon"]
    },
    "Phú Yên": {
        "lat": 13.0882, "lon": 109.0929,
        "variations": ["Phu Yen", "Phuyen", "Tuy Hòa", "Tuy Hoa"]
    },
    "Khánh Hòa": {
        "lat": 12.2388, "lon": 109.1967,
        "variations": ["Khanh Hoa", "Khanhhoa", "Nha Trang", "Nhatrang"]
    },
    "Ninh Thuận": {
        "lat": 11.6739, "lon": 108.8629,
        "variations": ["Ninh Thuan", "Ninhthuan", "Phan Rang", "Phanrang"]
    },
    "Bình Thuận": {
        "lat": 10.9265, "lon": 108.0861,
        "variations": ["Binh Thuan", "Binhthuan", "Phan Thiết", "Phan Thiet"]
    },

    # Central Highlands
    "Kon Tum": {
        "lat": 14.3497, "lon": 108.0005,
        "variations": ["Kontum"]
    },
    "Gia Lai": {
        "lat": 13.8078, "lon": 108.1093,
        "variations": ["Gialai", "Pleiku"]
    },
    "Đắk Lắk": {
        "lat": 12.7100, "lon": 108.2378,
        "variations": ["Dak Lak", "Daklak", "Buôn Ma Thuột", "Buon Ma Thuot"]
    },
    "Đắk Nông": {
        "lat": 12.2646, "lon": 107.6098,
        "variations": ["Dak Nong", "Daknong", "Gia Nghĩa", "Gia Nghia"]
    },
    "Lâm Đồng": {
        "lat": 11.5753, "lon": 108.1429,
        "variations": ["Lam Dong", "Lamdong", "Đà Lạt", "Da Lat", "Dalat"]
    },

    # Southern Provinces
    "Bình Phước": {
        "lat": 11.7511, "lon": 106.7234,
        "variations": ["Binh Phuoc", "Binhphuoc", "Đồng Xoài", "Dong Xoai"]
    },
    "Tây Ninh": {
        "lat": 11.3351, "lon": 106.0979,
        "variations": ["Tay Ninh", "Tayninh", "Núi Bà Đen", "Nui Ba Den"]
    },
    "Bình Dương": {
        "lat": 11.3254, "lon": 106.4770,
        "variations": ["Binh Duong", "Binhduong", "Thủ Dầu Một", "Thu Dau Mot"]
    },
    "Đồng Nai": {
        "lat": 10.9524, "lon": 107.1676,
        "variations": ["Dong Nai", "Dongnai", "Biên Hòa", "Bien Hoa"]
    },
    "Bà Rịa-Vũng Tàu": {
        "lat": 10.5417, "lon": 107.2429,
        "variations": ["Ba Ria-Vung Tau", "Vũng Tàu", "Vung Tau"]
    },
    "Long An": {
        "lat": 10.6956, "lon": 106.4058,
        "variations": ["Longan", "Tân An", "Tan An"]
    },
    "Tiền Giang": {
        "lat": 10.4493, "lon": 106.3420,
        "variations": ["Tien Giang", "Tiengiang", "Mỹ Tho", "My Tho"]
    },
    "Bến Tre": {
        "lat": 10.2433, "lon": 106.3758,
        "variations": ["Ben Tre", "Bentre"]
    },
    "Trà Vinh": {
        "lat": 9.8127, "lon": 106.3422,
        "variations": ["Tra Vinh", "Travinh"]
    },
    "Vĩnh Long": {
        "lat": 10.2397, "lon": 105.9571,
        "variations": ["Vinh Long", "Vinhlong"]
    },
    "Đồng Tháp": {
        "lat": 10.4938, "lon": 105.6881,
        "variations": ["Dong Thap", "Dongthap", "Cao Lãnh", "Cao Lanh"]
    },
    "An Giang": {
        "lat": 10.5216, "lon": 105.1258,
        "variations": ["Angiang", "Long Xuyên", "Long Xuyen", "Châu Đốc", "Chau Doc"]
    },
    "Kiên Giang": {
        "lat": 10.0125, "lon": 105.0808,
        "variations": ["Kien Giang", "Kiengiang", "Rạch Giá", "Rach Gia", "Phú Quốc", "Phu Quoc"]
    },
    "Cần Thơ": {
        "lat": 10.0452, "lon": 105.7469,
        "variations": ["Can Tho", "Cantho"]
    },
    "Hậu Giang": {
        "lat": 9.7577, "lon": 105.6412,
        "variations": ["Hau Giang", "Haugiang", "Vị Thanh", "Vi Thanh"]
    },
    "Sóc Trăng": {
        "lat": 9.6037, "lon": 105.9800,
        "variations": ["Soc Trang", "Soctrang"]
    },
    "Bạc Liêu": {
        "lat": 9.2515, "lon": 105.7638,
        "variations": ["Bac Lieu", "Baclieu"]
    },
    "Cà Mau": {
        "lat": 9.1527, "lon": 105.1960,
        "variations": ["Ca Mau", "Camau"]
    },
}


def normalize_text(text: str) -> str:
    """
    Normalize Vietnamese text for better matching.
    Handles accents, case, and common variations.
    """
    if not text:
        return ""

    # Convert to lowercase for case-insensitive matching
    text = text.lower()

    # Remove extra whitespace
    text = ' '.join(text.split())

    return text


def fuzzy_match(str1: str, str2: str, threshold: float = 0.85) -> bool:
    """
    Check if two strings are similar enough using fuzzy matching.

    Args:
        str1: First string
        str2: Second string
        threshold: Similarity threshold (0.0 to 1.0)

    Returns:
        True if strings are similar enough
    """
    ratio = SequenceMatcher(None, normalize_text(str1), normalize_text(str2)).ratio()
    return ratio >= threshold


def extract_province_from_text(text: str, use_fuzzy: bool = True) -> Optional[str]:
    """
    Extract province name from Vietnamese text.

    Searches for province names and their variations in the text.
    Uses exact matching first, then fuzzy matching if enabled.

    Args:
        text: Input text (news article, weather report, etc.)
        use_fuzzy: Enable fuzzy matching for typos/misspellings

    Returns:
        Province name (canonical form) or None if not found

    Examples:
        >>> extract_province_from_text("Mưa lũ tại Quảng Bình gây ngập lụt")
        'Quảng Bình'
        >>> extract_province_from_text("Flooding in Ha Noi this morning")
        'Hà Nội'
        >>> extract_province_from_text("Bão đổ bộ Đà Nẵng")
        'Đà Nẵng'
    """
    if not text:
        return None

    normalized_text = normalize_text(text)

    # First pass: exact matching with variations
    for province, data in PROVINCES.items():
        # Check canonical name
        if normalize_text(province) in normalized_text:
            return province

        # Check variations
        for variation in data["variations"]:
            if normalize_text(variation) in normalized_text:
                return province

    # Second pass: fuzzy matching if enabled
    if use_fuzzy:
        # Split text into potential province names (2-4 word sequences)
        words = normalized_text.split()
        for i in range(len(words)):
            for length in [2, 3, 4]:  # Check 2-4 word sequences
                if i + length > len(words):
                    continue

                candidate = ' '.join(words[i:i+length])

                # Check against all provinces and variations
                for province, data in PROVINCES.items():
                    if fuzzy_match(candidate, province):
                        return province

                    for variation in data["variations"]:
                        if fuzzy_match(candidate, variation):
                            return province

    return None


def get_province_coordinates(province: str) -> Optional[Tuple[float, float]]:
    """
    Get latitude and longitude for a province.

    Args:
        province: Province name (canonical or variation)

    Returns:
        Tuple of (latitude, longitude) or None if not found

    Examples:
        >>> get_province_coordinates("Hà Nội")
        (21.0285, 105.8542)
        >>> get_province_coordinates("Ha Noi")
        (21.0285, 105.8542)
    """
    if not province:
        return None

    # Direct lookup
    if province in PROVINCES:
        data = PROVINCES[province]
        return (data["lat"], data["lon"])

    # Search by variation
    normalized_input = normalize_text(province)
    for canonical_name, data in PROVINCES.items():
        if normalize_text(canonical_name) == normalized_input:
            return (data["lat"], data["lon"])

        for variation in data["variations"]:
            if normalize_text(variation) == normalized_input:
                return (data["lat"], data["lon"])

    return None


def extract_location_data(text: str) -> dict:
    """
    Extract complete location data from text.

    This function now uses a multi-tier geocoding strategy:
    1. Landmark database (most accurate - for passes, bridges, etc.)
    2. District-level lookup
    3. Province-level fallback

    Args:
        text: Input text

    Returns:
        Dictionary with 'province', 'district', 'lat', 'lon', 'accuracy' keys
        Returns None values if location not found

    Examples:
        >>> extract_location_data("Sạt lở tại đèo Nhông, huyện Phù Mỹ, Bình Định")
        {'province': 'Bình Định', 'district': 'Phù Mỹ', 'lat': 14.0847, 'lon': 108.9203, 'accuracy': 'landmark'}

        >>> extract_location_data("Lũ lụt tại Quảng Trị")
        {'province': 'Quảng Trị', 'district': None, 'lat': 16.8194, 'lon': 107.0997, 'accuracy': 'province'}
    """
    # Try new geocoding service first (more accurate)
    try:
        from app.services.geocoding_service import geocode_vietnamese_text

        result = geocode_vietnamese_text(text)
        if result:
            return {
                "province": result.province,
                "district": result.district,
                "lat": result.lat,
                "lon": result.lon,
                "accuracy": result.accuracy,
                "matched_name": result.matched_name,
                "confidence": result.confidence
            }
    except ImportError:
        # Geocoding service not available, fall back to province-only
        pass

    # Fallback to province-level extraction
    province = extract_province_from_text(text)

    if province:
        coords = get_province_coordinates(province)
        if coords:
            return {
                "province": province,
                "district": None,
                "lat": coords[0],
                "lon": coords[1],
                "accuracy": "province",
                "matched_name": province,
                "confidence": 0.5
            }

    return {
        "province": None,
        "district": None,
        "lat": None,
        "lon": None,
        "accuracy": None,
        "matched_name": None,
        "confidence": 0.0
    }
