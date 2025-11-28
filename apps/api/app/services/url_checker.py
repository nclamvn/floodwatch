"""
URL Checker Service - Detect and mark dead URLs in reports

This service is used by a cron job to check if source URLs are still accessible.
Reports with dead URLs (404, 410, 403) are marked as is_deleted=true.

Schedule: Every 6 hours, check 200 URLs
"""
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
import structlog

from sqlalchemy.orm import Session
from app.database.models import Report

logger = structlog.get_logger()


async def check_single_url(client: httpx.AsyncClient, url: str, timeout: float = 5.0) -> tuple[str, bool, Optional[int]]:
    """
    Check if a single URL is accessible.

    Returns:
        (url, is_dead, status_code)
    """
    try:
        # Use HEAD request for efficiency
        response = await client.head(url, follow_redirects=True)

        # Mark as dead if 404, 410 (Gone), or 403 (Forbidden - often means content removed)
        is_dead = response.status_code in [404, 410, 403]
        return (url, is_dead, response.status_code)

    except httpx.TimeoutException:
        # Timeout is not considered "dead" - could be temporary network issue
        logger.debug("url_check_timeout", url=url)
        return (url, False, None)

    except httpx.RequestError as e:
        # Network errors - could be DNS, SSL, connection refused
        # Be conservative: don't mark as dead on network errors
        logger.debug("url_check_error", url=url, error=str(e))
        return (url, False, None)


async def check_dead_urls(db: Session, limit: int = 200, days_back: int = 7) -> dict:
    """
    Check recent reports for dead source URLs.

    Args:
        db: Database session
        limit: Maximum number of URLs to check (default: 200)
        days_back: Only check reports created within this many days (default: 7)

    Returns:
        dict with stats: {"checked": int, "marked_deleted": int}
    """
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    # Get reports that:
    # 1. Have a source URL
    # 2. Are not already deleted
    # 3. Were created recently
    # 4. Haven't been checked recently (within last 24 hours)
    last_check_cutoff = datetime.utcnow() - timedelta(hours=24)

    reports = db.query(Report).filter(
        Report.created_at >= cutoff,
        Report.is_deleted == False,
        Report.source.isnot(None),
        Report.source != '',
        # Only check if never checked or checked > 24h ago
        (Report.last_check_at.is_(None)) | (Report.last_check_at < last_check_cutoff)
    ).order_by(Report.created_at.desc()).limit(limit).all()

    if not reports:
        logger.info("url_checker_no_reports", message="No reports to check")
        return {"checked": 0, "marked_deleted": 0}

    logger.info("url_checker_starting", count=len(reports))

    marked_deleted = 0

    # Use httpx async client with connection pooling
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(5.0, connect=3.0),
        follow_redirects=True,
        headers={"User-Agent": "FloodWatch/1.0 URL Checker"}
    ) as client:

        # Process in batches of 10 to avoid overwhelming servers
        batch_size = 10
        for i in range(0, len(reports), batch_size):
            batch = reports[i:i + batch_size]

            # Create tasks for concurrent checking
            tasks = [
                check_single_url(client, report.source)
                for report in batch
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for report, result in zip(batch, results):
                if isinstance(result, Exception):
                    logger.warning("url_check_exception", url=report.source, error=str(result))
                    continue

                url, is_dead, status_code = result

                # Always update last_check_at
                report.last_check_at = datetime.utcnow()

                if is_dead:
                    report.is_deleted = True
                    marked_deleted += 1
                    logger.info("url_marked_dead", report_id=str(report.id), url=url, status=status_code)

            # Small delay between batches to be polite
            await asyncio.sleep(0.5)

    db.commit()

    stats = {
        "checked": len(reports),
        "marked_deleted": marked_deleted
    }

    logger.info("url_checker_complete", **stats)
    return stats


def run_url_checker(db: Session, limit: int = 200) -> dict:
    """
    Synchronous wrapper for check_dead_urls.
    Use this from cron jobs or CLI.
    """
    return asyncio.run(check_dead_urls(db, limit))
