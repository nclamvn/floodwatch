#!/usr/bin/env python3
"""
VTC News Scraper

Fetches disaster/weather news from VTC (Vietnam Television Corporation).
Source: VTC News (trust score 0.88 - state media)
"""

import sys
import os
from datetime import datetime
from typing import Optional, List
import feedparser
import re
import requests
from bs4 import BeautifulSoup

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import SessionLocal, Report
from app.database.models import ReportType
from app.services.province_extractor import extract_location_data
from geoalchemy2.shape import from_shape
from shapely.geometry import Point


# VTC RSS feeds for disaster/weather news
RSS_FEEDS = [
    "https://vtcnews.vn/rss/thoi-su.rss",  # Current Affairs
    "https://vtcnews.vn/rss/phap-luat.rss",  # Legal Affairs (often includes disasters)
    "https://vtcnews.vn/rss/phong-chong-chay-no.rss",  # Fire Prevention & Disasters
]

# Keywords for report type classification
TYPE_KEYWORDS = {
    ReportType.ALERT: [
        "cảnh báo", "canh bao", "nguy hiểm", "nguy hiem",
        "đe dọa", "de doa", "khẩn cấp", "khan cap",
        "sơ tán", "so tan", "di dời", "di doi",
        "vỡ đập", "vo dap", "xả lũ", "xa lu",
        "hồ chứa", "ho chua", "thủy điện", "thuy dien"
    ],
    ReportType.RAIN: [
        "mưa", "mua", "lũ", "lu", "lụt", "lut", "ngập", "ngap",
        "úng", "ung", "triều cường", "trieu cuong", "thủy triều", "thuy trieu",
        "bão", "bao", "áp thấp", "ap thap"
    ],
    ReportType.ROAD: [
        "đường", "duong", "giao thông", "giao thong", "quốc lộ", "quoc lo",
        "tắc đường", "tac duong", "sạt lở", "sat lo", "đổ", "do",
        "cầu", "cau", "hầm", "ham", "tê liệt", "te liet"
    ],
    ReportType.SOS: [
        "cứu", "cuu", "cứu hộ", "cuu ho", "cứu trợ", "cuu tro",
        "mất tích", "mat tich", "chết", "chet", "tử vong", "tu vong",
        "nạn nhân", "nan nhan", "thiệt mạng", "thiet mang"
    ],
    ReportType.NEEDS: [
        "thiếu", "thieu", "cần", "can", "hỗ trợ", "ho tro",
        "viện trợ", "vien tro", "lương thực", "luong thuc",
        "thuốc men", "thuoc men", "nhu yếu phẩm", "nhu yeu pham"
    ]
}


def classify_report_type(title: str, description: str = "") -> ReportType:
    """Classify report type based on title and description keywords."""
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

    # Default to RAIN
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


def extract_images_from_entry(entry) -> List[str]:
    """Extract image URLs from RSS entry."""
    images = []

    try:
        # Method 1: Check for media:content tags
        if hasattr(entry, 'media_content'):
            for media in entry.media_content:
                if 'url' in media and media.get('medium') == 'image':
                    images.append(media['url'])

        # Method 2: Check for media:thumbnail
        if hasattr(entry, 'media_thumbnail') and len(images) < 3:
            for thumb in entry.media_thumbnail:
                if 'url' in thumb:
                    images.append(thumb['url'])

        # Method 3: Check for enclosure tags (common in RSS)
        if hasattr(entry, 'enclosures') and len(images) < 3:
            for enclosure in entry.enclosures:
                if enclosure.get('type', '').startswith('image/'):
                    images.append(enclosure['href'])

        # Method 4: Extract from description HTML
        if len(images) < 3:
            description = entry.get('description', '') or entry.get('summary', '')
            if description:
                # Find all img tags
                img_urls = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', description)
                for url in img_urls:
                    if len(images) >= 3:
                        break
                    # Only add if HTTPS and looks like a real image URL
                    if url.startswith('https://') and any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
                        images.append(url)

    except Exception as e:
        pass  # Silently skip image extraction errors

    # Return max 3 images, filter out duplicates
    return list(dict.fromkeys(images))[:3]


def extract_images_from_url(url: str) -> List[str]:
    """Fetch article HTML and extract images."""
    images = []

    try:
        # Fetch the article page
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        if response.status_code != 200:
            return images

        soup = BeautifulSoup(response.content, 'html.parser')

        # VTC uses lazy loading with data-src attribute
        # Find all img tags and look for VTC CDN images
        all_imgs = soup.find_all('img')

        for img in all_imgs:
            img_url = img.get('data-src') or img.get('src')

            if img_url:
                # Ensure HTTPS
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                elif img_url.startswith('/'):
                    img_url = 'https://vtcnews.vn' + img_url

                # Only include images from VTC CDN
                if 'cdn-i.vtcnews.vn' in img_url or 'cdn.vtcnews.vn' in img_url:
                    # Filter valid image extensions
                    if any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        # Skip logos and icons
                        if 'logo' not in img_url.lower() and 'icon' not in img_url.lower():
                            images.append(img_url)

                            if len(images) >= 3:
                                break

    except Exception as e:
        pass  # Silent fail

    return list(dict.fromkeys(images))[:3]


def is_disaster_related(title: str, description: str = "") -> bool:
    """
    Check if article is related to natural disasters/floods/weather ONLY.

    Returns False for unrelated news like traffic accidents, politics, sports, etc.
    """
    text = (title + " " + description).lower()

    # Exclude non-disaster news first
    exclude_keywords = [
        "tai nạn giao thông", "tai nan giao thong",
        "va chạm", "va cham",
        "đâm xe", "dam xe",
        "xe máy", "xe may",
        "ô tô", "o to",
        "xe khách", "xe khach",
        "xe tải", "xe tai",
        "lật xe", "lat xe",
        "chính trị", "chinh tri",
        "bóng đá", "bong da",
        "thể thao", "the thao",
        "giải trí", "giai tri",
        "ca sĩ", "ca si",
        "nghệ sĩ", "nghe si"
    ]

    # Exclude if contains traffic accident keywords (unless also has disaster keywords)
    if any(keyword in text for keyword in exclude_keywords):
        # Allow if it's a traffic accident DUE TO disaster (e.g., landslide on road)
        disaster_caused = any(kw in text for kw in ["sạt lở", "sat lo", "lở đất", "lo dat", "ngập", "ngap", "lũ cuốn", "lu cuon"])
        if not disaster_caused:
            return False

    # Natural disaster/weather keywords ONLY
    disaster_keywords = [
        "mưa", "mua", "lũ", "lu", "lụt", "lut", "ngập", "ngap",
        "bão", "bao", "thiên tai", "thien tai", "sạt lở", "sat lo",
        "lở đất", "lo dat", "động đất", "dong dat", "hạn hán", "han han",
        "cháy rừng", "chay rung", "triều cường", "trieu cuong",
        "thời tiết", "thoi tiet", "dự báo thời tiết", "du bao thoi tiet",
        "áp thấp", "ap thap", "nhiệt đới", "nhiet doi",
        "vỡ đập", "vo dap", "xả lũ", "xa lu", "hồ chứa", "ho chua",
        "đường ngập", "duong ngap", "sơ tán", "so tan", "di dời", "di doi"
    ]

    return any(keyword in text for keyword in disaster_keywords)


def deduplicate_check(db, title: str, created_at: datetime, window_hours: int = 24) -> bool:
    """Check if a similar report already exists."""
    from datetime import timedelta

    time_threshold = created_at - timedelta(hours=window_hours)
    normalized_title = ' '.join(title.lower().split())

    existing = db.query(Report).filter(
        Report.created_at >= time_threshold,
        Report.source.like('%vtc%')
    ).all()

    for report in existing:
        existing_normalized = ' '.join(report.title.lower().split())

        if normalized_title == existing_normalized:
            return True

        if normalized_title in existing_normalized or existing_normalized in normalized_title:
            if len(normalized_title) > 20:
                return True

    return False


def scrape_vtc_rss(dry_run: bool = False) -> int:
    """
    Scrape VTC RSS feeds and store as Reports.

    Args:
        dry_run: If True, only print what would be inserted without saving

    Returns:
        Number of new reports created
    """
    print(f"[{datetime.now()}] Starting VTC News RSS scraper...")

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

                    # Extract images from RSS entry first
                    media_urls = extract_images_from_entry(entry)

                    # If no images from RSS, try scraping the article page
                    if len(media_urls) == 0 and link:
                        media_urls = extract_images_from_url(link)

                    # Truncate source URL if too long
                    source_url = (link[:95] if len(link) > 95 else link) or "vtcnews.vn"

                    # Create report
                    report = Report(
                        type=report_type,
                        source=source_url,
                        title=title[:500],
                        description=description[:1000] if description else None,
                        province=location_data['province'],
                        lat=location_data['lat'],
                        lon=location_data['lon'],
                        location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                        trust_score=0.88,  # VTC base trust score (state media)
                        status="new",
                        created_at=created_at,
                        media=media_urls
                    )

                    if dry_run:
                        print(f"\n  [DRY RUN] Would create report:")
                        print(f"    Title: {title}")
                        print(f"    Type: {report_type.value}")
                        print(f"    Province: {location_data['province']}")
                        print(f"    Coords: ({location_data['lat']}, {location_data['lon']})")
                        print(f"    URL: {source_url}")
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

    parser = argparse.ArgumentParser(description="Scrape VTC News RSS feeds for disaster news")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_vtc_rss(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
