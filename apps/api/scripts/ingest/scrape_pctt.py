#!/usr/bin/env python3
"""
PCTT (Ban Chỉ đạo Quốc gia về Phòng chống thiên tai) Scraper

Scrapes disaster prevention and control directives from PCTT official website.
Source: phongchongthientai.mard.gov.vn (trust score 0.97 - high government authority)
"""

import sys
import os
from datetime import datetime
from typing import Optional, List, Dict
import requests
from bs4 import BeautifulSoup
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import SessionLocal, Report
from app.database.models import ReportType
from app.services.province_extractor import extract_location_data
from app.services.article_extractor import extract_article_hybrid
from geoalchemy2.shape import from_shape
from shapely.geometry import Point


# PCTT URLs to scrape
PCTT_URLS = [
    {
        "url": "https://phongchongthientai.mard.gov.vn/",
        "name": "Trang chủ PCTT",
        "type": "main"
    },
    {
        "url": "https://phongchongthientai.mard.gov.vn/category/tin-hoat-dong",
        "name": "Tin hoạt động",
        "type": "news"
    },
    {
        "url": "https://phongchongthientai.mard.gov.vn/category/canh-bao-thien-tai",
        "name": "Cảnh báo thiên tai",
        "type": "warning"
    }
]

# Request headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
}


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


def classify_pctt_type(title: str, description: str = "", url_type: str = "") -> ReportType:
    """
    Classify PCTT report type.

    PCTT is disaster-focused, so most will be ALERT/RAIN.
    """
    text = (title + " " + description).lower()

    # Check URL type
    if url_type == "warning":
        return ReportType.ALERT

    # High-priority alerts
    alert_keywords = [
        "cảnh báo", "canh bao", "khẩn cấp", "khan cap",
        "chỉ thị", "chi thi", "công điện", "cong dien",
        "sơ tán", "so tan", "di dời", "di doi"
    ]

    if any(keyword in text for keyword in alert_keywords):
        return ReportType.ALERT

    # SOS keywords
    if "cứu hộ" in text or "cứu trợ" in text or "nạn nhân" in text:
        return ReportType.SOS

    # Road-related
    if "đường" in text or "giao thông" in text or "sạt lở" in text:
        return ReportType.ROAD

    # Default to RAIN for disaster prevention site
    return ReportType.RAIN


def extract_articles_from_html(html: str, base_url: str) -> List[Dict]:
    """Extract articles from PCTT HTML page."""
    soup = BeautifulSoup(html, 'lxml')
    articles = []

    # Strategy 1: Look for WordPress/common CMS patterns
    selectors = [
        'article',
        'div.post',
        'div.entry',
        'div.item-news',
        'div.news-item',
        'div.article-item',
        'li.post',
        'div.content-item',
        'div.news-list-item'
    ]

    for selector in selectors:
        items = soup.select(selector)
        if items:
            for item in items:
                try:
                    # Extract title
                    title_elem = item.find(['h2', 'h3', 'h4', 'a'], class_=re.compile(r'title|heading|entry-title'))
                    if not title_elem:
                        title_elem = item.find('a')

                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)

                    # Extract link
                    link_elem = item.find('a', href=True)
                    link = link_elem['href'] if link_elem else ""

                    # Make absolute URL
                    if link and not link.startswith('http'):
                        if link.startswith('/'):
                            link = f"https://phongchongthientai.mard.gov.vn{link}"
                        else:
                            link = f"{base_url}/{link}"

                    # Extract description
                    desc_elem = item.find(['p', 'div'], class_=re.compile(r'desc|summary|excerpt|sapo'))
                    description = desc_elem.get_text(strip=True) if desc_elem else ""

                    # Extract date
                    date_elem = item.find(['time', 'span', 'div'], class_=re.compile(r'date|time|published'))
                    date_str = date_elem.get_text(strip=True) if date_elem else ""

                    articles.append({
                        'title': title,
                        'link': link,
                        'description': description,
                        'date_str': date_str
                    })

                except Exception as e:
                    continue

    # Strategy 2: If no articles found, look for main content links
    if not articles:
        main_content = soup.find(['div', 'main', 'section'], id=re.compile(r'content|main|news|posts'))
        if main_content:
            links = main_content.find_all('a', href=True)

            for link_elem in links:
                title = link_elem.get_text(strip=True)

                # Filter out navigation/menu links
                if len(title) < 20:
                    continue

                if any(skip in title.lower() for skip in ['trang chủ', 'liên hệ', 'giới thiệu', 'menu', 'đăng nhập']):
                    continue

                link = link_elem['href']
                if not link.startswith('http'):
                    if link.startswith('/'):
                        link = f"https://phongchongthientai.mard.gov.vn{link}"
                    else:
                        link = f"{base_url}/{link}"

                articles.append({
                    'title': title,
                    'link': link,
                    'description': '',
                    'date_str': ''
                })

    return articles


def parse_pctt_date(date_str: str) -> datetime:
    """Parse PCTT date strings into datetime objects."""
    if not date_str:
        return datetime.now()

    # Try common Vietnamese date formats
    formats = [
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%d-%m-%Y %H:%M",
        "%d-%m-%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue

    return datetime.now()


def deduplicate_check(db, title: str, window_hours: int = 48) -> bool:
    """Check if similar report exists (PCTT often republishes directives)."""
    from datetime import timedelta

    time_threshold = datetime.now() - timedelta(hours=window_hours)
    normalized_title = ' '.join(title.lower().split())

    existing = db.query(Report).filter(
        Report.created_at >= time_threshold,
        Report.source.like('%phongchongthientai%')
    ).all()

    for report in existing:
        existing_normalized = ' '.join(report.title.lower().split())

        if normalized_title == existing_normalized:
            return True

        if len(normalized_title) > 30:
            if normalized_title in existing_normalized or existing_normalized in normalized_title:
                return True

    return False


def scrape_pctt(dry_run: bool = False) -> int:
    """
    Scrape PCTT website for disaster prevention directives.

    Args:
        dry_run: If True, only print what would be inserted

    Returns:
        Number of new reports created
    """
    print(f"[{datetime.now()}] Starting PCTT scraper...")

    db = SessionLocal()
    new_reports_count = 0

    try:
        for site in PCTT_URLS:
            url = site['url']
            name = site['name']

            print(f"\nScraping: {name}")
            print(f"  URL: {url}")

            try:
                # Fetch page
                response = requests.get(url, headers=HEADERS, timeout=30)
                response.raise_for_status()
                response.encoding = 'utf-8'

                # Extract articles
                articles = extract_articles_from_html(response.text, url)
                print(f"  Found {len(articles)} potential articles")

                for article in articles:
                    try:
                        title = article['title']
                        link = article['link'] or url
                        description = article['description']
                        date_str = article['date_str']

                        # Skip if title too short
                        if len(title) < 20:
                            continue

                        # Parse date
                        created_at = parse_pctt_date(date_str)

                        # Check for duplicates
                        if deduplicate_check(db, title):
                            print(f"  [SKIP] Duplicate: {title[:60]}...")
                            continue

                        # Filter: only disaster-related news
                        if not is_disaster_related(title, description):
                            continue

                        # Extract location
                        location_data = extract_location_data(title + " " + description)

                        # Classify type
                        report_type = classify_pctt_type(
                            title,
                            description,
                            site.get('type', '')
                        )

                        # Try to extract full article content
                        summary = description  # Keep listing summary as fallback
                        final_description = summary
                        if link:
                            try:
                                article_result = extract_article_hybrid(link, language='vi')
                                if article_result['success'] and len(article_result['full_text']) > 300:
                                    final_description = article_result['full_text']
                                    print(f"  ✓ Full article extracted: {len(final_description)} chars from {link[:50]}...")
                                else:
                                    print(f"  ✗ Using listing summary fallback ({len(summary)} chars)")
                            except Exception as e:
                                print(f"  ✗ Article extraction failed: {str(e)}, using summary")
                                final_description = summary

                        # Create report
                        report = Report(
                            type=report_type,
                            source=link,
                            title=title[:500],
                            description=final_description if final_description else None,
                            province=location_data['province'],
                            lat=location_data['lat'],
                            lon=location_data['lon'],
                            location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                            trust_score=0.97,  # PCTT high trust (government directive)
                            status="new",
                            created_at=created_at
                        )

                        if dry_run:
                            print(f"\n  [DRY RUN] Would create report:")
                            print(f"    Title: {title}")
                            print(f"    Type: {report_type.value}")
                            print(f"    Province: {location_data['province']}")
                            print(f"    Date: {created_at}")
                            print(f"    URL: {link}")
                        else:
                            db.add(report)
                            db.commit()
                            new_reports_count += 1
                            print(f"  [NEW] {report_type.value}: {title[:60]}... ({location_data['province'] or 'Unknown'})")

                    except Exception as e:
                        print(f"  [ERROR] Failed to process article: {e}")
                        db.rollback()
                        continue

            except requests.RequestException as e:
                print(f"  [ERROR] Failed to fetch {url}: {e}")
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

    parser = argparse.ArgumentParser(description="Scrape PCTT disaster prevention directives")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_pctt(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
