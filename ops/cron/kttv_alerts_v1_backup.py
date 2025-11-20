#!/usr/bin/env python3
"""
KTTV Alert Ingestion Script
Crawls alerts from NCHMF (nchmf.gov.vn) and ingests into FloodWatch API

For now, generates mock data. Will be replaced with real scraping.
"""

import os
import sys
import requests
import random
from datetime import datetime
from typing import List, Dict

API_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Mock provinces in Central Vietnam (most flood-prone)
PROVINCES = [
    "Quảng Bình",
    "Quảng Trị",
    "Thừa Thiên Huế",
    "Đà Nẵng",
    "Quảng Nam",
    "Quảng Ngãi",
    "Bình Định",
    "Phú Yên",
    "Khánh Hòa"
]

# Province coordinates (approximate center)
PROVINCE_COORDS = {
    "Quảng Bình": (17.4680, 106.6232),
    "Quảng Trị": (16.7463, 106.9594),
    "Thừa Thiên Huế": (16.4637, 107.5909),
    "Đà Nẵng": (16.0544, 108.2022),
    "Quảng Nam": (15.5769, 108.4799),
    "Quảng Ngãi": (15.1214, 108.8044),
    "Bình Định": (14.1665, 109.0019),
    "Phú Yên": (13.0881, 109.0929),
    "Khánh Hòa": (12.2388, 109.1967),
}

MOCK_ALERTS = [
    "Cảnh báo mưa lớn",
    "Nguy cơ lũ quét",
    "Cảnh báo sạt lở đất",
    "Mực nước sông dâng cao",
    "Cảnh báo ngập lụt",
    "Triều cường kết hợp mưa lớn",
    "Cảnh báo lũ ống, lũ quét",
]


def generate_mock_alerts() -> List[Dict]:
    """Generate mock alerts for testing"""
    num_alerts = random.randint(1, 3)
    alerts = []

    for _ in range(num_alerts):
        province = random.choice(PROVINCES)
        lat, lon = PROVINCE_COORDS[province]
        # Add some random offset
        lat += random.uniform(-0.2, 0.2)
        lon += random.uniform(-0.2, 0.2)

        alert = {
            "title": random.choice(MOCK_ALERTS) + f" tại {province}",
            "province": province,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "level": random.choice(["medium", "high", "critical"]),
            "source": "KTTV",
            "description": f"Dự báo trong 24h tới, khu vực {province} có khả năng xảy ra {random.choice(MOCK_ALERTS).lower()}. Người dân cần đề phòng."
        }
        alerts.append(alert)

    return alerts


def scrape_nchmf_alerts() -> List[Dict]:
    """
    Scrape actual alerts from NCHMF website
    TODO: Implement real scraping from nchmf.gov.vn

    For now, returns mock data
    """
    # Future implementation:
    # 1. Fetch https://www.nchmf.gov.vn/web/content/view/9/80/
    # 2. Parse HTML with BeautifulSoup
    # 3. Extract alert titles, locations, timestamps
    # 4. Geocode locations to lat/lon
    # 5. Return structured data

    return generate_mock_alerts()


def ingest_alerts(alerts: List[Dict]) -> Dict:
    """Send alerts to FloodWatch API"""
    try:
        response = requests.post(
            f"{API_URL}/ingest/alerts",
            json=alerts,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error ingesting alerts: {e}")
        return {"status": "error", "message": str(e)}


def main():
    print(f"🔄 [{datetime.now().isoformat()}] Starting KTTV alert ingestion...")

    # Scrape alerts (mock for now)
    alerts = scrape_nchmf_alerts()

    if not alerts:
        print("ℹ️  No new alerts found")
        return

    print(f"📊 Found {len(alerts)} alerts")

    # Ingest into API
    result = ingest_alerts(alerts)

    if result.get("status") == "success":
        print(f"✅ Successfully ingested {result.get('ingested', 0)} alerts")
    else:
        print(f"❌ Failed to ingest alerts: {result}")


if __name__ == "__main__":
    main()
