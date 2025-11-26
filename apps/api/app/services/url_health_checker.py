"""
URL Health Checker Service

Checks if report source URLs are still alive and removes dead reports from the database.
Runs as a background job every 2 hours.
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
from collections import defaultdict
from urllib.parse import urlparse
from typing import List, Dict, Tuple
import structlog

from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import Report

logger = structlog.get_logger(__name__)

# Configuration
URL_TIMEOUT_SECONDS = 10
BATCH_SIZE = 50
RATE_LIMIT_DELAY = 1.0  # seconds between requests to same domain
RETRY_COUNT = 1
RETRY_DELAY_SECONDS = 5
MAX_AGE_DAYS = 7  # Only check URLs from reports in the last 7 days

# HTTP status codes that indicate the URL is dead
DEAD_STATUS_CODES = {404, 410, 403, 451}  # Not Found, Gone, Forbidden, Legal Block


def is_valid_url(source: str) -> bool:
    """Check if a source string is a valid HTTP/HTTPS URL."""
    if not source:
        return False
    try:
        parsed = urlparse(source)
        return parsed.scheme in ('http', 'https') and bool(parsed.netloc)
    except Exception:
        return False


def get_domain(url: str) -> str:
    """Extract domain from URL for rate limiting."""
    try:
        return urlparse(url).netloc
    except Exception:
        return ''


async def check_url_health(session: aiohttp.ClientSession, url: str) -> Tuple[str, bool, str]:
    """
    Check if a URL is still alive using HTTP HEAD request.

    Returns:
        Tuple of (url, is_alive, reason)
    """
    try:
        async with session.head(url, timeout=aiohttp.ClientTimeout(total=URL_TIMEOUT_SECONDS), allow_redirects=True) as response:
            if response.status in DEAD_STATUS_CODES:
                return (url, False, f"HTTP {response.status}")
            elif 200 <= response.status < 400:
                return (url, True, "OK")
            elif response.status >= 500:
                # Server error - retry once
                await asyncio.sleep(RETRY_DELAY_SECONDS)
                async with session.head(url, timeout=aiohttp.ClientTimeout(total=URL_TIMEOUT_SECONDS), allow_redirects=True) as retry_response:
                    if retry_response.status >= 500 or retry_response.status in DEAD_STATUS_CODES:
                        return (url, False, f"HTTP {retry_response.status} (after retry)")
                    return (url, True, f"OK (after retry, {retry_response.status})")
            else:
                return (url, True, f"HTTP {response.status}")
    except asyncio.TimeoutError:
        # Timeout - retry once
        try:
            await asyncio.sleep(RETRY_DELAY_SECONDS)
            async with session.head(url, timeout=aiohttp.ClientTimeout(total=URL_TIMEOUT_SECONDS), allow_redirects=True) as retry_response:
                return (url, True, f"OK (after timeout retry, {retry_response.status})")
        except Exception:
            return (url, False, "Timeout (after retry)")
    except aiohttp.ClientError as e:
        return (url, False, f"Connection error: {type(e).__name__}")
    except Exception as e:
        return (url, False, f"Error: {type(e).__name__}")


async def check_urls_batch(urls: List[str]) -> Dict[str, Tuple[bool, str]]:
    """
    Check a batch of URLs with rate limiting per domain.

    Returns:
        Dict mapping URL to (is_alive, reason)
    """
    results = {}
    domain_last_request = defaultdict(float)

    # Custom headers to look like a real browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; FloodWatch/1.0; +https://floodwatch.vn)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    connector = aiohttp.TCPConnector(limit=10, limit_per_host=2)

    async with aiohttp.ClientSession(headers=headers, connector=connector) as session:
        for url in urls:
            domain = get_domain(url)

            # Rate limit: ensure at least RATE_LIMIT_DELAY between requests to same domain
            now = asyncio.get_event_loop().time()
            time_since_last = now - domain_last_request[domain]
            if time_since_last < RATE_LIMIT_DELAY:
                await asyncio.sleep(RATE_LIMIT_DELAY - time_since_last)

            # Check the URL
            url, is_alive, reason = await check_url_health(session, url)
            results[url] = (is_alive, reason)

            # Update last request time for this domain
            domain_last_request[domain] = asyncio.get_event_loop().time()

    return results


def check_dead_urls():
    """
    Main job function: Check all report URLs and delete those with dead sources.

    This function is synchronous but internally uses async for URL checking.
    Called by APScheduler.
    """
    logger.info("url_health_check_started")

    db: Session = next(get_db())

    try:
        # Get reports from last 7 days with valid URL sources
        cutoff_date = datetime.utcnow() - timedelta(days=MAX_AGE_DAYS)

        reports = db.execute(
            select(Report.id, Report.source, Report.title)
            .where(Report.created_at >= cutoff_date)
            .where(Report.source.isnot(None))
        ).fetchall()

        # Filter to valid URLs only
        url_to_reports = defaultdict(list)
        for report_id, source, title in reports:
            if is_valid_url(source):
                url_to_reports[source].append((report_id, title))

        urls = list(url_to_reports.keys())

        if not urls:
            logger.info("url_health_check_completed", total_urls=0, dead_urls=0, deleted_reports=0)
            return

        logger.info("url_health_check_checking", total_urls=len(urls))

        # Check URLs in batches
        all_results = {}
        for i in range(0, len(urls), BATCH_SIZE):
            batch = urls[i:i + BATCH_SIZE]
            batch_results = asyncio.run(check_urls_batch(batch))
            all_results.update(batch_results)

        # Find dead URLs and their reports
        dead_report_ids = []
        dead_urls_log = []

        for url, (is_alive, reason) in all_results.items():
            if not is_alive:
                for report_id, title in url_to_reports[url]:
                    dead_report_ids.append(report_id)
                    dead_urls_log.append({
                        "url": url,
                        "reason": reason,
                        "report_id": str(report_id),
                        "title": title[:50] if title else None
                    })

        # Log dead URLs before deletion
        if dead_urls_log:
            logger.info(
                "url_health_check_dead_urls_found",
                count=len(dead_urls_log),
                dead_urls=dead_urls_log[:10]  # Log first 10 for debugging
            )

        # Delete reports with dead URLs
        if dead_report_ids:
            deleted_count = db.execute(
                delete(Report).where(Report.id.in_(dead_report_ids))
            ).rowcount
            db.commit()

            logger.info(
                "url_health_check_deleted",
                deleted_reports=deleted_count,
                expected=len(dead_report_ids)
            )
        else:
            deleted_count = 0

        # Summary
        alive_count = sum(1 for is_alive, _ in all_results.values() if is_alive)
        dead_count = sum(1 for is_alive, _ in all_results.values() if not is_alive)

        logger.info(
            "url_health_check_completed",
            total_urls=len(urls),
            alive_urls=alive_count,
            dead_urls=dead_count,
            deleted_reports=deleted_count
        )

    except Exception as e:
        logger.error(
            "url_health_check_failed",
            error=str(e),
            exc_info=True
        )
        db.rollback()
    finally:
        db.close()


# For manual testing
if __name__ == "__main__":
    print("Running URL health check...")
    check_dead_urls()
    print("Done.")
