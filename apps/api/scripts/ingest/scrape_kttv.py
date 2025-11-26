#!/usr/bin/env python3
"""
KTTV (Tổng cục Khí tượng Thủy văn) Scraper

Scrapes weather alerts and forecasts from the National Weather Service website.
Source: kttv.gov.vn (trust score 0.98 - highest government source)
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
from app.services.news_dedup import NewsDedupService
from geoalchemy2.shape import from_shape
from shapely.geometry import Point


# KTTV URLs to scrape
KTTV_URLS = [
    {
        "url": "https://nchmf.gov.vn/KttvsiteE/vi-VN/1/index.html",
        "name": "Trang chủ KTTV",
        "sections": ["canh-bao", "du-bao"]  # Warning, Forecast sections
    },
    {
        "url": "https://nchmf.gov.vn/KttvsiteE/vi-VN/3/tin-canh-bao.html",
        "name": "Tin cảnh báo",
        "type": "warning"
    },
    {
        "url": "https://nchmf.gov.vn/KttvsiteE/vi-VN/2/tin-du-bao.html",
        "name": "Tin dự báo",
        "type": "forecast"
    }
]

# Request headers to mimic browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
}


def classify_kttv_type(title: str, description: str = "", url_type: str = "") -> ReportType:
    """
    Classify KTTV report type.

    KTTV is weather-focused, so most will be RAIN/ALERT.
    """
    text = (title + " " + description).lower()

    # Check for high-priority alerts
    alert_keywords = [
        "cảnh báo", "canh bao", "khẩn cấp", "khan cap",
        "nguy hiểm", "nguy hiem", "bão", "bao", "lũ quét", "lu quet"
    ]

    if any(keyword in text for keyword in alert_keywords):
        return ReportType.ALERT

    # Check for road-related
    if "đường" in text or "giao thông" in text or "sạt lở" in text:
        return ReportType.ROAD

    # Default to RAIN for weather service
    return ReportType.RAIN


def extract_articles_from_html(html: str, base_url: str) -> List[Dict]:
    """
    Extract articles from KTTV HTML page.

    KTTV website structure may vary, so this uses multiple strategies.
    """
    soup = BeautifulSoup(html, 'lxml')
    articles = []

    # Strategy 1: Look for news items in common container classes
    selectors = [
        'div.news-item',
        'div.item-news',
        'div.article',
        'article',
        'div.post',
        'div.content-item',
        'li.news',
        'div.canh-bao-item',
        'div.du-bao-item'
    ]

    for selector in selectors:
        items = soup.select(selector)
        if items:
            for item in items:
                try:
                    # Extract title
                    title_elem = item.find(['h2', 'h3', 'h4', 'a', 'div'], class_=re.compile(r'title|heading|tieu-de'))
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
                            link = f"https://nchmf.gov.vn{link}"
                        else:
                            link = f"{base_url}/{link}"

                    # Extract description/summary
                    desc_elem = item.find(['p', 'div'], class_=re.compile(r'desc|summary|tom-tat|sapo'))
                    description = desc_elem.get_text(strip=True) if desc_elem else ""

                    # Extract date
                    date_elem = item.find(['time', 'span', 'div'], class_=re.compile(r'date|time|ngay'))
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
        main_content = soup.find(['div', 'main'], id=re.compile(r'content|main|news'))
        if main_content:
            links = main_content.find_all('a', href=True)

            for link_elem in links:
                title = link_elem.get_text(strip=True)

                # Filter out navigation/menu links (too short or too common)
                if len(title) < 20:
                    continue

                if any(skip in title.lower() for skip in ['trang chủ', 'liên hệ', 'giới thiệu', 'menu']):
                    continue

                link = link_elem['href']
                if not link.startswith('http'):
                    if link.startswith('/'):
                        link = f"https://nchmf.gov.vn{link}"
                    else:
                        link = f"{base_url}/{link}"

                articles.append({
                    'title': title,
                    'link': link,
                    'description': '',
                    'date_str': ''
                })

    return articles


def parse_kttv_date(date_str: str) -> datetime:
    """
    Parse KTTV date strings into datetime objects.

    Common formats:
    - "20/11/2024 15:30"
    - "20-11-2024"
    - "20/11/2024"
    """
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

    # If no format matches, return current time
    return datetime.now()


def deduplicate_check(db, title: str, window_hours: int = 48) -> bool:
    """
    Check if similar report exists (KTTV often republishes alerts).
    """
    from datetime import timedelta

    time_threshold = datetime.now() - timedelta(hours=window_hours)
    normalized_title = ' '.join(title.lower().split())

    existing = db.query(Report).filter(
        Report.created_at >= time_threshold,
        Report.source.like('%kttv%')
    ).all()

    for report in existing:
        existing_normalized = ' '.join(report.title.lower().split())

        if normalized_title == existing_normalized:
            return True

        # Substring match for long titles
        if len(normalized_title) > 30:
            if normalized_title in existing_normalized or existing_normalized in normalized_title:
                return True

    return False


def scrape_kttv(dry_run: bool = False) -> int:
    """
    Scrape KTTV website for weather alerts and forecasts.

    Args:
        dry_run: If True, only print what would be inserted

    Returns:
        Number of new reports created
    """
    print(f"[{datetime.now()}] Starting KTTV scraper...")

    db = SessionLocal()
    new_reports_count = 0

    try:
        for site in KTTV_URLS:
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

                        # Skip if title too short (likely navigation link)
                        if len(title) < 20:
                            continue

                        # Parse date
                        created_at = parse_kttv_date(date_str)

                        # Check for cross-source duplicates (Layer 1)
                        duplicate = NewsDedupService.find_duplicate(db, title, description, created_at)
                        if duplicate:
                            dup_id, similarity, match_type = duplicate
                            print(f"  [SKIP] Duplicate ({match_type}, {similarity:.0%}): {title[:50]}...")
                            continue

                        # Extract location
                        location_data = extract_location_data(title + " " + description)

                        # Classify type
                        report_type = classify_kttv_type(
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

                        # Prepare deduplication fields
                        dedup_fields = NewsDedupService.prepare_report_dedup_fields(
                            title, final_description, link or "nchmf.gov.vn"
                        )

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
                            trust_score=0.98,  # KTTV highest trust
                            status="new",
                            created_at=created_at,
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

    parser = argparse.ArgumentParser(description="Scrape KTTV weather alerts")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_kttv(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
