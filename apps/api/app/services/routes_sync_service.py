"""
Routes Sync Service - ROUTES 2.5+

Syncs traffic-related Reports from /map to RoadSegments for /routes.
Uses AI/keyword filtering to identify road-related reports and creates
RoadSegments with proper source_url for verification.

Key features:
- Filters Reports for traffic/road content using keywords + AI
- Creates RoadSegments with source_url from Report.source (REQUIRED)
- Deduplicates to avoid duplicate road segments
- Runs on schedule or on-demand via API

ROUTES 2.5+ Changes:
- Confidence threshold raised from 0.5 to 0.7
- Expanded exclusion keywords (rescue, medical, weather, policy)
- Word boundary matching instead of substring matching
- source_url is now REQUIRED for all segments
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
import re
import hashlib

from sqlalchemy import func, and_, or_, desc
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.database.models import Report, ReportType, RoadSegment, RoadSegmentStatus


# Keywords indicating traffic/road-related content
ROAD_KEYWORDS = [
    # Road types
    'quốc lộ', 'ql', 'tỉnh lộ', 'tl', 'đường', 'đèo', 'cầu', 'hầm',
    'cao tốc', 'đại lộ', 'phố', 'ngõ', 'hẻm', 'đường bộ',

    # Road conditions
    'ngập', 'ngập nước', 'ngập sâu', 'ngập lụt', 'nước ngập',
    'sạt lở', 'sạt', 'lở đất', 'đất lở', 'ta luy', 'taluy',
    'sụt lún', 'sụp', 'hố tử thần', 'nứt', 'đứt đường',
    'tắc đường', 'tắc nghẽn', 'ùn tắc', 'kẹt xe',
    'chia cắt', 'cô lập', 'mất kết nối',

    # Infrastructure damage
    'cầu sập', 'cầu hỏng', 'cầu ngập', 'cầu bị', 'sập cầu',
    'đường sập', 'đường hỏng', 'đường bị', 'hư hỏng',
    'cuốn trôi', 'trôi', 'xói lở', 'xói mòn',

    # Traffic status
    'cấm đường', 'đóng đường', 'chặn đường', 'phong tỏa',
    'lưu thông', 'giao thông', 'di chuyển', 'qua lại',
    'một chiều', 'hạn chế', 'cảnh báo đường',

    # Vehicles affected
    'xe không qua', 'xe mắc kẹt', 'ô tô', 'xe tải', 'xe máy',
    'phương tiện', 'xe cộ'
]

# Confidence threshold - ROUTES 2.5+ raised from 0.5 to 0.7
CONFIDENCE_THRESHOLD = 0.7

# Keywords to exclude - ROUTES 2.5+ expanded significantly
EXCLUDE_KEYWORDS = [
    # Traffic accidents (original)
    'va chạm', 'đâm', 'tai nạn giao thông', 'tông', 'lật xe',
    'cháy xe', 'nổ xe', 'say rượu', 'vượt đèn đỏ',

    # Rescue/Relief operations (NEW)
    'cứu trợ', 'cứu nạn', 'cứu hộ', 'hỗ trợ khẩn cấp', 'tiếp tế',
    'nhu yếu phẩm', 'quà tặng', 'từ thiện', 'quyên góp',
    'trao quà', 'đoàn cứu trợ', 'hàng cứu trợ',

    # Medical/Casualties (NEW)
    'bệnh viện', 'cấp cứu y tế', 'thương vong', 'tử vong',
    'người chết', 'người mất tích', 'nạn nhân', 'thi thể',

    # Weather forecasts (NEW) - not actual road status
    'dự báo thời tiết', 'áp thấp nhiệt đới', 'khả năng mạnh thành',
    'hướng di chuyển của bão', 'kịch bản', 'dự kiến đổ bộ',
    'theo dõi diễn biến', 'cơn bão số',

    # Policy/Finance (NEW)
    'hỗ trợ tiền', 'miễn giảm thuế', 'chính sách', 'ngân sách',
    'trợ cấp', 'bảo hiểm xã hội', 'lương hưu', 'gia hạn thuế',
    'hỗ trợ kinh phí', 'kinh phí khắc phục',

    # Meeting/Admin (NEW)
    'họp khẩn', 'chỉ đạo', 'thủ tướng yêu cầu', 'đại biểu quốc hội',
    'bộ trưởng', 'phó thủ tướng', 'nghị quyết'
]

# Road name patterns for extraction
ROAD_PATTERNS = [
    r'(QL|Quốc lộ)\s*(\d+[A-Z]?)',
    r'(TL|Tỉnh lộ)\s*(\d+[A-Z]?)',
    r'(Đường|đường)\s+([A-Za-zÀ-ỹ\s\d]+?)(?:\s*[-–,\.]|\s+(?:đoạn|qua|tại|ở))',
    r'(Đèo|đèo)\s+([A-Za-zÀ-ỹ\s]+?)(?:\s*[-–,\.]|\s+(?:đoạn|qua|tại|ở))',
    r'(Cầu|cầu)\s+([A-Za-zÀ-ỹ\s]+?)(?:\s*[-–,\.]|\s+(?:bị|đã|ngập|sập))',
    r'(Cao tốc|cao tốc)\s+([A-Za-zÀ-ỹ\s\-]+?)(?:\s*[-–,\.]|\s+(?:đoạn|qua|tại|ở))',
]


def keyword_matches(keyword: str, text: str) -> bool:
    """
    Match keyword với word boundaries, không phải substring.

    ROUTES 2.5+: Tránh false positives như:
    - "cầu nguyện" matching "cầu"
    - "chia cắt bánh" matching "chia cắt"

    Args:
        keyword: Từ khóa cần tìm
        text: Văn bản để tìm kiếm (đã lowercase)

    Returns:
        True nếu keyword xuất hiện như một từ riêng biệt
    """
    # Escape special regex chars trong keyword
    escaped = re.escape(keyword.lower())
    # Vietnamese doesn't use spaces consistently, use word boundaries
    # \b works for alphanumeric boundaries
    # Also check for common Vietnamese word separators
    pattern = rf'(?:^|[\s,\.;\:\!\?\-\(\)\[\]\"\'«»]){escaped}(?:[\s,\.;\:\!\?\-\(\)\[\]\"\'«»]|$)'
    return bool(re.search(pattern, text.lower()))


class RoutesSyncService:
    """Service to sync Reports to RoadSegments"""

    @classmethod
    def is_road_related(cls, report: Report) -> Tuple[bool, float]:
        """
        Check if a report is related to road/traffic conditions.

        ROUTES 2.5+: Uses word boundary matching and higher threshold (0.7)

        Returns:
            Tuple of (is_related: bool, confidence: float 0-1)
        """
        text = f"{report.title} {report.description or ''}".lower()

        # Check exclusions first - ROUTES 2.5+: use word boundary matching
        for keyword in EXCLUDE_KEYWORDS:
            if keyword_matches(keyword, text):
                return False, 0.0

        # Count matching keywords - ROUTES 2.5+: use word boundary matching
        matches = 0
        for keyword in ROAD_KEYWORDS:
            if keyword_matches(keyword, text):
                matches += 1

        # Calculate confidence - ROUTES 2.5+: adjusted for higher threshold
        # Need 3+ keywords to reach 0.7 base confidence
        if matches == 0:
            return False, 0.0
        elif matches == 1:
            confidence = 0.3  # Lowered from 0.4 - single keyword not enough
        elif matches == 2:
            confidence = 0.5  # Lowered from 0.6
        elif matches == 3:
            confidence = 0.7  # Reaches threshold at 3 keywords
        elif matches == 4:
            confidence = 0.85
        else:
            confidence = 0.95

        # Boost for ROAD type reports (explicit road report from user)
        if report.type == ReportType.ROAD:
            confidence = min(1.0, confidence + 0.25)

        # Boost for high trust score (verified source)
        if report.trust_score >= 0.7:
            confidence = min(1.0, confidence + 0.1)

        # ROUTES 2.5+: Use configurable threshold instead of hardcoded 0.5
        return confidence >= CONFIDENCE_THRESHOLD, confidence

    @classmethod
    def extract_road_name(cls, report: Report) -> Optional[str]:
        """Extract road name from report title/description"""
        text = f"{report.title} {report.description or ''}"

        for pattern in ROAD_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                road_type = match.group(1)
                road_name = match.group(2).strip()

                # Normalize road type
                road_type_map = {
                    'ql': 'QL', 'quốc lộ': 'QL',
                    'tl': 'TL', 'tỉnh lộ': 'TL',
                    'đường': 'Đường', 'đèo': 'Đèo',
                    'cầu': 'Cầu', 'cao tốc': 'Cao tốc'
                }
                normalized_type = road_type_map.get(road_type.lower(), road_type)

                return f"{normalized_type} {road_name}"

        return None

    @classmethod
    def determine_status(cls, report: Report) -> Tuple[RoadSegmentStatus, float]:
        """
        Determine road segment status from report content.

        Returns:
            Tuple of (status, risk_score)
        """
        text = f"{report.title} {report.description or ''}".lower()

        # CLOSED indicators
        closed_keywords = [
            'cấm đường', 'đóng đường', 'chặn đường', 'phong tỏa',
            'chia cắt', 'cô lập', 'không thể qua', 'xe không qua',
            'cầu sập', 'đường sập', 'cuốn trôi', 'đứt đường'
        ]
        for kw in closed_keywords:
            if kw in text:
                return RoadSegmentStatus.CLOSED, 0.95

        # DANGEROUS indicators
        dangerous_keywords = [
            'nguy hiểm', 'sạt lở', 'lở đất', 'sụt lún',
            'ngập sâu', 'nước chảy xiết', 'hố tử thần',
            'cảnh báo', 'rất nguy hiểm'
        ]
        for kw in dangerous_keywords:
            if kw in text:
                return RoadSegmentStatus.DANGEROUS, 0.75

        # LIMITED indicators
        limited_keywords = [
            'ngập', 'tắc đường', 'ùn tắc', 'hạn chế',
            'một chiều', 'lưu thông khó', 'di chuyển chậm',
            'cẩn thận', 'chú ý'
        ]
        for kw in limited_keywords:
            if kw in text:
                return RoadSegmentStatus.LIMITED, 0.5

        # Default based on report type
        if report.type == ReportType.ROAD:
            return RoadSegmentStatus.LIMITED, 0.4
        elif report.type == ReportType.ALERT:
            return RoadSegmentStatus.DANGEROUS, 0.6
        elif report.type == ReportType.SOS:
            return RoadSegmentStatus.CLOSED, 0.8

        return RoadSegmentStatus.LIMITED, 0.3

    @classmethod
    def generate_segment_name(cls, report: Report, road_name: Optional[str]) -> str:
        """Generate a descriptive segment name"""
        if road_name:
            location_parts = [road_name]
            if report.district:
                location_parts.append(report.district)
            if report.province:
                location_parts.append(report.province)
            return " - ".join(location_parts[:3])

        # Fallback to title-based name
        title = report.title[:100]
        if report.province:
            return f"{title} ({report.province})"
        return title

    @classmethod
    def compute_content_hash(cls, report: Report) -> str:
        """Compute hash for deduplication"""
        content = f"{report.title}|{report.lat}|{report.lon}|{report.province}"
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    @classmethod
    def find_existing_segment(
        cls,
        db: Session,
        report: Report,
        content_hash: str
    ) -> Optional[RoadSegment]:
        """Find existing segment that matches this report"""
        # Check by content hash first
        existing = db.query(RoadSegment).filter(
            RoadSegment.content_hash == content_hash
        ).first()

        if existing:
            return existing

        # Check by source_url (same article)
        if report.source:
            existing = db.query(RoadSegment).filter(
                RoadSegment.source_url == report.source
            ).first()
            if existing:
                return existing

        return None

    @classmethod
    def create_segment_from_report(
        cls,
        db: Session,
        report: Report,
        dry_run: bool = False
    ) -> Optional[RoadSegment]:
        """
        Create a RoadSegment from a Report.

        ROUTES 2.5+: source_url is now REQUIRED for all segments.
        Segments without verifiable source are not created.

        Args:
            db: Database session
            report: The source Report
            dry_run: If True, don't actually create the segment

        Returns:
            Created RoadSegment or None if skipped
        """
        # ROUTES 2.5+: REQUIRE source_url - không tạo segment nếu không có nguồn
        if not report.source or not report.source.strip():
            return None

        # Check if road-related
        is_related, confidence = cls.is_road_related(report)
        if not is_related:
            return None

        # Extract road name
        road_name = cls.extract_road_name(report)

        # Determine status and risk
        status, risk_score = cls.determine_status(report)

        # Generate segment name
        segment_name = cls.generate_segment_name(report, road_name)

        # Compute hash for dedup
        content_hash = cls.compute_content_hash(report)

        # Check for existing segment
        existing = cls.find_existing_segment(db, report, content_hash)
        if existing:
            # Update existing if report is newer
            if report.created_at and existing.created_at:
                if report.created_at > existing.created_at:
                    existing.status = status
                    existing.risk_score = risk_score
                    existing.status_reason = report.description[:1000] if report.description else None
                    existing.verified_at = datetime.utcnow()
                    existing.updated_at = datetime.utcnow()
                    if not dry_run:
                        db.commit()
                    return existing
            return None

        # Create new segment
        segment = RoadSegment(
            segment_name=segment_name[:200],
            road_name=road_name[:100] if road_name else None,
            province=report.province,
            district=report.district,
            start_lat=report.lat,
            start_lon=report.lon,
            status=status,
            status_reason=report.description[:1000] if report.description else report.title,
            risk_score=risk_score,
            source="PRESS",
            source_url=report.source,  # KEY: This is the article URL!
            source_domain=report.source_domain,
            content_hash=content_hash,
            verified_at=report.created_at or datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            # Set expiry to 7 days from now
            expires_at=datetime.utcnow() + timedelta(days=7)
        )

        # Add PostGIS point if coordinates available
        if report.lat and report.lon:
            segment.location = from_shape(Point(report.lon, report.lat), srid=4326)

        # Normalize name for dedup
        segment.normalized_name = segment_name.lower()[:200]

        if not dry_run:
            db.add(segment)
            db.commit()
            db.refresh(segment)

        return segment

    @classmethod
    def sync_reports_to_segments(
        cls,
        db: Session,
        hours: int = 72,
        limit: int = 500,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Sync recent Reports to RoadSegments.

        Args:
            db: Database session
            hours: Look back this many hours for reports
            limit: Maximum reports to process
            dry_run: If True, don't actually create segments

        Returns:
            Summary statistics
        """
        since = datetime.utcnow() - timedelta(hours=hours)

        # Query recent reports that might be road-related
        # Filter by types most likely to contain road info
        reports = db.query(Report).filter(
            Report.created_at >= since,
            Report.status.in_(['new', 'verified']),
            Report.trust_score >= 0.5,  # Only reasonably trusted reports
            Report.lat.isnot(None),
            Report.lon.isnot(None)
        ).order_by(
            desc(Report.created_at)
        ).limit(limit).all()

        stats = {
            "total_reports_checked": len(reports),
            "road_related_found": 0,
            "segments_created": 0,
            "segments_updated": 0,
            "segments_skipped": 0,
            "dry_run": dry_run,
            "hours_lookback": hours,
            "started_at": datetime.utcnow().isoformat(),
            "details": []
        }

        for report in reports:
            # ROUTES 2.5+: Skip reports without source_url
            if not report.source or not report.source.strip():
                continue

            is_related, confidence = cls.is_road_related(report)

            if not is_related:
                continue

            stats["road_related_found"] += 1

            # Check for existing
            content_hash = cls.compute_content_hash(report)
            existing = cls.find_existing_segment(db, report, content_hash)

            if existing:
                # Update existing
                status, risk_score = cls.determine_status(report)
                if report.created_at and existing.created_at and report.created_at > existing.created_at:
                    existing.status = status
                    existing.risk_score = risk_score
                    existing.status_reason = report.description[:1000] if report.description else None
                    existing.verified_at = datetime.utcnow()
                    if not dry_run:
                        db.commit()
                    stats["segments_updated"] += 1
                    stats["details"].append({
                        "action": "updated",
                        "report_id": str(report.id),
                        "segment_id": str(existing.id),
                        "title": report.title[:50]
                    })
                else:
                    stats["segments_skipped"] += 1
            else:
                # Create new segment
                segment = cls.create_segment_from_report(db, report, dry_run=dry_run)
                if segment:
                    stats["segments_created"] += 1
                    stats["details"].append({
                        "action": "created",
                        "report_id": str(report.id),
                        "segment_id": str(segment.id) if not dry_run else "dry-run",
                        "segment_name": segment.segment_name,
                        "status": segment.status.value,
                        "source_url": segment.source_url,
                        "confidence": confidence
                    })

        stats["completed_at"] = datetime.utcnow().isoformat()

        return stats

    @classmethod
    def cleanup_expired_segments(cls, db: Session) -> int:
        """Remove segments that have expired"""
        now = datetime.utcnow()
        deleted = db.query(RoadSegment).filter(
            RoadSegment.expires_at < now
        ).delete(synchronize_session=False)
        db.commit()
        return deleted
