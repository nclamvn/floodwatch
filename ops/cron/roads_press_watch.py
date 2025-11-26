#!/usr/bin/env python3
"""
Road Press Watch - Monitor news sources for road status updates
Scrapes Vietnamese news sites for keywords related to road closures and landslides

Runs every 1 hour
"""

import os
import sys
import requests
import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

API_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Keywords for road events
KEYWORDS = {
    "CLOSED": ["sạt lở", "chia cắt", "đóng cửa", "cấm đường", "tạm dừng lưu thông"],
    "RESTRICTED": ["hạn chế", "cảnh báo", "nguy hiểm", "mưa lớn", "tốc độ"],
}

# Common road segments in Central Vietnam
# IMPORTANT: Use correct names! "Đèo Nhông" is in Phù Mỹ district, NOT "Đèo Phù Mỹ"
ROAD_SEGMENTS = {
    # National highways
    "QL1A": ["Quốc lộ 1A", "QL1A", "QL 1A", "quốc lộ 1"],
    "QL9": ["Quốc lộ 9", "QL9", "QL 9", "Lao Bảo"],
    "QL14": ["Quốc lộ 14", "QL14", "QL 14"],
    "QL49": ["Quốc lộ 49", "QL49", "QL 49"],

    # Mountain passes (Đèo) - Central Vietnam
    "Đèo Hải Vân": ["Đèo Hải Vân", "Hải Vân", "Hai Van"],
    "Đèo Nhông": ["Đèo Nhông", "Deo Nhong", "đèo Nhông Phù Mỹ"],  # In Phù Mỹ district, Bình Định
    "Đèo Cù Mông": ["Đèo Cù Mông", "Cù Mông", "Cu Mong"],
    "Đèo Cả": ["Đèo Cả", "Deo Ca", "đèo Cả"],
    "Đèo Lò Xo": ["Đèo Lò Xo", "Lò Xo", "Lo Xo"],
    "Đèo Ngang": ["Đèo Ngang", "Ngang", "Hoành Sơn"],
    "Đèo Phước Tượng": ["Đèo Phước Tượng", "Phước Tượng", "Phuoc Tuong"],
    "Đèo Phú Gia": ["Đèo Phú Gia", "Phú Gia", "Phu Gia"],

    # Bridges (Cầu)
    "Cầu Thạch Hãn": ["Cầu Thạch Hãn", "Thạch Hãn"],
    "Cầu Hiền Lương": ["Cầu Hiền Lương", "Hiền Lương", "Bến Hải"],
}

# Province mapping
PROVINCES = {
    "Quảng Bình": ["Quảng Bình", "Quang Binh", "Đồng Hới"],
    "Quảng Trị": ["Quảng Trị", "Quang Tri", "Đông Hà"],
    "Thừa Thiên Huế": ["Thừa Thiên Huế", "Thua Thien Hue", "Huế", "Hue"],
    "Đà Nẵng": ["Đà Nẵng", "Da Nang"],
    "Quảng Nam": ["Quảng Nam", "Quang Nam", "Tam Kỳ"],
    "Quảng Ngãi": ["Quảng Ngãi", "Quang Ngai"],
}

# News sources (simplified - real implementation would have specific selectors per site)
NEWS_SOURCES = [
    {
        "name": "VnExpress",
        "url": "https://vnexpress.net/thoi-su",
        "enabled": False  # Disabled for MVP - requires specific selectors
    },
    {
        "name": "Thanh Nien",
        "url": "https://thanhnien.vn/thoi-su/",
        "enabled": False  # Disabled for MVP
    },
]


class RoadPressWatcher:
    """Monitor news for road status updates"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.ingested_hashes = self._load_ingested_hashes()

    def _load_ingested_hashes(self) -> set:
        """Load previously ingested article hashes to avoid duplicates"""
        hash_file = "/tmp/roads_press_hashes.json"
        try:
            if os.path.exists(hash_file):
                with open(hash_file, 'r') as f:
                    data = json.load(f)
                    # Keep only hashes from last 24 hours
                    cutoff = (datetime.now() - timedelta(hours=24)).isoformat()
                    return set([h for h, ts in data.items() if ts > cutoff])
        except:
            pass
        return set()

    def _save_ingested_hashes(self):
        """Save ingested hashes with timestamps"""
        hash_file = "/tmp/roads_press_hashes.json"
        try:
            data = {h: datetime.now().isoformat() for h in self.ingested_hashes}
            with open(hash_file, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            print(f"⚠️  Could not save hashes: {e}")

    def _compute_hash(self, segment: str, province: str, date_bucket: str) -> str:
        """Compute hash for idempotency (segment + province + 6h bucket)"""
        key = f"{segment.lower()}|{province.lower()}|{date_bucket}"
        return hashlib.sha1(key.encode()).hexdigest()

    def _extract_segment_name(self, text: str) -> Optional[str]:
        """Extract road segment name from text"""
        text_lower = text.lower()
        for segment, aliases in ROAD_SEGMENTS.items():
            for alias in aliases:
                if alias.lower() in text_lower:
                    return segment
        return None

    def _extract_province(self, text: str) -> Optional[str]:
        """Extract province from text"""
        text_lower = text.lower()
        for province, aliases in PROVINCES.items():
            for alias in aliases:
                if alias.lower() in text_lower:
                    return province
        return None

    def _determine_status(self, text: str) -> str:
        """Determine road status from text"""
        text_lower = text.lower()

        # Check for CLOSED keywords
        for keyword in KEYWORDS["CLOSED"]:
            if keyword in text_lower:
                return "CLOSED"

        # Check for RESTRICTED keywords
        for keyword in KEYWORDS["RESTRICTED"]:
            if keyword in text_lower:
                return "RESTRICTED"

        return "RESTRICTED"  # Default to RESTRICTED if keywords found

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4)
    )
    def _fetch_url(self, url: str, timeout: int = 8) -> Optional[str]:
        """Fetch URL with retry"""
        try:
            response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"❌ Error fetching {url}: {e}")
            return None

    def scrape_mock_events(self) -> List[Dict]:
        """
        Generate mock road events for testing
        In production, this would scrape real news sites
        """
        import random

        mock_events = []
        segments = list(ROAD_SEGMENTS.keys())
        provinces = list(PROVINCES.keys())

        # Generate 1-2 random events
        for _ in range(random.randint(1, 2)):
            segment = random.choice(segments)
            province = random.choice(provinces)
            status = random.choice(["CLOSED", "RESTRICTED"])

            # Generate date bucket (6h intervals)
            now = datetime.now()
            bucket = now.replace(hour=(now.hour // 6) * 6, minute=0, second=0).isoformat()

            # Compute hash for idempotency
            event_hash = self._compute_hash(segment, province, bucket)

            # Skip if already ingested
            if event_hash in self.ingested_hashes:
                continue

            reason = "Sạt lở nghiêm trọng" if status == "CLOSED" else "Mưa lớn, hạn chế tốc độ"

            mock_events.append({
                "segment_name": segment,
                "status": status,
                "reason": reason,
                "province": province,
                "last_verified": now.isoformat(),
                "source": "PRESS",
                "hash": event_hash
            })

        return mock_events

    def ingest_events(self, events: List[Dict]) -> Dict:
        """Send events to API"""
        if not events:
            return {"status": "success", "ingested": 0}

        try:
            # For each event, call API
            ingested = 0
            for event in events:
                event_copy = event.copy()
                event_hash = event_copy.pop("hash")

                # POST to /ingest/road-event endpoint
                response = requests.post(
                    f"{API_URL}/ingest/road-event",
                    json=event_copy,
                    timeout=10
                )

                if response.status_code in [200, 201]:
                    self.ingested_hashes.add(event_hash)
                    ingested += 1
                else:
                    print(f"⚠️  API returned {response.status_code}: {response.text}")

            self._save_ingested_hashes()

            return {
                "status": "success",
                "ingested": ingested
            }
        except requests.exceptions.RequestException as e:
            print(f"❌ Error ingesting events: {e}")
            return {"status": "error", "message": str(e)}

    def run(self):
        """Main run method"""
        print(f"🔄 [{datetime.now().isoformat()}] Starting road press watch...")

        # For MVP, use mock events
        # In production, would scrape real news sites
        events = self.scrape_mock_events()

        if not events:
            print("ℹ️  No new road events found")
            return

        print(f"📊 Found {len(events)} new road events")

        # Log events for debugging
        for event in events:
            print(f"   • {event['segment_name']} ({event['province']}): {event['status']}")

        # Ingest events to API
        result = self.ingest_events(events)

        if result.get("status") == "success":
            print(f"✅ Successfully ingested {result.get('ingested', 0)} road events")
        else:
            print(f"❌ Failed to ingest: {result}")


def main():
    watcher = RoadPressWatcher()
    watcher.run()


if __name__ == "__main__":
    main()
