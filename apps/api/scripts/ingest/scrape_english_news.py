#!/usr/bin/env python3
"""
English News Scrapers for Vietnam Disaster Coverage

Aggregates news from multiple English-language sources covering Vietnam:
- VnExpress International (vnexpress.net/news)
- Vietnam News (vietnamnews.vn)
- Tuoi Tre News (tuoitrenews.vn)
- ReliefWeb (reliefweb.int - UN disaster reports)
- FloodList (floodlist.com - Global flood news)

Source: Multiple (trust score varies by source)
"""

import sys
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
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


# English RSS feeds covering Vietnam disasters
ENGLISH_FEEDS = {
    # VnExpress International - main news RSS
    "vnexpress_en": {
        "url": "https://e.vnexpress.net/rss/news.rss",
        "trust_score": 0.9,
        "name": "VnExpress International"
    },
    # Vietnam News (official English news agency) - needs special encoding handling
    "vietnam_news": {
        "url": "https://vietnamnews.vn/rss/society.rss",
        "trust_score": 0.85,
        "name": "Vietnam News",
        "encoding": "utf-16"  # Vietnam News uses UTF-16
    },
    # VnExpress International - environment section (more disaster news)
    "vnexpress_en_env": {
        "url": "https://e.vnexpress.net/rss/environment.rss",
        "trust_score": 0.9,
        "name": "VnExpress International (Environment)"
    },
}

# Additional web scraping sources (no RSS)
WEB_SOURCES = {
    "thanhnien_en": {
        "url": "https://thanhniennews.com/society/",
        "trust_score": 0.85,
        "name": "Thanh Nien News"
    }
}

# English keywords for report type classification
TYPE_KEYWORDS_EN = {
    ReportType.ALERT: [
        "warning", "alert", "danger", "hazard", "emergency",
        "evacuation", "evacuate", "threat", "imminent"
    ],
    ReportType.RAIN: [
        "flood", "flooding", "rain", "rainfall", "storm", "typhoon",
        "monsoon", "inundation", "water level", "submerged",
        "high tide", "tidal surge", "dam", "reservoir"
    ],
    ReportType.ROAD: [
        "road", "highway", "bridge", "route", "traffic",
        "landslide", "mudslide", "collapse", "blocked",
        "disruption", "cut off", "impassable"
    ],
    ReportType.SOS: [
        "rescue", "missing", "death", "dead", "killed",
        "victim", "casualty", "fatality", "trapped",
        "stranded", "search and rescue"
    ],
    ReportType.NEEDS: [
        "relief", "aid", "supplies", "donation", "support",
        "assistance", "food", "water", "shelter", "medical"
    ]
}

# Vietnam location keywords (to filter relevant news)
VIETNAM_KEYWORDS = [
    "vietnam", "viet nam", "vietnamese",
    # Major cities
    "hanoi", "ha noi", "ho chi minh", "saigon", "hcmc",
    "da nang", "danang", "hue", "can tho", "hai phong",
    # Central provinces (flood-prone)
    "quang binh", "quang tri", "thua thien", "quang nam",
    "quang ngai", "binh dinh", "phu yen", "khanh hoa",
    "ninh thuan", "binh thuan",
    # Mekong Delta
    "mekong", "an giang", "dong thap", "ben tre", "vinh long",
    "tra vinh", "soc trang", "bac lieu", "ca mau",
    # Northern regions
    "yen bai", "lao cai", "ha giang", "cao bang", "lang son",
    "son la", "lai chau", "dien bien",
    # Central Highlands
    "dak lak", "dak nong", "gia lai", "kon tum", "lam dong"
]


def classify_report_type_en(title: str, description: str = "") -> ReportType:
    """Classify report type based on English keywords."""
    text = (title + " " + description).lower()

    # SOS has highest priority
    if any(keyword in text for keyword in TYPE_KEYWORDS_EN[ReportType.SOS]):
        return ReportType.SOS

    # Then ALERT
    if any(keyword in text for keyword in TYPE_KEYWORDS_EN[ReportType.ALERT]):
        return ReportType.ALERT

    # Then ROAD
    if any(keyword in text for keyword in TYPE_KEYWORDS_EN[ReportType.ROAD]):
        return ReportType.ROAD

    # Then NEEDS
    if any(keyword in text for keyword in TYPE_KEYWORDS_EN[ReportType.NEEDS]):
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


def extract_images_from_entry(entry) -> List[str]:
    """Extract image URLs from RSS entry."""
    images = []

    try:
        # Check media:content
        if hasattr(entry, 'media_content'):
            for media in entry.media_content:
                if 'url' in media and media.get('medium') == 'image':
                    images.append(media['url'])

        # Check media:thumbnail
        if hasattr(entry, 'media_thumbnail') and len(images) < 3:
            for thumb in entry.media_thumbnail:
                if 'url' in thumb:
                    images.append(thumb['url'])

        # Check enclosures
        if hasattr(entry, 'enclosures') and len(images) < 3:
            for enclosure in entry.enclosures:
                if enclosure.get('type', '').startswith('image/'):
                    images.append(enclosure['href'])

        # Extract from description HTML
        if len(images) < 3:
            description = entry.get('description', '') or entry.get('summary', '')
            if description:
                img_urls = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', description)
                for url in img_urls:
                    if len(images) >= 3:
                        break
                    if url.startswith('https://') and any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
                        images.append(url)

    except Exception:
        pass

    return list(dict.fromkeys(images))[:3]


def is_vietnam_disaster_related(title: str, description: str = "") -> bool:
    """
    Check if article is about natural disasters in Vietnam.
    Must mention Vietnam AND disaster-related content.
    """
    text = (title + " " + description).lower()

    # Must mention Vietnam or Vietnamese location
    has_vietnam = any(keyword in text for keyword in VIETNAM_KEYWORDS)
    if not has_vietnam:
        return False

    # Must have disaster keywords
    disaster_keywords = [
        "flood", "flooding", "storm", "typhoon", "rain", "rainfall",
        "landslide", "mudslide", "disaster", "emergency", "evacuate",
        "evacuation", "rescue", "death", "killed", "missing", "damage",
        "destruction", "submerged", "inundation", "warning", "alert",
        "relief", "aid", "casualty", "victim", "stranded", "trapped"
    ]

    has_disaster = any(keyword in text for keyword in disaster_keywords)

    # Exclude non-disaster news
    exclude_keywords = [
        "tourist", "tourism", "hotel", "restaurant", "investment",
        "business", "stock", "market", "election", "politics",
        "football", "soccer", "entertainment", "celebrity", "fashion"
    ]

    has_exclude = any(keyword in text for keyword in exclude_keywords)

    # Exception: if it's disaster + excluded topic, still include
    if has_exclude and not has_disaster:
        return False

    return has_disaster


def scrape_rss_feed(feed_key: str, feed_config: Dict, dry_run: bool = False) -> int:
    """Scrape a single RSS feed."""
    print(f"\n  Fetching: {feed_config['name']} ({feed_config['url'][:50]}...)")

    new_count = 0

    try:
        # Handle special encoding (e.g., Vietnam News uses UTF-16)
        if feed_config.get('encoding'):
            try:
                response = requests.get(feed_config['url'], timeout=15, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                content = response.content.decode(feed_config['encoding'])
                feed = feedparser.parse(content)
            except Exception as e:
                print(f"    Warning: Encoding error - {e}")
                feed = feedparser.parse(feed_config['url'])
        else:
            feed = feedparser.parse(feed_config['url'])

        if feed.bozo and not feed.entries:
            print(f"    Warning: Feed parse error - {feed.bozo_exception}")
            return 0

        print(f"    Found {len(feed.entries)} entries")

        for entry in feed.entries:
            try:
                title = clean_html(entry.get('title', ''))
                rss_description = clean_html(entry.get('description', entry.get('summary', '')))
                link = entry.get('link', '')

                # Filter: must be Vietnam disaster-related
                if not is_vietnam_disaster_related(title, rss_description):
                    continue

                # Try to extract full article
                description = rss_description
                if link:
                    try:
                        article_result = extract_article(link, language='en', min_length=300)
                        if article_result.get('success') and len(article_result.get('full_text', '')) >= 300:
                            description = article_result['full_text']
                    except Exception:
                        pass

                # Parse date
                published = entry.get('published_parsed') or entry.get('updated_parsed')
                if published:
                    created_at = datetime(*published[:6])
                else:
                    created_at = datetime.now()

                # Skip old news (> 7 days)
                if (datetime.now() - created_at).days > 7:
                    continue

                # Use fresh session for each article to avoid connection pool issues
                db = SessionLocal()
                try:
                    # Check for duplicates
                    duplicate = NewsDedupService.find_duplicate(db, title, description, created_at)
                    if duplicate:
                        db.close()
                        continue

                    # Extract location
                    location_data = extract_location_data(title + " " + description)

                    # Classify type
                    report_type = classify_report_type_en(title, description)

                    # Extract images
                    media_urls = extract_images_from_entry(entry)

                    # Prepare dedup fields
                    dedup_fields = NewsDedupService.prepare_report_dedup_fields(
                        title, description, link or feed_config['name']
                    )

                    # Create report with language marker
                    report = Report(
                        type=report_type,
                        source=link or feed_config['url'],
                        title=title[:500],
                        description=description if description else None,
                        province=location_data['province'],
                        lat=location_data['lat'],
                        lon=location_data['lon'],
                        location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                        trust_score=feed_config['trust_score'],
                        status="new",
                        created_at=created_at,
                        media=media_urls,
                        normalized_title=dedup_fields['normalized_title'],
                        content_hash=dedup_fields['content_hash'],
                        source_domain=dedup_fields['source_domain']
                    )

                    if dry_run:
                        print(f"    [DRY RUN] {report_type.value}: {title[:60]}...")
                    else:
                        db.add(report)
                        db.commit()
                        new_count += 1
                        print(f"    [NEW] {report_type.value}: {title[:60]}...")

                finally:
                    db.close()

            except Exception as e:
                print(f"    [ERROR] {str(e)[:50]}")
                continue

    except Exception as e:
        print(f"    [ERROR] Failed to fetch feed: {e}")

    return new_count


def scrape_floodlist_vietnam(dry_run: bool = False) -> int:
    """
    Scrape FloodList specifically for Vietnam articles.
    FloodList has great coverage of Southeast Asian floods.
    """
    print("\n  Scraping FloodList Vietnam articles...")
    new_count = 0

    try:
        # FloodList Vietnam tag page
        url = "https://floodlist.com/tag/vietnam"
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })

        if response.status_code != 200:
            print(f"    Failed to fetch FloodList: {response.status_code}")
            return 0

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find article links
        articles = soup.find_all('article', class_='post', limit=20)
        print(f"    Found {len(articles)} articles")

        for article in articles:
            try:
                # Extract title and link
                title_elem = article.find('h2', class_='entry-title')
                if not title_elem:
                    continue

                link_elem = title_elem.find('a')
                if not link_elem:
                    continue

                title = link_elem.get_text(strip=True)
                link = link_elem.get('href', '')

                # Extract date
                date_elem = article.find('time', class_='entry-date')
                if date_elem and date_elem.get('datetime'):
                    try:
                        created_at = datetime.fromisoformat(date_elem['datetime'].replace('Z', '+00:00')).replace(tzinfo=None)
                    except:
                        created_at = datetime.now()
                else:
                    created_at = datetime.now()

                # Skip old news
                if (datetime.now() - created_at).days > 7:
                    continue

                # Extract description
                excerpt_elem = article.find('div', class_='entry-summary')
                description = excerpt_elem.get_text(strip=True) if excerpt_elem else ""

                # Use fresh session for each article
                db = SessionLocal()
                try:
                    # Check for duplicates
                    duplicate = NewsDedupService.find_duplicate(db, title, description, created_at)
                    if duplicate:
                        db.close()
                        continue

                    # Try to get full article
                    if link:
                        try:
                            article_result = extract_article(link, language='en', min_length=300)
                            if article_result.get('success') and len(article_result.get('full_text', '')) >= 300:
                                description = article_result['full_text']
                        except:
                            pass

                    # Extract location
                    location_data = extract_location_data(title + " " + description)

                    # Classify type
                    report_type = classify_report_type_en(title, description)

                    # Extract featured image
                    media_urls = []
                    img_elem = article.find('img')
                    if img_elem:
                        img_url = img_elem.get('src') or img_elem.get('data-src')
                        if img_url and img_url.startswith('https://'):
                            media_urls.append(img_url)

                    # Prepare dedup fields
                    dedup_fields = NewsDedupService.prepare_report_dedup_fields(
                        title, description, link or "floodlist.com"
                    )

                    report = Report(
                        type=report_type,
                        source=link or "https://floodlist.com",
                        title=title[:500],
                        description=description if description else None,
                        province=location_data['province'],
                        lat=location_data['lat'],
                        lon=location_data['lon'],
                        location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                        trust_score=0.85,
                        status="new",
                        created_at=created_at,
                        media=media_urls,
                        normalized_title=dedup_fields['normalized_title'],
                        content_hash=dedup_fields['content_hash'],
                        source_domain=dedup_fields['source_domain']
                    )

                    if dry_run:
                        print(f"    [DRY RUN] {report_type.value}: {title[:60]}...")
                    else:
                        db.add(report)
                        db.commit()
                        new_count += 1
                        print(f"    [NEW] {report_type.value}: {title[:60]}...")

                finally:
                    db.close()

            except Exception as e:
                print(f"    [ERROR] {str(e)[:50]}")
                continue

    except Exception as e:
        print(f"    [ERROR] FloodList scrape failed: {e}")

    return new_count


def scrape_reliefweb_vietnam(dry_run: bool = False) -> int:
    """
    Scrape ReliefWeb API for Vietnam disaster reports.
    ReliefWeb is the UN's humanitarian information portal.
    """
    print("\n  Scraping ReliefWeb Vietnam reports...")
    new_count = 0

    try:
        # ReliefWeb API endpoint - use POST with JSON body for complex queries
        api_url = "https://api.reliefweb.int/v1/reports"
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'FloodWatch/1.0 (disaster monitoring; contact@floodwatch.vn)',
        }
        payload = {
            "appname": "floodwatch",
            "filter": {
                "field": "country.name",
                "value": "Viet Nam"
            },
            "preset": "latest",
            "limit": 30,
            "fields": {
                "include": ["title", "body", "url", "date.created", "source", "primary_country", "disaster"]
            }
        }

        response = requests.post(api_url, json=payload, headers=headers, timeout=15)

        if response.status_code != 200:
            print(f"    Failed to fetch ReliefWeb: {response.status_code}")
            return 0

        data = response.json()
        reports = data.get('data', [])
        print(f"    Found {len(reports)} reports")

        for item in reports:
            try:
                fields = item.get('fields', {})

                title = fields.get('title', '')
                if not title:
                    continue

                # Get description (body-html or body)
                description = fields.get('body', '') or fields.get('body-html', '')
                description = clean_html(description)[:2000]  # Limit length

                # Get URL
                link = fields.get('url', '') or f"https://reliefweb.int/node/{item.get('id', '')}"

                # Parse date
                date_created = fields.get('date', {}).get('created', '')
                if date_created:
                    try:
                        created_at = datetime.fromisoformat(date_created.replace('Z', '+00:00')).replace(tzinfo=None)
                    except:
                        created_at = datetime.now()
                else:
                    created_at = datetime.now()

                # Skip old news
                if (datetime.now() - created_at).days > 14:  # ReliefWeb reports can be older
                    continue

                # Filter: must be disaster-related
                if not is_vietnam_disaster_related(title, description):
                    continue

                # Use fresh session for each article
                db = SessionLocal()
                try:
                    # Check for duplicates
                    duplicate = NewsDedupService.find_duplicate(db, title, description, created_at)
                    if duplicate:
                        db.close()
                        continue

                    # Extract location
                    location_data = extract_location_data(title + " " + description)

                    # Classify type
                    report_type = classify_report_type_en(title, description)

                    # Prepare dedup fields
                    dedup_fields = NewsDedupService.prepare_report_dedup_fields(
                        title, description, link or "reliefweb.int"
                    )

                    report = Report(
                        type=report_type,
                        source=link,
                        title=title[:500],
                        description=description if description else None,
                        province=location_data['province'],
                        lat=location_data['lat'],
                        lon=location_data['lon'],
                        location=from_shape(Point(location_data['lon'], location_data['lat'])) if location_data['lat'] and location_data['lon'] else None,
                        trust_score=0.95,  # UN source = high trust
                        status="new",
                        created_at=created_at,
                        media=[],  # ReliefWeb rarely has images
                        normalized_title=dedup_fields['normalized_title'],
                        content_hash=dedup_fields['content_hash'],
                        source_domain=dedup_fields['source_domain']
                    )

                    if dry_run:
                        print(f"    [DRY RUN] {report_type.value}: {title[:60]}...")
                    else:
                        db.add(report)
                        db.commit()
                        new_count += 1
                        print(f"    [NEW] {report_type.value}: {title[:60]}...")

                finally:
                    db.close()

            except Exception as e:
                print(f"    [ERROR] {str(e)[:50]}")
                continue

    except Exception as e:
        print(f"    [ERROR] ReliefWeb scrape failed: {e}")

    return new_count


def scrape_english_news(dry_run: bool = False) -> int:
    """
    Main function to scrape all English news sources.

    Args:
        dry_run: If True, only print what would be inserted

    Returns:
        Total number of new reports created
    """
    print(f"[{datetime.now()}] Starting English news scrapers...")

    total_count = 0

    try:
        # 1. Scrape RSS feeds
        for feed_key, feed_config in ENGLISH_FEEDS.items():
            count = scrape_rss_feed(feed_key, feed_config, dry_run)
            total_count += count

        # 2. Scrape FloodList Vietnam tag page
        count = scrape_floodlist_vietnam(dry_run)
        total_count += count

        # 3. Scrape ReliefWeb API
        count = scrape_reliefweb_vietnam(dry_run)
        total_count += count

    except Exception as e:
        print(f"\n[ERROR] Scraper failed: {e}")
        raise

    print(f"\n[{datetime.now()}] English news scraping complete! Created {total_count} new reports.")
    return total_count


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape English news sources for Vietnam disasters")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be inserted without saving")
    args = parser.parse_args()

    count = scrape_english_news(dry_run=args.dry_run)
    print(f"\nTotal new reports: {count}")
