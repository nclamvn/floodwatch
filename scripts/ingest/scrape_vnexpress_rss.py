#!/usr/bin/env python3
"""
VnExpress RSS Scraper

Fetches disaster/weather news from VnExpress RSS feeds and stores as Reports.
Source: VnExpress (trust score 0.9)
"""

import sys
import os
from datetime import datetime
from typing import Optional, List
import feedparser
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from apps.api.app.database import SessionLocal, Report, ReportType
from apps.api.app.services.province_extractor import extract_location_data
from geoalchemy2.shape import from_shape
from shapely.geometry import Point


# VnExpress RSS feeds for disaster/weather news
RSS_FEEDS = [
    "https://vnexpress.net/rss/thoi-su.rss",  # News - includes disasters
    "https://vnexpress.net/rss/thoi-tiet.rss",  # Weather (if exists)
]

# Keywords for report type classification
TYPE_KEYWORDS = {
    ReportType.ALERT: [
        "cảnh báo", "canh bao", "nguy hiểm", "nguy hiem",
        "đe dọa", "de doa", "khẩn cấp", "khan cap",
        "sơ tán", "so tan", "di dời", "di doi"
    ],
    ReportType.RAIN: [
        "mưa", "mua", "lũ", "lu", "lụt", "lut", "ngập", "ngap",
        "úng", "ung", "triều cường", "trieu cuong", "thủy triều", "thuy trieu"
    ],
    ReportType.ROAD: [
        "đường", "duong", "giao thông", "giao thong", "quốc lộ", "quoc lo",
        "tắc đường", "tac duong", "sạt lở", "sat lo", "đổ", "do",
        "cầu", "cau", "hầm", "ham"
    ],
    ReportType.SOS: [
        "cứu", "cuu", "cứu hộ", "cuu ho", "cứu trợ", "cuu tro",
        "mất tích", "mat tich", "chết", "chet", "tử vong", "tu vong",
        "nạn nhân", "nan nhan"
    ],
    ReportType.NEEDS: [
        "thiếu", "thieu", "cần", "can", "hỗ trợ", "ho tro",
        "viện trợ", "vien tro", "lương thực", "luong thuc",
        "thuốc men", "thuoc men", "nhu yếu phẩm", "nhu yeu pham"
    ]
}


def classify_report_type(title: str, description: str = "") -> ReportType:
    """
    Classify report type based on title and description keywords.

    Priority order: SOS > ALERT > ROAD > NEEDS > RAIN (default)
    """
    text = (title + " " + description).lower()

    # SOS has highest priority
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.SOS]):
        return ReportType.SOS

    # Then ALERT
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.ALERT]):
        return ReportType.ALERT

    # Then ROAD
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.ROAD]):
        return ReportType.ROAD

    # Then NEEDS
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.NEEDS]):
        return ReportType.NEEDS

    # Default to RAIN (since we're focused on flood/weather)
    return ReportType.RAIN


def clean_html(html_text: str) -> str:
    """Remove HTML tags from text."""
    if not html_text:
        return ""

    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html_text)

    # Decode HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&quot;', '"')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')

    # Remove extra whitespace
    text = ' '.join(text.split())

    return text


def is_disaster_related(title: str, description: str = "") -> bool:
    """
    Check if article is related to disasters/floods/weather.

    Returns False for unrelated news like politics, sports, entertainment, etc.
    """
    text = (title + " " + description).lower()

    # Disaster/weather keywords
    disaster_keywords = [
        "mưa", "mua", "lũ", "lu", "lụt", "lut", "ngập", "ngap",
        "bão", "bao", "thiên tai", "thien tai", "sạt lở", "sat lo",
        "lở đất", "lo dat", "động đất", "dong dat", "hạn hán", "han han",
        "cháy rừng", "chay rung", "triều cường", "trieu cuong",
        "cứu hộ", "cuu ho", "cứu trợ", "cuu tro", "cảnh báo", "canh bao",
        "đường ngập", "duong ngap", "giao thông tê liệt", "giao thong te liet"
    ]

    return any(keyword in text for keyword in disaster_keywords)


def deduplicate_check(db, title: str, created_at: datetime, window_hours: int = 24) -> bool:
    """
    Check if a similar report already exists in the database.

    Args:
        db: Database session
        title: Report title
        created_at: Report creation time
        window_hours: Time window for deduplication (hours)

    Returns:
        True if duplicate found, False otherwise
    """
    from datetime import timedelta

    # Search for reports with similar titles within time window
    time_threshold = created_at - timedelta(hours=window_hours)

    # Simple title similarity check (exact match ignoring case/whitespace)
    normalized_title = ' '.join(title.lower().split())

    existing = db.query(Report).filter(
        Report.created_at >= time_threshold,
        Report.source.like('%vnexpress%')
    ).all()

    for report in existing:
        existing_normalized = ' '.join(report.title.lower().split())

        # If titles are >80% similar, consider it a duplicate
        if normalized_title == existing_normalized:
            return True

        # Check if one title contains the other (substring match)
        if normalized_title in existing_normalized or existing_normalized in normalized_title:
            if len(normalized_title) > 20:  # Avoid short title false positives
                return True

    return False


def scrape_vnexpress_rss(dry_run: bool = False) -> int:
    """
    Scrape VnExpress RSS feeds and store as Reports.

    Args:
        dry_run: If True, only print what would be inserted without saving

    Returns:
        Number of new reports created
    """
    print(f"[{datetime.now()}] Starting VnExpress RSS scraper...")

    db = SessionLocal()
    new_reports_count = 0

    try:
        for feed_url in RSS_FEEDS:
            print(f"\nFetching feed: {feed_url}")

            # Parse RSS feed
            feed = feedparser.parse(feed_url)

            if feed.bozo:
                print(f"  Warning: Feed parse error - {feed.bozo_exception}")

            print(f"  Found {len(feed.entries)} entries")

            for entry in feed.entries:
                try:
                    # Extract basic data
                    title = clean_html(entry.get('title', ''))
                    description = clean_html(entry.get('description', entry.get('summary', '')))
                    link = entry.get('link', '')

                    # Parse published date
                    published = entry.get('published_parsed') or entry.get('updated_parsed')
                    if published:
                        created_at = datetime(*published[:6])
                    else:
                        created_at = datetime.now()

                    # Filter: only disaster-related news
                    if not is_disaster_related(title, description):
                        continue

                    # Check for duplicates
                    if deduplicate_check(db, title, created_at):
                        print(f"  [SKIP] Duplicate: {title[:60]}...")
                        continue

                    # Extract location
                    location_data = extract_location_data(title + " " + description)

                    # Classify report type
                    report_type = classify_report_type(title, description)

                    # Create report
                    report = Report(
                        type=report_type,
                        source=link or "vnexpress.net",
                        title=title[:500],  # Truncate to max length
                        description=description if description else None,
                        province=location_data['province'],
                        lat=location_data['lat'],
                        lon=location_data['lon'],
                        location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                        trust_score=0.9,  # VnExpress base trust score
                        status="new",
                        created_at=created_at
                    )

                    if dry_run:
                        print(f"\n  [DRY RUN] Would create report:")
                        print(f"    Title: {title}")
                        print(f"    Type: {report_type.value}")
                        print(f"    Province: {location_data['province']}")
                        print(f"    Coords: ({location_data['lat']}, {location_data['lon']})")
                        print(f"    URL: {link}")
                    else:
                        db.add(report)
                        db.commit()
                        new_reports_count += 1
                        print(f"  [NEW] {report_type.value}: {title[:60]}... ({location_data['province'] or 'Unknown location'})")

                except Exception as e:
                    print(f"  [ERROR] Failed to process entry: {e}")
                    db.rollback()
                    continue

    except Exception as e:
        print(f"\n[ERROR] Scraper failed: {e}")
        db.rollback()
        raise

    finally:
        db.close()

    print(f"\n[{datetime.now()}] Scraping complete! Created {new_reports_count} new reports.")
    return new_reports_count


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape VnExpress RSS feeds for disaster news")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_vnexpress_rss(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
