"""
Road Status Classifier - NLP-based classification for road segments

Uses rule-based keyword matching for Vietnamese text to classify road status
into 4 levels: OPEN, LIMITED, DANGEROUS, CLOSED.

Also computes risk scores based on multiple factors.
"""
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from dataclasses import dataclass

from app.database.models import RoadSegmentStatus, RoadSegment, HazardEvent


@dataclass
class ClassificationResult:
    """Result of road status classification"""
    status: RoadSegmentStatus
    risk_score: float
    confidence: float
    matched_keywords: List[str]
    explanation: str


class RoadStatusClassifier:
    """
    Rule-based classifier for Vietnamese road status text.

    Classification hierarchy (most severe wins):
    1. CLOSED - Road completely impassable
    2. DANGEROUS - Active hazard, proceed with extreme caution
    3. LIMITED - Slow traffic, minor obstructions
    4. OPEN - Normal traffic flow
    """

    # Keywords for CLOSED status (road impassable)
    CLOSED_KEYWORDS = [
        # Vietnamese
        'đóng', 'cấm', 'không thể', 'tạm dừng', 'ngừng', 'chia cắt',
        'sập', 'vỡ', 'cuốn trôi', 'mất hoàn toàn', 'cấm hoàn toàn',
        'không lưu thông', 'cấm lưu thông', 'tắc nghẽn hoàn toàn',
        'ngập sâu', 'ngập hoàn toàn', 'chìm', 'bị vùi', 'vùi lấp',
        # Non-diacritics versions
        'dong', 'cam', 'khong the', 'tam dung', 'ngung', 'chia cat',
        'sap', 'vo', 'cuon troi', 'mat hoan toan', 'cam hoan toan',
        'khong luu thong', 'cam luu thong', 'tac nghen hoan toan',
        'ngap sau', 'ngap hoan toan', 'chim', 'bi vui', 'vui lap',
    ]

    # Keywords for DANGEROUS status (active hazard)
    DANGEROUS_KEYWORDS = [
        # Vietnamese
        'nguy hiểm', 'cảnh báo', 'ngập', 'sạt lở', 'lũ', 'lụt',
        'cảnh giác', 'thận trọng', 'hạn chế lưu thông',
        'có thể sập', 'có nguy cơ', 'đe dọa', 'mất an toàn',
        'nước chảy xiết', 'dòng chảy mạnh', 'lũ quét',
        'đá lăn', 'đất lở', 'trượt đất',
        # Non-diacritics versions
        'nguy hiem', 'canh bao', 'ngap', 'sat lo', 'lu', 'lut',
        'canh giac', 'than trong', 'han che luu thong',
        'co the sap', 'co nguy co', 'de doa', 'mat an toan',
        'nuoc chay xiet', 'dong chay manh', 'lu quet',
        'da lan', 'dat lo', 'truot dat',
    ]

    # Keywords for LIMITED status (slow/obstructed)
    LIMITED_KEYWORDS = [
        # Vietnamese
        'hạn chế', 'chậm', 'ùn tắc', 'một chiều', 'hẹp',
        'khó khăn', 'lầy', 'trơn', 'ngập nhẹ', 'nước ngập',
        'ách tắc', 'kẹt xe', 'đông đúc', 'quá tải',
        'sửa chữa', 'thi công', 'bảo trì',
        'di chuyển chậm', 'lưu thông chậm',
        # Non-diacritics versions
        'han che', 'cham', 'un tac', 'mot chieu', 'hep',
        'kho khan', 'lay', 'tron', 'ngap nhe', 'nuoc ngap',
        'ach tac', 'ket xe', 'dong duc', 'qua tai',
        'sua chua', 'thi cong', 'bao tri',
        'di chuyen cham', 'luu thong cham',
    ]

    # Keywords indicating OPEN status (explicit normal traffic)
    OPEN_KEYWORDS = [
        # Vietnamese
        'thông thoáng', 'bình thường', 'lưu thông tốt',
        'đã mở', 'đã thông', 'khôi phục', 'hoạt động bình thường',
        'an toàn', 'xe cộ lưu thông', 'giao thông thuận lợi',
        # Non-diacritics versions
        'thong thoang', 'binh thuong', 'luu thong tot',
        'da mo', 'da thong', 'khoi phuc', 'hoat dong binh thuong',
        'an toan', 'xe co luu thong', 'giao thong thuan loi',
    ]

    # Severity modifiers (increase risk score)
    SEVERITY_MODIFIERS = {
        'nghiêm trọng': 0.2,
        'rất': 0.15,
        'cực kỳ': 0.2,
        'hoàn toàn': 0.15,
        'nhiều': 0.1,
        'lớn': 0.1,
        # Non-diacritics
        'nghiem trong': 0.2,
        'rat': 0.15,
        'cuc ky': 0.2,
        'hoan toan': 0.15,
        'nhieu': 0.1,
        'lon': 0.1,
    }

    @classmethod
    def classify(cls, text: str) -> ClassificationResult:
        """
        Classify road status from Vietnamese text.

        Args:
            text: Vietnamese text describing road condition

        Returns:
            ClassificationResult with status, risk_score, confidence
        """
        if not text:
            return ClassificationResult(
                status=RoadSegmentStatus.OPEN,
                risk_score=0.0,
                confidence=0.0,
                matched_keywords=[],
                explanation="No text provided"
            )

        # Lowercase for matching
        text_lower = text.lower()

        # Find matching keywords for each status
        closed_matches = cls._find_keywords(text_lower, cls.CLOSED_KEYWORDS)
        dangerous_matches = cls._find_keywords(text_lower, cls.DANGEROUS_KEYWORDS)
        limited_matches = cls._find_keywords(text_lower, cls.LIMITED_KEYWORDS)
        open_matches = cls._find_keywords(text_lower, cls.OPEN_KEYWORDS)

        # Check for explicit OPEN first (recovery/restoration news)
        if open_matches and not closed_matches and not dangerous_matches:
            return ClassificationResult(
                status=RoadSegmentStatus.OPEN,
                risk_score=0.1,
                confidence=0.8,
                matched_keywords=open_matches,
                explanation=f"Road appears open/restored: {', '.join(open_matches[:3])}"
            )

        # Determine status by severity (highest wins)
        matched_keywords = []
        if closed_matches:
            status = RoadSegmentStatus.CLOSED
            base_risk = 0.9
            matched_keywords = closed_matches
            explanation = f"Road closed/impassable: {', '.join(closed_matches[:3])}"
        elif dangerous_matches:
            status = RoadSegmentStatus.DANGEROUS
            base_risk = 0.7
            matched_keywords = dangerous_matches
            explanation = f"Dangerous conditions: {', '.join(dangerous_matches[:3])}"
        elif limited_matches:
            status = RoadSegmentStatus.LIMITED
            base_risk = 0.4
            matched_keywords = limited_matches
            explanation = f"Limited traffic: {', '.join(limited_matches[:3])}"
        else:
            status = RoadSegmentStatus.OPEN
            base_risk = 0.1
            matched_keywords = []
            explanation = "No hazard keywords found"

        # Apply severity modifiers
        severity_boost = 0.0
        for modifier, boost in cls.SEVERITY_MODIFIERS.items():
            if modifier in text_lower:
                severity_boost = max(severity_boost, boost)

        risk_score = min(1.0, base_risk + severity_boost)

        # Calculate confidence based on number of matches
        total_matches = len(matched_keywords)
        confidence = min(0.95, 0.5 + (total_matches * 0.1))

        return ClassificationResult(
            status=status,
            risk_score=round(risk_score, 2),
            confidence=round(confidence, 2),
            matched_keywords=matched_keywords,
            explanation=explanation
        )

    @classmethod
    def _find_keywords(cls, text: str, keywords: List[str]) -> List[str]:
        """Find all matching keywords in text"""
        matches = []
        for kw in keywords:
            if kw in text:
                matches.append(kw)
        return matches

    @classmethod
    def compute_risk_score(
        cls,
        segment: RoadSegment,
        hazard_event: Optional[HazardEvent] = None,
        hours_since_verification: Optional[float] = None
    ) -> float:
        """
        Compute comprehensive risk score for a road segment.

        Factors:
        - Status severity (40% weight)
        - Hazard proximity (30% weight)
        - Verification recency (20% weight)
        - Source reliability (10% weight)

        Returns:
            Float between 0.0 and 1.0
        """
        # 1. Status severity (40%)
        status_scores = {
            RoadSegmentStatus.OPEN: 0.1,
            RoadSegmentStatus.LIMITED: 0.4,
            RoadSegmentStatus.DANGEROUS: 0.7,
            RoadSegmentStatus.CLOSED: 0.95,
        }
        status_value = segment.status
        if hasattr(status_value, 'value'):
            status_value = status_value
        status_score = status_scores.get(status_value, 0.5) * 0.4

        # 2. Hazard proximity (30%)
        hazard_score = 0.0
        if hazard_event:
            # Higher score for more severe hazards
            hazard_severity = {
                'info': 0.2,
                'low': 0.4,
                'medium': 0.6,
                'high': 0.8,
                'critical': 1.0,
            }
            sev = hazard_event.severity.value if hasattr(hazard_event.severity, 'value') else hazard_event.severity
            hazard_score = hazard_severity.get(sev, 0.5) * 0.3
        else:
            # No associated hazard - moderate baseline
            hazard_score = 0.2 * 0.3

        # 3. Verification recency (20%)
        recency_score = 0.5  # Default if unknown
        if hours_since_verification is not None:
            if hours_since_verification < 1:
                recency_score = 1.0  # Very recent
            elif hours_since_verification < 6:
                recency_score = 0.8
            elif hours_since_verification < 24:
                recency_score = 0.6
            elif hours_since_verification < 48:
                recency_score = 0.4
            else:
                recency_score = 0.2  # Old data less reliable
        recency_score = recency_score * 0.2

        # 4. Source reliability (10%)
        source_scores = {
            'OFFICIAL': 1.0,
            'PRESS': 0.8,
            'USER': 0.6,
            'SCRAPER': 0.5,
        }
        source_score = source_scores.get(segment.source, 0.5) * 0.1

        # Combine all factors
        total_score = status_score + hazard_score + recency_score + source_score

        return round(min(1.0, max(0.0, total_score)), 3)

    @classmethod
    def extract_water_level(cls, text: str) -> Optional[float]:
        """
        Extract water level from text (in meters).

        Examples:
        - "ngập sâu 1.2m" -> 1.2
        - "nước ngập 50cm" -> 0.5
        - "ngập 2 mét" -> 2.0
        """
        if not text:
            return None

        text_lower = text.lower()

        # Pattern for meters: "1.2m", "1,2m", "1.2 m", "2 mét"
        meter_patterns = [
            r'(\d+(?:[.,]\d+)?)\s*(?:m|mét|met)\b',
            r'ngập\s*(?:sâu\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|mét|met)',
        ]

        for pattern in meter_patterns:
            match = re.search(pattern, text_lower)
            if match:
                value = match.group(1).replace(',', '.')
                return float(value)

        # Pattern for centimeters: "50cm", "50 cm"
        cm_patterns = [
            r'(\d+)\s*(?:cm|centi)',
            r'ngập\s*(?:sâu\s*)?(\d+)\s*(?:cm|centi)',
        ]

        for pattern in cm_patterns:
            match = re.search(pattern, text_lower)
            if match:
                cm_value = int(match.group(1))
                return cm_value / 100.0

        return None

    @classmethod
    def extract_duration_estimate(cls, text: str) -> Optional[int]:
        """
        Extract estimated duration/clearance time from text (in hours).

        Examples:
        - "dự kiến mở lại sau 24h" -> 24
        - "khoảng 2 ngày" -> 48
        - "vài giờ tới" -> 3
        """
        if not text:
            return None

        text_lower = text.lower()

        # Hours pattern
        hour_patterns = [
            r'(\d+)\s*(?:giờ|gio|h)\b',
            r'sau\s*(\d+)\s*(?:giờ|gio|h)',
        ]

        for pattern in hour_patterns:
            match = re.search(pattern, text_lower)
            if match:
                return int(match.group(1))

        # Days pattern (convert to hours)
        day_patterns = [
            r'(\d+)\s*(?:ngày|ngay|day)\b',
            r'sau\s*(\d+)\s*(?:ngày|ngay|day)',
        ]

        for pattern in day_patterns:
            match = re.search(pattern, text_lower)
            if match:
                return int(match.group(1)) * 24

        # Vague patterns
        if 'vài giờ' in text_lower or 'vai gio' in text_lower:
            return 3
        if 'vài ngày' in text_lower or 'vai ngay' in text_lower:
            return 72

        return None
