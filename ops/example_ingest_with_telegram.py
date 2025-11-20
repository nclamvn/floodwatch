#!/usr/bin/env python3
"""
Example: How to integrate Telegram notifications into your ingest script

This shows how to modify existing ingest scripts (like kttv_alerts.py)
to automatically send Telegram alerts to subscribers.
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'api'))

from app.database import get_db_context, Report
from app.services.telegram_alerts import notify_subscribers_for_alert
from datetime import datetime
from uuid import uuid4


def ingest_alert_example():
    """
    Example function showing how to ingest an alert AND send Telegram notifications

    This is what you would add to your existing ingest scripts.
    """

    # Example: Create a new alert (this is what your scraper/API does)
    new_alert_data = {
        "id": uuid4(),
        "type": "ALERT",
        "source": "KTTV",
        "title": "Cảnh báo mưa lớn Quảng Trị",
        "description": "Dự báo mưa to đến rất to trong 12-24h tới, lượng mưa 100-200mm",
        "province": "Quảng Trị",
        "district": "Hải Lăng",
        "lat": 16.7463,
        "lon": 107.2303,
        "trust_score": 0.85,
        "status": "new",
        "media": [],
        "created_at": datetime.utcnow()
    }

    with get_db_context() as db:
        # 1. Save alert to database (existing code)
        new_alert = Report(**new_alert_data)
        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)

        print(f"✅ Alert saved to database: {new_alert.id}")

        # 2. NEW: Send Telegram notifications to subscribers
        result = notify_subscribers_for_alert(db, new_alert)

        print(f"📱 Telegram notifications:")
        print(f"   - Sent: {result['sent']}")
        print(f"   - Failed: {result['failed']}")
        print(f"   - Skipped: {result['skipped']}")


def ingest_multiple_alerts_example():
    """
    Example: Batch ingest with Telegram notifications
    """
    alerts_data = [
        {
            "province": "Đà Nẵng",
            "title": "Cảnh báo sạt lở Sơn Trà",
            "trust_score": 0.75
        },
        {
            "province": "Quảng Nam",
            "title": "Mưa lớn khu vực miền núi",
            "trust_score": 0.90
        }
    ]

    with get_db_context() as db:
        for alert_data in alerts_data:
            # Create and save alert
            alert = Report(
                id=uuid4(),
                type="ALERT",
                source="KTTV",
                title=alert_data["title"],
                province=alert_data["province"],
                trust_score=alert_data["trust_score"],
                status="new",
                media=[],
                created_at=datetime.utcnow()
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)

            # Send Telegram notification
            notify_subscribers_for_alert(db, alert)

        print(f"✅ Processed {len(alerts_data)} alerts")


# ============================================================
# How to modify YOUR existing ingest script:
# ============================================================
"""
# In ops/kttv_alerts.py (or your ingest script):

# 1. Add imports at the top:
from app.services.telegram_alerts import notify_subscribers_for_alert

# 2. Find where you save reports to database, e.g.:
def save_alert(alert_data):
    with get_db_context() as db:
        new_alert = Report(**alert_data)
        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)

        # ADD THIS LINE:
        notify_subscribers_for_alert(db, new_alert)

        return new_alert

# That's it! Now whenever you ingest an alert, subscribers will get notified.
"""


if __name__ == "__main__":
    print("=" * 60)
    print("Example: Ingest Alert with Telegram Notification")
    print("=" * 60)

    # Run example
    ingest_alert_example()

    print("\n" + "=" * 60)
    print("Check:")
    print("1. Database has new alert: SELECT * FROM reports ORDER BY created_at DESC LIMIT 1;")
    print("2. Telegram subscribers for Quảng Trị should receive message")
    print("=" * 60)
