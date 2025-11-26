"""
Article Content Extractor Service

Extracts full article content from news URLs.
Supports Vietnamese news sites: VnExpress, Tuoi Tre, Thanh Nien, VTC, etc.

UPDATED: Now integrates with AbsoluteExtractor (5-tier extraction) for guaranteed
full article extraction. Legacy functions maintained for backward compatibility.
"""

import logging
from typing import Optional, Dict, Any

try:
    from newspaper import Article
    NEWSPAPER_AVAILABLE = True
except ImportError:
    NEWSPAPER_AVAILABLE = False

import requests
from bs4 import BeautifulSoup

# Import AbsoluteExtractor for 5-tier extraction
try:
    from app.services.absolute_extractor import (
        get_absolute_extractor,
        extract_article_absolute,
        ExtractionStatus
    )
    ABSOLUTE_EXTRACTOR_AVAILABLE = True
except ImportError:
    ABSOLUTE_EXTRACTOR_AVAILABLE = False

logger = logging.getLogger(__name__)


# ============================================
# ABSOLUTE EXTRACTION (5-TIER) - NEW PRIMARY
# ============================================

def extract_article_absolute_mode(url: str, language: str = 'vi') -> Dict[str, Any]:
    """
    ABSOLUTE MODE: 5-tier extraction guaranteeing full article content.

    This is the NEW PRIMARY extraction method that uses:
    - Tier 1: DOM extraction (newspaper3k + readability + BeautifulSoup)
    - Tier 2: Headless browser (Playwright)
    - Tier 3: Trafilatura full mode
    - Tier 4: AI reconstruction
    - Tier 5: Multi-source cross fetch

    Args:
        url: Article URL to extract
        language: Content language (default: Vietnamese)

    Returns:
        dict: {
            'success': bool,
            'full_text': str,
            'title': str,
            'authors': list,
            'images': list,
            'publish_date': datetime,
            'tier_used': str,
            'word_count': int,
            'char_count': int,
            'guards_passed': list,
            'guards_failed': list,
            'error': str
        }
    """
    if not ABSOLUTE_EXTRACTOR_AVAILABLE:
        logger.warning("AbsoluteExtractor not available, falling back to hybrid extraction")
        result = extract_article_hybrid(url, language)
        result['tier_used'] = 'legacy_hybrid'
        return result

    try:
        extractor = get_absolute_extractor()
        result = extractor.extract(url, language)
        return result.to_dict()
    except Exception as e:
        logger.error(f"AbsoluteExtractor failed for {url}: {e}")
        # Fallback to hybrid
        result = extract_article_hybrid(url, language)
        result['tier_used'] = 'legacy_hybrid_fallback'
        result['error'] = str(e)
        return result


# ============================================
# LEGACY FUNCTIONS (BACKWARD COMPATIBILITY)
# ============================================


def extract_full_article(url: str, language: str = 'vi', timeout: int = 10) -> Dict[str, Any]:
    """
    Extract full article content from URL using Newspaper3k (LEGACY)

    Note: For production use, prefer extract_article_absolute_mode() which
    uses 5-tier extraction for guaranteed full content.

    Args:
        url: Article URL to extract content from
        language: Article language code (default: 'vi' for Vietnamese)
        timeout: Request timeout in seconds

    Returns:
        dict: {
            'success': bool,
            'full_text': str,  # Full article body text
            'title': str,      # Article title (extracted)
            'authors': list,   # List of author names
            'images': list,    # List of image URLs
            'publish_date': datetime,  # Publication date if available
            'error': str       # Error message if failed
        }
    """
    result = {
        'success': False,
        'full_text': '',
        'title': '',
        'authors': [],
        'images': [],
        'publish_date': None,
        'error': ''
    }

    if not url or not url.startswith('http'):
        result['error'] = f'Invalid URL: {url}'
        return result

    if not NEWSPAPER_AVAILABLE:
        result['error'] = 'newspaper3k not installed'
        return result

    try:
        # Initialize Newspaper Article
        article = Article(url, language=language)

        # Download article HTML
        article.download()

        # Parse article content
        article.parse()

        # Extract content
        result['success'] = True
        result['full_text'] = article.text.strip()
        result['title'] = article.title.strip() if article.title else ''
        result['authors'] = article.authors if article.authors else []
        result['images'] = list(article.images) if article.images else []
        result['publish_date'] = article.publish_date

        # Log success
        logger.info(f"Successfully extracted article from {url}: {len(result['full_text'])} chars")

        return result

    except Exception as e:
        logger.error(f"Failed to extract article from {url}: {str(e)}")
        result['error'] = str(e)
        return result


def extract_with_beautifulsoup(url: str, timeout: int = 10) -> Optional[str]:
    """
    Fallback extraction method using BeautifulSoup
    Useful when Newspaper3k fails

    Args:
        url: Article URL
        timeout: Request timeout

    Returns:
        str: Extracted article text or None if failed
    """
    try:
        response = requests.get(url, timeout=timeout, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Try common article content selectors for Vietnamese news sites
        selectors = [
            'article.fck_detail',  # VnExpress
            'div.detail-content',  # Tuoi Tre
            'div.article-body',    # Thanh Nien
            'div.content-detail',  # VTC
            'article',             # Generic
            'div[class*="article"]',
            'div[class*="content"]'
        ]

        for selector in selectors:
            content_div = soup.select_one(selector)
            if content_div:
                # Extract all paragraph text
                paragraphs = content_div.find_all(['p', 'div'])
                text = '\n\n'.join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])

                if len(text) > 200:  # Minimum reasonable article length
                    logger.info(f"BeautifulSoup extraction successful: {len(text)} chars")
                    return text

        logger.warning(f"BeautifulSoup could not find article content in {url}")
        return None

    except Exception as e:
        logger.error(f"BeautifulSoup extraction failed for {url}: {str(e)}")
        return None


def extract_images_with_beautifulsoup(url: str, timeout: int = 10) -> list:
    """
    Extract images using BeautifulSoup for better coverage on Vietnamese news sites

    Args:
        url: Article URL
        timeout: Request timeout

    Returns:
        list: List of image URLs found in article
    """
    images = []

    try:
        response = requests.get(url, timeout=timeout, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Try common article content selectors for Vietnamese news sites
        article_selectors = [
            'article.fck_detail',  # VnExpress
            'div.detail-content',  # Tuoi Tre
            'div.article-body',    # Thanh Nien
            'div.content-detail',  # VTC
            'div.article-content', # Baomoi
            'article',             # Generic
            'div[class*="article"]',
            'div[class*="content"]'
        ]

        # Find article container
        article_container = None
        for selector in article_selectors:
            article_container = soup.select_one(selector)
            if article_container:
                break

        # If no specific container found, use body
        if not article_container:
            article_container = soup.find('body')

        if article_container:
            # Find all img tags in article
            img_tags = article_container.find_all('img')

            for img in img_tags:
                # Try multiple attributes where image URL might be
                img_url = (
                    img.get('data-src') or
                    img.get('data-original') or
                    img.get('src') or
                    img.get('data-lazy-src')
                )

                if img_url:
                    # Handle relative URLs
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    elif img_url.startswith('/'):
                        from urllib.parse import urlparse
                        parsed = urlparse(url)
                        img_url = f"{parsed.scheme}://{parsed.netloc}{img_url}"

                    # Filter out small images (likely icons/logos)
                    width = img.get('width')
                    height = img.get('height')

                    # Skip if dimensions are too small (likely icons)
                    if width and height:
                        try:
                            if int(width) < 200 or int(height) < 150:
                                continue
                        except ValueError:
                            pass  # Can't parse dimensions, include anyway

                    # Skip common non-article images
                    skip_keywords = [
                        'logo', 'icon', 'avatar', 'ads', 'banner', 'tracking',
                        'logotuoitre', 'banner_gg', 'web_images/logo',
                        '/ads/', '/banner/', '/icon/', '/logo/',
                        'static-tuoitre.tuoitre.vn'  # Static assets domain
                    ]
                    if any(keyword in img_url.lower() for keyword in skip_keywords):
                        continue

                    # Only include valid image extensions
                    valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
                    if any(ext in img_url.lower() for ext in valid_extensions):
                        if img_url not in images:  # Avoid duplicates
                            images.append(img_url)

                    # Limit to 10 images max
                    if len(images) >= 10:
                        break

        logger.info(f"BeautifulSoup extracted {len(images)} images from {url}")
        return images

    except Exception as e:
        logger.error(f"BeautifulSoup image extraction failed for {url}: {str(e)}")
        return []


def extract_article_hybrid(url: str, language: str = 'vi') -> Dict[str, Any]:
    """
    Hybrid extraction: Try Newspaper3k first, fall back to BeautifulSoup (LEGACY)

    Note: For production use with guaranteed full content, use
    extract_article_absolute_mode() instead.

    Args:
        url: Article URL
        language: Language code

    Returns:
        dict: Same format as extract_full_article()
    """
    # Try Newspaper3k first
    result = extract_full_article(url, language=language)

    # If failed or text too short, try BeautifulSoup for text
    if not result['success'] or len(result['full_text']) < 200:
        logger.info(f"Trying BeautifulSoup fallback for text from {url}")

        bs_text = extract_with_beautifulsoup(url)
        if bs_text and len(bs_text) > 200:
            result['success'] = True
            result['full_text'] = bs_text
            result['error'] = ''
            logger.info(f"BeautifulSoup text fallback successful: {len(bs_text)} chars")

    # If no images or very few images, try BeautifulSoup for images
    if len(result.get('images', [])) < 3:
        logger.info(f"Trying BeautifulSoup for images from {url} (current: {len(result.get('images', []))} images)")

        bs_images = extract_images_with_beautifulsoup(url)
        if bs_images:
            # Combine Newspaper3k images with BeautifulSoup images, remove duplicates
            existing_images = set(result.get('images', []))
            for img in bs_images:
                if img not in existing_images:
                    result['images'].append(img)

            logger.info(f"BeautifulSoup image fallback added {len(bs_images)} images, total now: {len(result['images'])}")

    return result


# ============================================
# CONVENIENCE WRAPPER - USE FOR ALL SCRAPERS
# ============================================

def extract_article(url: str, language: str = 'vi', min_length: int = 500) -> Dict[str, Any]:
    """
    PRIMARY EXTRACTION FUNCTION - Use this for all scrapers.

    Automatically uses AbsoluteExtractor (5-tier) when available,
    falls back to hybrid extraction otherwise.

    Args:
        url: Article URL to extract
        language: Content language (default: Vietnamese)
        min_length: Minimum acceptable article length (default: 500)

    Returns:
        dict with 'success', 'full_text', 'title', 'images', etc.
    """
    # Use absolute mode if available (5-tier extraction)
    if ABSOLUTE_EXTRACTOR_AVAILABLE:
        result = extract_article_absolute_mode(url, language)

        # Check if we got enough content
        if result.get('success') and len(result.get('full_text', '')) >= min_length:
            return result

        # If absolute mode failed or returned insufficient content,
        # log warning but still return the result
        logger.warning(
            f"Absolute extraction returned {len(result.get('full_text', ''))} chars "
            f"(min: {min_length}) for {url}"
        )
        return result

    # Fallback to hybrid mode
    result = extract_article_hybrid(url, language)
    result['tier_used'] = 'legacy_hybrid'
    return result
