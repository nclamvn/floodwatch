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
import requests
from bs4 import BeautifulSoup

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import SessionLocal, Report
from app.database.models import ReportType
from app.services.province_extractor import extract_location_data
from app.services.article_extractor import extract_article
from app.services.news_dedup import NewsDedupService
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

        # VnExpress specific: images in article content
        article_content = soup.find('article') or soup.find('div', class_='fck_detail')

        if article_content:
            # Find all img tags in article
            img_tags = article_content.find_all('img', limit=5)

            for img in img_tags:
                img_url = img.get('data-src') or img.get('src')

                if img_url:
                    # Ensure HTTPS
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    elif img_url.startswith('/'):
                        img_url = 'https://vnexpress.net' + img_url

                    # Filter valid images
                    if img_url.startswith('https://') and any(ext in img_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        # Skip small icons/logos
                        if 'logo' not in img_url.lower() and 'icon' not in img_url.lower():
                            images.append(img_url)

                            if len(images) >= 3:
                                break

    except Exception as e:
        pass  # Silent fail

    return list(dict.fromkeys(images))[:3]


def is_disaster_related(title: str, description: str = "") -> bool:
    """
    Strictly check if article is about ACTIVE natural disasters/floods/weather.
    Excludes political news, fraud cases, opinion pieces, appointments.
    """
    title_lower = title.lower()
    text = (title + " " + description).lower()

    # EXCLUDE non-disaster news first (higher priority)
    exclude_keywords = [
        # Political/administrative
        "làm chủ tịch", "lam chu tich", "giữ chức", "giu chuc",
        "bổ nhiệm", "bo nhiem", "phó bí thư", "pho bi thu",
        "hội nghị", "hoi nghi", "họp bàn", "hop ban",
        "khen thưởng", "khen thuong", "trao tặng", "trao tang",

        # Crime/legal (unless disaster-related)
        "bắt giám đốc", "bat giam doc", "khởi tố", "khoi to",
        "lừa đảo", "lua dao", "truy tố", "truy to",
        "phán", "phan", "âm binh", "am binh",

        # Infrastructure/development
        "phát triển bệnh viện", "phat trien benh vien",
        "biểu trưng mới", "bieu trung moi",
        "chuyển đổi động cơ", "chuyen doi dong co",

        # Opinion/lifestyle
        "nhiều hay ít", "nhieu hay it",
        "xu hướng", "xu huong", "vì sao", "vi sao",
        "tại sao", "tai sao",

        # Traffic accidents (unless disaster-caused)
        "tai nạn giao thông", "tai nan giao thong",
        "va chạm", "va cham", "đâm xe", "dam xe",
        "lật xe", "lat xe",

        # Other
        "tiền lẻ", "tien le",
        "công chức", "cong chuc", "viên chức", "vien chuc",
        "chế biến mỡ", "che bien mo",
        "chính trị", "chinh tri", "bóng đá", "bong da",
        "thể thao", "the thao", "giải trí", "giai tri"
    ]

    # If title contains exclude keywords, reject immediately
    if any(keyword in title_lower for keyword in exclude_keywords):
        # Exception: if it's clearly disaster consequence, allow it
        disaster_consequence_keywords = [
            "mưa lũ", "mua lu", "bão lũ", "bao lu", "thiệt hại do", "thiet hai do",
            "sau bão", "sau bao", "sau lũ", "sau lu", "hậu quả", "hau qua",
            "khắc phục", "khac phuc", "tái thiết", "tai thiet"
        ]
        if not any(kw in text for kw in disaster_consequence_keywords):
            return False

    # Core disaster keywords (must be in title OR prominent in description)
    core_disaster_keywords = [
        "mưa lũ", "mua lu", "lũ lụt", "lu lut", "ngập lụt", "ngap lut",
        "bão", "bao", "thiên tai", "thien tai",
        "sạt lở", "sat lo", "lở đất", "lo dat",
        "động đất", "dong dat", "hạn hán", "han han",
        "cháy rừng", "chay rung", "triều cường", "trieu cuong",
        "xả lũ", "xa lu", "vỡ đập", "vo dap",
        "ngập sâu", "ngap sau", "ngập nặng", "ngap nang",
        "cô lập", "co lap", "mắc kẹt", "mac ket",
        "thiệt mạng", "thiet mang", "tử vong do", "tu vong do",
        "chết đói", "chet doi", "chết lụt", "chet lut",
        "mất tích do", "mat tich do"
    ]

    # Must have core disaster keyword in title
    has_disaster_in_title = any(keyword in title_lower for keyword in core_disaster_keywords)

    # Or title mentions disaster response/rescue
    disaster_response_keywords = [
        "cứu hộ", "cuu ho", "cứu trợ", "cuu tro", "cứu nạn", "cuu nan",
        "sơ tán", "so tan", "di dời khẩn", "di doi khan",
        "hỗ trợ khẩn", "ho tro khan", "ứng phó", "ung pho",
        "cảnh báo lũ", "canh bao lu", "cảnh báo bão", "canh bao bao"
    ]
    has_response_in_title = any(keyword in title_lower for keyword in disaster_response_keywords)

    # Accept if has disaster keyword OR disaster response in title
    return has_disaster_in_title or has_response_in_title


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
                    rss_description = clean_html(entry.get('description', entry.get('summary', '')))
                    link = entry.get('link', '')

                    # Try to extract full article content using 5-tier absolute extraction
                    description = rss_description  # Default to RSS description
                    if link:
                        try:
                            article_result = extract_article(link, language='vi', min_length=500)
                            if article_result.get('success') and len(article_result.get('full_text', '')) >= 500:
                                description = article_result['full_text']
                                tier_used = article_result.get('tier_used', 'unknown')
                                print(f"  ✓ Full article ({tier_used}): {len(description)} chars")
                            elif article_result.get('full_text') and len(article_result.get('full_text', '')) > len(rss_description):
                                description = article_result['full_text']
                                print(f"  ~ Partial: {len(description)} chars")
                            else:
                                print(f"  ✗ Using RSS summary ({len(rss_description)} chars)")
                        except Exception as e:
                            print(f"  ✗ Extraction failed: {str(e)[:50]}")

                    # Parse published date
                    published = entry.get('published_parsed') or entry.get('updated_parsed')
                    if published:
                        created_at = datetime(*published[:6])
                    else:
                        created_at = datetime.now()

                    # Filter: only disaster-related news
                    if not is_disaster_related(title, description):
                        continue

                    # Check for cross-source duplicates (Layer 1)
                    duplicate = NewsDedupService.find_duplicate(db, title, description, created_at)
                    if duplicate:
                        dup_id, similarity, match_type = duplicate
                        print(f"  [SKIP] Duplicate ({match_type}, {similarity:.0%}): {title[:50]}...")
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

                    # Prepare deduplication fields
                    dedup_fields = NewsDedupService.prepare_report_dedup_fields(
                        title, description, link or "vnexpress.net"
                    )

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
                        created_at=created_at,
                        media=media_urls,
                        # Deduplication fields
                        normalized_title=dedup_fields['normalized_title'],
                        content_hash=dedup_fields['content_hash'],
                        source_domain=dedup_fields['source_domain']
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
