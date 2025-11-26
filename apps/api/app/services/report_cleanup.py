"""
Report Cleanup Service

Automatically deletes reports older than TTL (7 days) from the database.
Runs as a background job every 6 hours.
"""

from datetime import datetime, timedelta
import structlog

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import Report

logger = structlog.get_logger(__name__)

# Configuration
REPORT_TTL_DAYS = 7


def cleanup_old_reports():
    """
    Delete all reports older than REPORT_TTL_DAYS.

    Called by APScheduler every 6 hours.
    """
    logger.info("report_cleanup_started", ttl_days=REPORT_TTL_DAYS)

    db: Session = next(get_db())

    try:
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=REPORT_TTL_DAYS)

        # Count reports to delete (for logging)
        from sqlalchemy import select, func
        count_result = db.execute(
            select(func.count(Report.id)).where(Report.created_at < cutoff_date)
        ).scalar()

        if count_result == 0:
            logger.info(
                "report_cleanup_completed",
                deleted_count=0,
                message="No old reports to delete"
            )
            return 0

        logger.info(
            "report_cleanup_deleting",
            count=count_result,
            cutoff_date=cutoff_date.isoformat()
        )

        # Delete old reports
        deleted_count = db.execute(
            delete(Report).where(Report.created_at < cutoff_date)
        ).rowcount

        db.commit()

        logger.info(
            "report_cleanup_completed",
            deleted_count=deleted_count,
            cutoff_date=cutoff_date.isoformat()
        )

        return deleted_count

    except Exception as e:
        logger.error(
            "report_cleanup_failed",
            error=str(e),
            exc_info=True
        )
        db.rollback()
        return 0
    finally:
        db.close()


# For manual testing
if __name__ == "__main__":
    print(f"Running report cleanup (TTL: {REPORT_TTL_DAYS} days)...")
    deleted = cleanup_old_reports()
    print(f"Deleted {deleted} old reports.")
