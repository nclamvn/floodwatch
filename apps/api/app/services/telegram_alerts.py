"""
Telegram Alert Sender
Automatically sends alerts to subscribers based on their province preferences
"""
import logging
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import TelegramSubscription, Report
from app.services.telegram_bot import telegram_bot

logger = logging.getLogger(__name__)


def notify_subscribers_for_alert(
    db: Session,
    alert: Report
) -> Dict[str, int]:
    """
    Send alert to all subscribers interested in this province

    Args:
        db: Database session
        alert: Report object (must have province, title, description, etc.)

    Returns:
        Dict with success/failure counts

    Example:
        from app.database import get_db_context
        from app.services.telegram_alerts import notify_subscribers_for_alert

        with get_db_context() as db:
            report = db.query(Report).filter(Report.id == report_id).first()
            result = notify_subscribers_for_alert(db, report)
            print(f"Sent to {result['sent']} users, {result['failed']} failed")
    """
    if not alert.province:
        logger.warning(f"Alert {alert.id} has no province, skipping Telegram notification")
        return {"sent": 0, "failed": 0, "skipped": 1}

    # Find all active subscribers for this province
    # Note: provinces is a JSONB array, we need to use contains
    subscribers = db.query(TelegramSubscription).filter(
        and_(
            TelegramSubscription.is_active == True,
            TelegramSubscription.provinces.contains([alert.province]),
            TelegramSubscription.min_trust_score <= alert.trust_score
        )
    ).all()

    if not subscribers:
        logger.info(f"No subscribers found for province '{alert.province}'")
        return {"sent": 0, "failed": 0, "skipped": 0}

    logger.info(f"Found {len(subscribers)} subscribers for {alert.province}")

    sent_count = 0
    failed_count = 0

    for sub in subscribers:
        try:
            # Convert report to dict for telegram_bot.send_alert
            alert_dict = alert.to_dict()

            success = telegram_bot.send_alert(sub.chat_id, alert_dict)

            if success:
                sent_count += 1
                logger.info(f"✅ Alert sent to chat_id={sub.chat_id} (username={sub.username})")
            else:
                failed_count += 1
                logger.error(f"❌ Failed to send alert to chat_id={sub.chat_id}")

        except Exception as e:
            failed_count += 1
            logger.error(f"❌ Error sending to chat_id={sub.chat_id}: {e}")

    logger.info(
        f"Alert notification complete for {alert.province}: "
        f"{sent_count} sent, {failed_count} failed"
    )

    return {
        "sent": sent_count,
        "failed": failed_count,
        "skipped": 0
    }


def notify_subscribers_batch(
    db: Session,
    alert_ids: List[str]
) -> Dict[str, int]:
    """
    Send multiple alerts in batch

    Args:
        db: Database session
        alert_ids: List of alert UUIDs

    Returns:
        Dict with total success/failure counts

    Example:
        result = notify_subscribers_batch(db, [uuid1, uuid2, uuid3])
    """
    total_sent = 0
    total_failed = 0
    total_skipped = 0

    for alert_id in alert_ids:
        alert = db.query(Report).filter(Report.id == alert_id).first()

        if not alert:
            logger.warning(f"Alert {alert_id} not found in database")
            total_skipped += 1
            continue

        result = notify_subscribers_for_alert(db, alert)
        total_sent += result["sent"]
        total_failed += result["failed"]
        total_skipped += result["skipped"]

    return {
        "sent": total_sent,
        "failed": total_failed,
        "skipped": total_skipped
    }


def get_subscriber_count_by_province(db: Session) -> Dict[str, int]:
    """
    Get count of active subscribers per province

    Returns:
        Dict mapping province name to subscriber count

    Example:
        counts = get_subscriber_count_by_province(db)
        # {"Quảng Trị": 15, "Đà Nẵng": 23, ...}
    """
    from sqlalchemy import func

    # Query to unnest JSONB array and count
    # This requires PostgreSQL JSONB functions
    result = db.execute("""
        SELECT
            province,
            COUNT(*) as subscriber_count
        FROM telegram_subscriptions,
             jsonb_array_elements_text(provinces) as province
        WHERE is_active = true
        GROUP BY province
        ORDER BY subscriber_count DESC
    """)

    return {row[0]: row[1] for row in result}


# Example usage in ingest scripts:
"""
# In ops/kttv_alerts.py or similar:

from app.database import get_db_context, Report
from app.services.telegram_alerts import notify_subscribers_for_alert

# After inserting a new alert into database:
new_alert = Report(
    type="ALERT",
    source="KTTV",
    title="Cảnh báo mưa lớn Quảng Trị",
    province="Quảng Trị",
    trust_score=0.85,
    ...
)
db.add(new_alert)
db.commit()
db.refresh(new_alert)

# Send to Telegram subscribers
with get_db_context() as db:
    result = notify_subscribers_for_alert(db, new_alert)
    print(f"Telegram: {result['sent']} sent, {result['failed']} failed")
"""
