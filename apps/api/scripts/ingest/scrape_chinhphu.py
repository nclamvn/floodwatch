#!/usr/bin/env python3
"""
Chinhphu.vn (Government Portal) Scraper

Scrapes disaster-related news and directives from Vietnam's official government portal.
Source: chinhphu.vn (trust score 0.95 - official government portal)
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


# Chinhphu.vn disaster-related URLs (using correct subdomains)
CHINHPHU_URLS = [
    {
        "url": "https://baochinhphu.vn/",  # Main government news portal
        "name": "Báo Chính phủ",
        "type": "government_news"
    },
    {
        "url": "https://xaydungchinhsach.chinhphu.vn/",  # Policy construction portal
        "name": "Xây dựng chính sách",
        "type": "policy"
    },
]

# Request headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
}


def classify_chinhphu_type(title: str, description: str = "", url_type: str = "") -> ReportType:
    """
    Classify government portal report type.

    Government directives are typically alerts or disaster prevention.
    """
    text = (title + " " + description).lower()

    # Government directives are typically high priority
    if url_type == "directive":
        return ReportType.ALERT

    # SOS keywords (casualties, rescue operations)
    sos_keywords = [
        "cứu hộ", "cuu ho", "cứu trợ", "cuu tro",
        "nạn nhân", "nan nhan", "thiệt hạ", "thiet hai",
        "tử vong", "tu vong", "chết", "chet"
    ]
    if any(keyword in text for keyword in sos_keywords):
        return ReportType.SOS

    # High-priority alerts and directives
    alert_keywords = [
        "cảnh báo", "canh bao", "khẩn cấp", "khan cap",
        "công điện", "cong dien", "chỉ thị", "chi thi",
        "chỉ đạo", "chi dao", "điều động", "dieu dong",
        "sơ tán", "so tan", "di dời", "di doi",
        "vỡ đập", "vo dap", "xả lũ", "xa lu",
        "nguy hiểm", "nguy hiem", "đe dọa", "de doa"
    ]
    if any(keyword in text for keyword in alert_keywords):
        return ReportType.ALERT

    # Infrastructure/road issues
    road_keywords = [
        "đường", "duong", "giao thông", "giao thong",
        "sạt lở", "sat lo", "cầu", "cau", "quốc lộ", "quoc lo"
    ]
    if any(keyword in text for keyword in road_keywords):
        return ReportType.ROAD

    # Aid and support needs
    needs_keywords = [
        "hỗ trợ", "ho tro", "viện trợ", "vien tro",
        "cứu trợ", "cuu tro", "lương thực", "luong thuc",
        "kinh phí", "kinh phi", "ngân sách", "ngan sach"
    ]
    if any(keyword in text for keyword in needs_keywords):
        return ReportType.NEEDS

    # Default to ALERT for government disaster prevention
    return ReportType.ALERT


def extract_articles_from_chinhphu(html: str, base_url: str) -> List[Dict]:
    """Extract articles from Chinhphu.vn HTML page."""
    soup = BeautifulSoup(html, 'lxml')
    articles = []

    # Strategy 1: Look for common CMS patterns
    selectors = [
        'div.news-item',
        'div.item-news',
        'article',
        'div.story',
        'div.article',
        'div.box-news',
        'li.news-item',
        'div.list-item'
    ]

    for selector in selectors:
        items = soup.select(selector)
        if items:
            for item in items:
                try:
                    # Extract title
                    title_elem = item.find(['h2', 'h3', 'h4', 'a'], class_=re.compile(r'title|heading|tit'))
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
                            link = f"https://chinhphu.vn{link}"
                        else:
                            link = f"{base_url}/{link}"

                    # Extract description
                    desc_elem = item.find(['p', 'div'], class_=re.compile(r'desc|summary|excerpt|sapo|lead'))
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

    # Strategy 2: If no articles found, look for main content area
    if not articles:
        main_content = soup.find(['div', 'main', 'section'], class_=re.compile(r'content|main|news|list'))
        if not main_content:
            main_content = soup.find(['div', 'main'], id=re.compile(r'content|main|news'))

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
                        link = f"https://chinhphu.vn{link}"
                    else:
                        link = f"{base_url}/{link}"

                articles.append({
                    'title': title,
                    'link': link,
                    'description': '',
                    'date_str': ''
                })

    return articles


def parse_chinhphu_date(date_str: str) -> datetime:
    """Parse Chinhphu.vn date strings into datetime objects."""
    if not date_str:
        return datetime.now()

    # Clean the string
    date_str = date_str.strip()

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
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    # Try to extract date from Vietnamese format like "Thứ ba, 15/01/2024"
    date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if date_match:
        day, month, year = date_match.groups()
        try:
            return datetime(int(year), int(month), int(day))
        except ValueError:
            pass

    return datetime.now()


def deduplicate_check(db, title: str, window_hours: int = 48) -> bool:
    """Check if similar report exists (government releases less frequently)."""
    from datetime import timedelta

    time_threshold = datetime.now() - timedelta(hours=window_hours)
    normalized_title = ' '.join(title.lower().split())

    existing = db.query(Report).filter(
        Report.created_at >= time_threshold,
        Report.source.like('%chinhphu%')
    ).all()

    for report in existing:
        existing_normalized = ' '.join(report.title.lower().split())

        if normalized_title == existing_normalized:
            return True

        if len(normalized_title) > 30:
            if normalized_title in existing_normalized or existing_normalized in normalized_title:
                return True

    return False


def scrape_chinhphu(dry_run: bool = False) -> int:
    """
    Scrape Chinhphu.vn government portal for disaster-related directives.

    Args:
        dry_run: If True, only print what would be inserted

    Returns:
        Number of new reports created
    """
    print(f"[{datetime.now()}] Starting Chinhphu.vn scraper...")

    db = SessionLocal()
    new_reports_count = 0

    try:
        for site in CHINHPHU_URLS:
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
                articles = extract_articles_from_chinhphu(response.text, url)
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
                        created_at = parse_chinhphu_date(date_str)

                        # Check for duplicates
                        if deduplicate_check(db, title):
                            print(f"  [SKIP] Duplicate: {title[:60]}...")
                            continue

                        # Extract location
                        location_data = extract_location_data(title + " " + description)

                        # Classify type
                        report_type = classify_chinhphu_type(
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

                        # Truncate source URL if too long
                        source_url = link[:95] if len(link) > 95 else link

                        # Create report
                        report = Report(
                            type=report_type,
                            source=source_url,
                            title=title[:500],
                            description=final_description if final_description else None,
                            province=location_data['province'],
                            lat=location_data['lat'],
                            lon=location_data['lon'],
                            location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                            trust_score=0.95,  # High trust for official government portal
                            status="new",
                            created_at=created_at
                        )

                        if dry_run:
                            print(f"\n  [DRY RUN] Would create report:")
                            print(f"    Title: {title}")
                            print(f"    Type: {report_type.value}")
                            print(f"    Province: {location_data['province']}")
                            print(f"    Date: {created_at}")
                            print(f"    URL: {source_url}")
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

    parser = argparse.ArgumentParser(description="Scrape Chinhphu.vn government portal for disaster directives")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_chinhphu(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
