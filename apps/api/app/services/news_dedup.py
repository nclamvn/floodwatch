"""
News Deduplication Service

Centralized cross-source duplicate detection for news reports.
Implements 3-layer defense-in-depth:
- Layer 1 (Ingestion): Prevent duplicates at scraper level
- Layer 2 (API): Filter duplicates before response
- Layer 3 (Frontend): Final dedup in UI components

Match types:
- exact_hash: SHA256 content hash match (100% duplicate)
- exact_title: Normalized title exact match
- fuzzy_title: Title similarity >= threshold (default 85%)
"""

import hashlib
import re
import unicodedata
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Optional, Tuple, Dict
from urllib.parse import urlparse

from sqlalchemy.orm import Session


class NewsDedupService:
    """Centralized news deduplication service for cross-source duplicate detection."""

    # Vietnamese diacritics mapping for normalization
    VIETNAMESE_CHARS = {
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

    @staticmethod
    def normalize_title(title: str) -> str:
        """
        Normalize title for comparison.

        Steps:
        1. Lowercase
        2. Remove Vietnamese diacritics
        3. Remove punctuation and special chars
        4. Collapse whitespace
        5. Trim to 100 chars

        Args:
            title: Original title string

        Returns:
            Normalized title (max 100 chars)
        """
        if not title:
            return ""

        # Lowercase
        text = title.lower()

        # Remove Vietnamese diacritics
        for viet_char, ascii_char in NewsDedupService.VIETNAMESE_CHARS.items():
            text = text.replace(viet_char, ascii_char)

        # Also handle uppercase Vietnamese (convert to lowercase first, then map)
        text_upper_mapped = text
        for viet_char, ascii_char in NewsDedupService.VIETNAMESE_CHARS.items():
            text_upper_mapped = text_upper_mapped.replace(viet_char.upper(), ascii_char)
        text = text_upper_mapped

        # Remove non-alphanumeric (keep spaces)
        text = re.sub(r'[^\w\s]', '', text, flags=re.UNICODE)

        # Collapse whitespace
        text = ' '.join(text.split())

        # Trim to 100 chars
        return text[:100]

    @staticmethod
    def compute_content_hash(description: str) -> Optional[str]:
        """
        Compute SHA256 hash of first 500 chars of normalized description.

        Args:
            description: Article description/content

        Returns:
            64-char hex SHA256 hash, or None if description is empty
        """
        if not description:
            return None

        # Normalize: lowercase, collapse whitespace
        normalized = ' '.join(description.lower().split())

        # Take first 500 chars
        content_sample = normalized[:500]

        if not content_sample:
            return None

        # SHA256 hash
        return hashlib.sha256(content_sample.encode('utf-8')).hexdigest()

    @staticmethod
    def extract_source_domain(url: str) -> Optional[str]:
        """
        Extract domain from URL.

        Examples:
            https://vnexpress.net/article-123 -> vnexpress.net
            https://tuoitre.vn/path/to/article -> tuoitre.vn

        Args:
            url: Full URL string

        Returns:
            Domain string (e.g., 'vnexpress.net'), or None if invalid
        """
        if not url:
            return None

        try:
            parsed = urlparse(url)
            domain = parsed.netloc

            # Remove www. prefix
            if domain.startswith('www.'):
                domain = domain[4:]

            return domain if domain else None
        except Exception:
            return None

    @classmethod
    def find_duplicate(
        cls,
        db: Session,
        title: str,
        description: str,
        created_at: datetime,
        time_window_hours: int = 48,
        similarity_threshold: float = 0.85
    ) -> Optional[Tuple[str, float, str]]:
        """
        Find cross-source duplicates in the database.

        Checks in order:
        1. Exact content hash match (most reliable)
        2. Exact normalized title match
        3. Fuzzy title match (>= similarity_threshold)

        Args:
            db: Database session
            title: Article title
            description: Article description/content
            created_at: Article publication date
            time_window_hours: Look back window (default 48 hours)
            similarity_threshold: Min similarity ratio for fuzzy match (default 0.85)

        Returns:
            Tuple of (duplicate_report_id, similarity_score, match_type) or None
            match_type: 'exact_hash', 'exact_title', 'fuzzy_title'
        """
        from app.database import Report

        # Calculate time threshold
        time_threshold = created_at - timedelta(hours=time_window_hours)

        # Normalize inputs
        normalized_title = cls.normalize_title(title)
        content_hash = cls.compute_content_hash(description)

        if not normalized_title:
            return None

        # Query candidates within time window (exclude invalid/merged)
        candidates = db.query(Report).filter(
            Report.created_at >= time_threshold,
            Report.status.notin_(['invalid', 'merged'])
        ).all()

        # Check 1: Exact content hash match
        if content_hash:
            for report in candidates:
                if report.content_hash and report.content_hash == content_hash:
                    return (str(report.id), 1.0, 'exact_hash')

        # Check 2: Exact normalized title match
        for report in candidates:
            candidate_normalized = report.normalized_title or cls.normalize_title(report.title)
            if candidate_normalized == normalized_title:
                return (str(report.id), 1.0, 'exact_title')

        # Check 3: Fuzzy title match
        best_match = None
        best_similarity = 0.0

        for report in candidates:
            candidate_normalized = report.normalized_title or cls.normalize_title(report.title)
            if not candidate_normalized:
                continue

            # SequenceMatcher for fuzzy comparison
            similarity = SequenceMatcher(None, normalized_title, candidate_normalized).ratio()

            if similarity >= similarity_threshold and similarity > best_similarity:
                best_similarity = similarity
                best_match = report

        if best_match:
            return (str(best_match.id), best_similarity, 'fuzzy_title')

        return None

    @classmethod
    def prepare_report_dedup_fields(cls, title: str, description: str, source: str) -> Dict[str, Optional[str]]:
        """
        Prepare deduplication fields for a new report.

        Args:
            title: Article title
            description: Article description/content
            source: Source URL

        Returns:
            Dict with keys: normalized_title, content_hash, source_domain
        """
        return {
            'normalized_title': cls.normalize_title(title),
            'content_hash': cls.compute_content_hash(description),
            'source_domain': cls.extract_source_domain(source)
        }

    @classmethod
    def calculate_similarity(cls, title1: str, title2: str) -> float:
        """
        Calculate similarity ratio between two titles.

        Args:
            title1: First title
            title2: Second title

        Returns:
            Similarity ratio (0.0 to 1.0)
        """
        norm1 = cls.normalize_title(title1)
        norm2 = cls.normalize_title(title2)

        if not norm1 or not norm2:
            return 0.0

        return SequenceMatcher(None, norm1, norm2).ratio()
