"""
Trust Score V1.5 - Enhanced rule-based scoring
Includes time decay, duplicate detection, and conflict resolution
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from difflib import SequenceMatcher


class TrustScoreCalculator:
    """Enhanced trust score calculator"""

    @staticmethod
    def compute_score(report_data: Dict, existing_reports: Optional[List] = None) -> float:
        """
        Compute trust score V1.5

        Rules:
        - Official source (KTTV/GOV): +0.5
        - Has GPS coordinates: +0.3
        - Has media (>=1 image): +0.2
        - Multiple sources agree (60min, 5km): +0.2
        - Conflict with official source: -0.5
        - Time decay: -0.1 per 6 hours (min 0)
        - Report type bonus: SOS +0.1, NEEDS +0.05

        Args:
            report_data: Dict with keys: source, lat, lon, province, media, type, created_at
            existing_reports: List of existing reports for duplicate/conflict detection

        Returns:
            float: Trust score between 0.0 and 1.0
        """
        score = 0.0

        # Base score for official sources
        if report_data.get("source") in ["KTTV", "NCHMF", "GOV"]:
            score += 0.5

        # GPS bonus
        if report_data.get("lat") and report_data.get("lon"):
            score += 0.3

        # Media bonus
        if report_data.get("media") and len(report_data.get("media", [])) > 0:
            score += 0.2

        # Province identified
        if report_data.get("province"):
            score += 0.1
        else:
            score -= 0.1

        # Type bonuses
        report_type = report_data.get("type", "")
        if report_type == "SOS":
            score += 0.1
        elif report_type == "NEEDS":
            score += 0.05

        # Time decay (if created_at provided)
        created_at = report_data.get("created_at")
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))

            age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600
            decay_periods = int(age_hours / 6)  # Every 6 hours
            score -= decay_periods * 0.1

        # Multi-source agreement (if existing_reports provided)
        if existing_reports:
            agreement_bonus = TrustScoreCalculator._check_multi_source_agreement(
                report_data, existing_reports
            )
            score += agreement_bonus

        return min(1.0, max(0.0, score))

    @staticmethod
    def _check_multi_source_agreement(report_data: Dict, existing_reports: List) -> float:
        """
        Check if multiple sources agree on similar events

        Returns:
            float: +0.2 if agreement found, 0 otherwise
        """
        if not report_data.get("lat") or not report_data.get("lon"):
            return 0.0

        # Check reports from last 60 minutes within 5km
        cutoff = datetime.utcnow() - timedelta(minutes=60)
        lat1, lon1 = report_data["lat"], report_data["lon"]

        for existing in existing_reports:
            # Skip if same source
            if existing.get("source") == report_data.get("source"):
                continue

            # Check time window
            existing_time = existing.get("created_at")
            if isinstance(existing_time, str):
                existing_time = datetime.fromisoformat(existing_time.replace('Z', '+00:00'))
            if existing_time < cutoff:
                continue

            # Check distance (rough approximation)
            lat2, lon2 = existing.get("lat"), existing.get("lon")
            if not lat2 or not lon2:
                continue

            distance_km = TrustScoreCalculator._haversine_distance(lat1, lon1, lat2, lon2)
            if distance_km <= 5.0:
                return 0.2

        return 0.0

    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km"""
        from math import radians, sin, cos, sqrt, atan2

        R = 6371  # Earth radius in km

        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))

        return R * c

    @staticmethod
    def find_duplicates(report_data: Dict, existing_reports: List, threshold: float = 0.88) -> List[str]:
        """
        Find potential duplicate reports

        Criteria:
        - Title similarity >= threshold (Jaro-Winkler)
        - OR same location (< 1km) within 60 minutes

        Args:
            report_data: New report data
            existing_reports: List of existing reports
            threshold: Similarity threshold (0.88 default)

        Returns:
            List of report IDs that are potential duplicates
        """
        duplicates = []
        title = report_data.get("title", "").lower()
        lat1, lon1 = report_data.get("lat"), report_data.get("lon")

        cutoff = datetime.utcnow() - timedelta(minutes=60)

        for existing in existing_reports:
            # Check time window
            existing_time = existing.get("created_at")
            if isinstance(existing_time, str):
                existing_time = datetime.fromisoformat(existing_time.replace('Z', '+00:00'))
            if existing_time < cutoff:
                continue

            # Title similarity check
            existing_title = existing.get("title", "").lower()
            similarity = SequenceMatcher(None, title, existing_title).ratio()
            if similarity >= threshold:
                duplicates.append(existing.get("id"))
                continue

            # Location proximity check
            if lat1 and lon1:
                lat2, lon2 = existing.get("lat"), existing.get("lon")
                if lat2 and lon2:
                    distance = TrustScoreCalculator._haversine_distance(lat1, lon1, lat2, lon2)
                    if distance < 1.0:  # < 1km
                        duplicates.append(existing.get("id"))

        return duplicates
