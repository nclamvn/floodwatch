#!/usr/bin/env python3
"""
Alerts Dispatcher - Process and deliver alerts to subscriptions
Runs every 2 minutes to check for new high-priority reports

Rules:
- SOS with trust >= 0.8
- ROAD=CLOSED
- Delivers via webhook (with HMAC signature)
- Retries: 1s, 2s, 4s (exponential backoff)
"""

import os
import sys
import json
import hmac
import hashlib
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../apps/api'))

from app.database import get_db_context, Subscription, Delivery, Report
from sqlalchemy import and_

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALERTS_MAP_FILE = os.path.join(os.path.dirname(__file__), '../configs/alerts_map.json')


class AlertsDispatcher:
    """Dispatcher for alert deliveries"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'FloodWatch-AlertsBot/1.0',
            'Content-Type': 'application/json'
        })
        self.telegram_map = self._load_telegram_map()

    def _load_telegram_map(self) -> Dict[str, str]:
        """Load province -> chat_id mapping from JSON"""
        if not os.path.exists(ALERTS_MAP_FILE):
            print(f"⚠️  Telegram map not found at {ALERTS_MAP_FILE}")
            return {}

        try:
            with open(ALERTS_MAP_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Error loading Telegram map: {e}")
            return {}

    def should_alert(self, report: Report) -> bool:
        """Determine if report triggers an alert"""
        # Rule 1: SOS with high trust
        if report.type.value == "SOS" and report.trust_score >= 0.8:
            return True

        # Rule 2: Road CLOSED
        if report.type.value == "ROAD" and "CLOSED" in (report.title or "").upper():
            return True

        return False

    def find_matching_subscriptions(self, db, report: Report) -> List[Subscription]:
        """Find subscriptions that match this report"""
        all_subscriptions = db.query(Subscription).all()
        matching = []

        for sub in all_subscriptions:
            # Check province filter
            if sub.provinces and report.province not in sub.provinces:
                continue

            # Check type filter
            if sub.types and report.type.value not in sub.types:
                continue

            # Check trust score filter
            if report.trust_score < sub.min_trust:
                continue

            matching.append(sub)

        return matching

    def create_delivery(self, db, subscription_id: str, report_id: str):
        """Create a delivery record"""
        delivery = Delivery(
            subscription_id=subscription_id,
            report_id=report_id,
            status="pending",
            attempts=0
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        return delivery

    def send_webhook(self, subscription: Subscription, report: Report, delivery: Delivery, db) -> bool:
        """Send webhook with HMAC signature"""
        payload = {
            "event": "alert",
            "timestamp": datetime.utcnow().isoformat(),
            "delivery_id": str(delivery.id),
            "report": report.to_dict()
        }

        payload_json = json.dumps(payload, ensure_ascii=False)

        # Calculate HMAC signature if secret provided
        headers = {}
        if subscription.secret:
            signature = hmac.new(
                subscription.secret.encode(),
                payload_json.encode(),
                hashlib.sha256
            ).hexdigest()
            headers['X-Signature'] = f'sha256={signature}'

        # Retry logic: 1s, 2s, 4s
        retry_delays = [1, 2, 4]
        max_attempts = len(retry_delays) + 1

        for attempt in range(max_attempts):
            try:
                delivery.attempts = attempt + 1
                db.commit()

                response = self.session.post(
                    subscription.callback_url,
                    data=payload_json,
                    headers=headers,
                    timeout=5
                )

                if response.status_code in [200, 201, 202]:
                    # Success
                    delivery.status = "sent"
                    delivery.sent_at = datetime.utcnow()
                    delivery.last_error = None
                    db.commit()
                    print(f"✅ Delivered to {subscription.org_name} ({response.status_code})")
                    return True
                else:
                    # Non-2xx status
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                    delivery.last_error = error_msg
                    db.commit()
                    print(f"⚠️  Attempt {attempt + 1} failed: {error_msg}")

            except Exception as e:
                error_msg = f"Exception: {str(e)}"
                delivery.last_error = error_msg
                db.commit()
                print(f"⚠️  Attempt {attempt + 1} failed: {error_msg}")

            # Wait before retry (if not last attempt)
            if attempt < max_attempts - 1:
                import time
                time.sleep(retry_delays[attempt])

        # All attempts failed
        delivery.status = "failed"
        db.commit()
        print(f"❌ Failed to deliver to {subscription.org_name} after {max_attempts} attempts")
        return False

    def send_telegram(self, report: Report) -> bool:
        """Send Telegram message to province group"""
        if not TELEGRAM_BOT_TOKEN:
            print("⚠️  TELEGRAM_BOT_TOKEN not set, skipping Telegram delivery")
            return False

        if not report.province:
            return False

        chat_id = self.telegram_map.get(report.province)
        if not chat_id:
            print(f"⚠️  No Telegram chat_id for province: {report.province}")
            return False

        # Format message
        emoji = "🆘" if report.type.value == "SOS" else "🚧"
        message = f"{emoji} <b>{report.type.value} Alert</b>\n\n"
        message += f"📍 {report.province}"
        if report.district:
            message += f", {report.district}"
        message += f"\n\n{report.description or report.title}\n\n"
        message += f"🔍 Trust Score: {report.trust_score:.2f}\n"
        message += f"🕒 {report.created_at.strftime('%Y-%m-%d %H:%M')}"

        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            response = requests.post(url, json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            }, timeout=5)

            if response.status_code == 200:
                print(f"✅ Telegram sent to {report.province}")
                return True
            else:
                print(f"❌ Telegram failed: {response.text[:200]}")
                return False

        except Exception as e:
            print(f"❌ Telegram error: {e}")
            return False

    def process_pending_deliveries(self, db):
        """Process pending deliveries"""
        # Get pending deliveries (not older than 10 minutes to avoid stale retries)
        cutoff = datetime.utcnow() - timedelta(minutes=10)
        pending = db.query(Delivery).filter(
            and_(
                Delivery.status == "pending",
                Delivery.created_at >= cutoff
            )
        ).all()

        if not pending:
            print("ℹ️  No pending deliveries")
            return

        print(f"📊 Processing {len(pending)} pending deliveries...")

        for delivery in pending:
            # Get subscription and report
            subscription = db.query(Subscription).filter(
                Subscription.id == delivery.subscription_id
            ).first()
            report = db.query(Report).filter(
                Report.id == delivery.report_id
            ).first()

            if not subscription or not report:
                delivery.status = "failed"
                delivery.last_error = "Subscription or report not found"
                db.commit()
                continue

            # Send webhook
            self.send_webhook(subscription, report, delivery, db)

    def run(self):
        """Main run method"""
        print(f"🔄 [{datetime.now().isoformat()}] Starting alerts dispatcher...")

        with get_db_context() as db:
            # 1. Check for new high-priority reports (last 2 minutes)
            cutoff = datetime.utcnow() - timedelta(minutes=2)
            recent_reports = db.query(Report).filter(
                Report.created_at >= cutoff
            ).all()

            alert_count = 0
            for report in recent_reports:
                if not self.should_alert(report):
                    continue

                print(f"🚨 Alert-worthy report: {report.id} ({report.type.value}, score={report.trust_score:.2f})")

                # Find matching subscriptions
                subscriptions = self.find_matching_subscriptions(db, report)
                print(f"   Found {len(subscriptions)} matching subscriptions")

                # Create deliveries (check for duplicates first)
                for sub in subscriptions:
                    # Check if delivery already exists
                    existing = db.query(Delivery).filter(
                        and_(
                            Delivery.subscription_id == sub.id,
                            Delivery.report_id == report.id
                        )
                    ).first()

                    if not existing:
                        delivery = self.create_delivery(db, sub.id, report.id)
                        print(f"   ✓ Created delivery for {sub.org_name}")
                        alert_count += 1

                # Send Telegram (if configured)
                self.send_telegram(report)

            print(f"📊 Created {alert_count} new deliveries")

            # 2. Process pending deliveries
            self.process_pending_deliveries(db)

        print(f"✅ Alerts dispatcher finished")


def main():
    dispatcher = AlertsDispatcher()
    dispatcher.run()


if __name__ == "__main__":
    main()
