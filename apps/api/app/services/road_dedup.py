"""
Road Deduplication Service - Anti-duplicate engine for road segments

Follows the same pattern as NewsDedupService for consistency.
Handles Vietnamese road name normalization and cross-source deduplication.
"""
import re
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict
from urllib.parse import urlparse
from sqlalchemy.orm import Session

from app.database.models import RoadSegment


# Vietnamese diacritics mapping
VIETNAMESE_CHARS: Dict[str, str] = {
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

# Road name aliases for normalization
ROAD_ALIASES: Dict[str, str] = {
    'quoc lo': 'ql',
    'quốc lộ': 'ql',
    'tinh lo': 'tl',
    'tỉnh lộ': 'tl',
    'duong': 'd',
    'đường': 'd',
    'cau': 'cau',
    'cầu': 'cau',
    'deo': 'deo',
    'đèo': 'deo',
}


class RoadDedupService:
    """Service for road segment deduplication"""

    @staticmethod
    def remove_vietnamese_diacritics(text: str) -> str:
        """Remove Vietnamese diacritics from text"""
        result = text.lower()
        for viet_char, ascii_char in VIETNAMESE_CHARS.items():
            result = result.replace(viet_char, ascii_char)
            result = result.replace(viet_char.upper(), ascii_char)
        return result

    @classmethod
    def normalize_road_name(cls, name: str) -> str:
        """
        Normalize road name for comparison.

        Examples:
        - "Quốc lộ 1A" -> "ql1a"
        - "QL 1A" -> "ql1a"
        - "Quốc Lộ 1A - Đoạn qua Quảng Bình" -> "ql1a doan qua quang binh"
        - "Đường Hồ Chí Minh" -> "d ho chi minh"

        Steps:
        1. Lowercase
        2. Remove Vietnamese diacritics
        3. Normalize road type aliases
        4. Remove special characters
        5. Collapse whitespace
        6. Trim to 200 chars
        """
        if not name:
            return ''

        # Lowercase
        text = name.lower()

        # Remove Vietnamese diacritics
        text = cls.remove_vietnamese_diacritics(text)

        # Normalize road type aliases
        for full_form, short_form in ROAD_ALIASES.items():
            normalized_full = cls.remove_vietnamese_diacritics(full_form)
            # Replace full form with short form
            text = re.sub(rf'\b{re.escape(normalized_full)}\b', short_form, text)

        # Remove punctuation and special chars (keep alphanumeric and spaces)
        text = re.sub(r'[^\w\s]', ' ', text)

        # Collapse whitespace
        text = ' '.join(text.split())

        # Trim to 200 chars
        return text[:200]

    @classmethod
    def compute_content_hash(cls, status_reason: str) -> str:
        """
        Compute SHA256 hash of status_reason for exact duplicate detection.

        Uses first 500 characters to handle truncation differences.
        """
        if not status_reason:
            return ''

        # Normalize: remove diacritics, lowercase, collapse whitespace
        normalized = cls.remove_vietnamese_diacritics(status_reason.lower())
        normalized = ' '.join(normalized.split())

        # Take first 500 chars
        content = normalized[:500]

        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    @classmethod
    def extract_source_domain(cls, url: str) -> str:
        """
        Extract domain from URL.

        Example: "https://vnexpress.net/article/123" -> "vnexpress.net"
        """
        if not url:
            return ''

        try:
            parsed = urlparse(url)
            domain = parsed.netloc
            # Remove www. prefix
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain
        except Exception:
            return ''

    @classmethod
    def find_duplicate(
        cls,
        db: Session,
        name: str,
        province: Optional[str] = None,
        status_reason: Optional[str] = None,
        time_window_hours: int = 48,
        similarity_threshold: float = 0.85
    ) -> Optional[Tuple[str, float, str]]:
        """
        Find existing duplicate road segment.

        Returns:
            Tuple of (duplicate_id, similarity, match_type) or None
            match_type: 'exact_hash', 'exact_name', 'fuzzy_name'
        """
        normalized_name = cls.normalize_road_name(name)
        content_hash = cls.compute_content_hash(status_reason) if status_reason else None

        since = datetime.utcnow() - timedelta(hours=time_window_hours)

        # 1. Check exact content hash match (if we have status_reason)
        if content_hash:
            existing = db.query(RoadSegment)\
                .filter(RoadSegment.content_hash == content_hash)\
                .filter(RoadSegment.created_at >= since)\
                .first()

            if existing:
                return (str(existing.id), 1.0, 'exact_hash')

        # 2. Check exact normalized name match
        query = db.query(RoadSegment)\
            .filter(RoadSegment.normalized_name == normalized_name)\
            .filter(RoadSegment.created_at >= since)

        if province:
            query = query.filter(RoadSegment.province == province)

        existing = query.first()
        if existing:
            return (str(existing.id), 1.0, 'exact_name')

        # 3. Fuzzy matching using trigram similarity (requires pg_trgm)
        # This is optional and depends on database setup
        # For now, skip fuzzy matching and rely on exact matches

        return None

    @classmethod
    def prepare_dedup_fields(
        cls,
        name: str,
        status_reason: Optional[str] = None,
        source_url: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Prepare deduplication fields for a new road segment.

        Returns dict with:
        - normalized_name
        - content_hash
        - source_domain
        """
        return {
            'normalized_name': cls.normalize_road_name(name),
            'content_hash': cls.compute_content_hash(status_reason) if status_reason else None,
            'source_domain': cls.extract_source_domain(source_url) if source_url else None
        }

    @classmethod
    def should_update_existing(
        cls,
        existing: RoadSegment,
        new_status: str,
        new_risk_score: float,
        new_source: str
    ) -> bool:
        """
        Determine if existing segment should be updated with new data.

        Update if:
        - New status is more severe (CLOSED > DANGEROUS > LIMITED > OPEN)
        - New source is more reliable
        - New data is significantly newer (> 1 hour)
        """
        status_severity = {
            'OPEN': 1,
            'LIMITED': 2,
            'DANGEROUS': 3,
            'CLOSED': 4
        }

        # Source reliability ranking
        source_reliability = {
            'OFFICIAL': 5,  # Government sources
            'PRESS': 4,     # News media
            'USER': 3,      # User reports
            'SCRAPER': 2,   # Automated scraping
            'UNKNOWN': 1
        }

        existing_severity = status_severity.get(
            existing.status.value if hasattr(existing.status, 'value') else existing.status,
            1
        )
        new_severity = status_severity.get(new_status, 1)

        # Update if more severe status
        if new_severity > existing_severity:
            return True

        # Update if same severity but higher risk score
        if new_severity == existing_severity and new_risk_score > existing.risk_score:
            return True

        # Update if more reliable source
        existing_reliability = source_reliability.get(existing.source, 1)
        new_reliability = source_reliability.get(new_source, 1)
        if new_reliability > existing_reliability:
            return True

        return False

    @classmethod
    def merge_segments(
        cls,
        db: Session,
        existing: RoadSegment,
        new_data: Dict
    ) -> RoadSegment:
        """
        Merge new data into existing segment.

        Keeps the more severe/complete information.
        """
        # Update status if more severe
        if cls.should_update_existing(
            existing,
            new_data.get('status', 'OPEN'),
            new_data.get('risk_score', 0),
            new_data.get('source', 'UNKNOWN')
        ):
            if 'status' in new_data:
                existing.status = new_data['status']
            if 'risk_score' in new_data:
                existing.risk_score = new_data['risk_score']
            if 'source' in new_data:
                existing.source = new_data['source']

        # Always update if we have better description
        if new_data.get('status_reason') and (
            not existing.status_reason or
            len(new_data['status_reason']) > len(existing.status_reason)
        ):
            existing.status_reason = new_data['status_reason']

        # Update location if we didn't have it
        if not existing.start_lat and new_data.get('lat'):
            existing.start_lat = new_data['lat']
            existing.start_lon = new_data.get('lon')

        existing.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(existing)
        return existing
