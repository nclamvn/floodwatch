#!/usr/bin/env python3
"""
Thanh Niên RSS Scraper

Fetches disaster/weather news from Thanh Niên RSS feeds and stores as Reports.
Source: Thanh Niên (trust score 0.90)
Special focus: Dam/reservoir failures and flood releases
"""

import sys
import os
from datetime import datetime
from typing import Optional, List
import feedparser
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import SessionLocal, Report
from app.database.models import ReportType
from app.services.province_extractor import extract_location_data
from app.services.article_extractor import extract_article_hybrid
from geoalchemy2.shape import from_shape
from shapely.geometry import Point


# Thanh Niên RSS feeds
RSS_FEEDS = [
    "https://thanhnien.vn/rss/thoi-su.rss",  # News
    "https://thanhnien.vn/rss/xa-hoi.rss",    # Society
]

# Enhanced keywords for Thanh Niên (emphasis on dam/reservoir)
TYPE_KEYWORDS = {
    ReportType.ALERT: [
        "cảnh báo", "canh bao", "nguy hiểm", "nguy hiem",
        "đe dọa", "de doa", "khẩn cấp", "khan cap",
        "sơ tán", "so tan", "di dời", "di doi",
        "vỡ đập", "vo dap", "xả lũ", "xa lu",  # Dam-specific
        "hồ chứa", "ho chua", "thủy điện", "thuy dien"
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
    """Classify report type with priority for dam/reservoir issues."""
    text = (title + " " + description).lower()

    # SOS has highest priority
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.SOS]):
        return ReportType.SOS

    # ALERT (including dam/reservoir)
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.ALERT]):
        return ReportType.ALERT

    # ROAD
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.ROAD]):
        return ReportType.ROAD

    # NEEDS
    if any(keyword in text for keyword in TYPE_KEYWORDS[ReportType.NEEDS]):
        return ReportType.NEEDS

    # Default to RAIN
    return ReportType.RAIN


def clean_html(html_text: str) -> str:
    """Remove HTML tags from text."""
    if not html_text:
        return ""

    text = re.sub(r'<[^>]+>', '', html_text)
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&quot;', '"')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = ' '.join(text.split())

    return text


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
    """Check if a similar report already exists."""
    from datetime import timedelta

    time_threshold = created_at - timedelta(hours=window_hours)
    normalized_title = ' '.join(title.lower().split())

    existing = db.query(Report).filter(
        Report.created_at >= time_threshold,
        Report.source.like('%thanhnien%')
    ).all()

    for report in existing:
        existing_normalized = ' '.join(report.title.lower().split())

        if normalized_title == existing_normalized:
            return True

        if normalized_title in existing_normalized or existing_normalized in normalized_title:
            if len(normalized_title) > 20:
                return True

    return False


def scrape_thanhnien_rss(dry_run: bool = False) -> int:
    """
    Scrape Thanh Niên RSS feeds and store as Reports.

    Args:
        dry_run: If True, only print what would be inserted without saving

    Returns:
        Number of new reports created
    """
    print(f"[{datetime.now()}] Starting Thanh Niên RSS scraper...")

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
                    link = entry.get('link', '')

                    # Get RSS summary as fallback
                    summary = clean_html(entry.get('description', entry.get('summary', '')))

                    # Try to extract full article content
                    description = summary  # Default to summary
                    if link:
                        try:
                            article_result = extract_article_hybrid(link, language='vi')
                            if article_result['success'] and len(article_result['full_text']) > 300:
                                description = article_result['full_text']
                                print(f"  ✓ Full article extracted: {len(description)} chars from {link[:50]}...")
                            else:
                                print(f"  ✗ Using RSS summary fallback ({len(summary)} chars)")
                        except Exception as e:
                            print(f"  ✗ Article extraction failed: {str(e)}, using summary")
                            description = summary

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
                        source=link or "thanhnien.vn",
                        title=title[:500],
                        description=description if description else None,
                        province=location_data['province'],
                        lat=location_data['lat'],
                        lon=location_data['lon'],
                        location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                        trust_score=0.90,  # Thanh Niên base trust score
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

    parser = argparse.ArgumentParser(description="Scrape Thanh Niên RSS feeds for disaster news")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_thanhnien_rss(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
