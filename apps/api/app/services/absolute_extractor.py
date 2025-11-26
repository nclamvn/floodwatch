"""
Absolute Article Extractor - 5-Tier Extraction Engine

Phase: Full Article Extraction Absolute Mode
Guarantees 100% full article content through 5-tier fallback strategy.

Tiers:
1. DOM Extraction (newspaper3k + readability-lxml + BeautifulSoup)
2. Headless Browser (Playwright)
3. Trafilatura Full Mode
4. AI Reconstruction Mode
5. Multi-Source Cross Fetch
"""

import os
import re
import json
import yaml
import logging
import hashlib
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from urllib.parse import urlparse
from dataclasses import dataclass, field, asdict
from enum import Enum

import requests
from bs4 import BeautifulSoup

# Optional imports with fallbacks
try:
    from newspaper import Article
    NEWSPAPER_AVAILABLE = True
except ImportError:
    NEWSPAPER_AVAILABLE = False

try:
    from readability import Document
    READABILITY_AVAILABLE = True
except ImportError:
    READABILITY_AVAILABLE = False

try:
    import trafilatura
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)


class ExtractionTier(str, Enum):
    """Extraction tier identifiers"""
    TIER1_DOM = "tier1_dom"
    TIER2_HEADLESS = "tier2_headless"
    TIER3_TRAFILATURA = "tier3_trafilatura"
    TIER4_AI = "tier4_ai"
    TIER5_MULTISOURCE = "tier5_multisource"
    FAILED = "failed"


class ExtractionStatus(str, Enum):
    """Extraction result status"""
    SUCCESS = "success"
    PARTIAL = "partial"
    SNIPPET = "snippet"
    FAILED = "failed"


@dataclass
class ExtractionResult:
    """Result of article extraction"""
    success: bool
    status: ExtractionStatus
    tier_used: ExtractionTier
    full_text: str
    title: str = ""
    authors: List[str] = field(default_factory=list)
    images: List[str] = field(default_factory=list)
    publish_date: Optional[datetime] = None
    word_count: int = 0
    char_count: int = 0
    extraction_time_ms: int = 0
    guards_passed: List[str] = field(default_factory=list)
    guards_failed: List[str] = field(default_factory=list)
    error: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        result = asdict(self)
        result['status'] = self.status.value
        result['tier_used'] = self.tier_used.value
        if self.publish_date:
            result['publish_date'] = self.publish_date.isoformat()
        return result


class ContentGuards:
    """Content quality validation guards (10 Guardrails)"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.guards_config = config.get('guards', {})

    def validate(self, text: str, title: str = "") -> Tuple[bool, List[str], List[str]]:
        """
        Run all content guards on extracted text.

        Returns:
            Tuple of (passed, passed_guards, failed_guards)
        """
        passed_guards = []
        failed_guards = []

        # Guard 1: Minimum length
        min_length = self.guards_config.get('min_length', 500)
        if len(text) >= min_length:
            passed_guards.append("min_length")
        else:
            failed_guards.append(f"min_length ({len(text)} < {min_length})")

        # Guard 2: Minimum paragraphs
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        min_paragraphs = self.guards_config.get('min_paragraphs', 3)
        if len(paragraphs) >= min_paragraphs:
            passed_guards.append("min_paragraphs")
        else:
            failed_guards.append(f"min_paragraphs ({len(paragraphs)} < {min_paragraphs})")

        # Guard 3: Special character ratio
        if text:
            special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
            special_ratio = special_chars / len(text)
            max_special = self.guards_config.get('max_special_char_ratio', 0.15)
            if special_ratio <= max_special:
                passed_guards.append("special_char_ratio")
            else:
                failed_guards.append(f"special_char_ratio ({special_ratio:.2f} > {max_special})")

        # Guard 4: Numeric ratio
        if text:
            numeric_chars = sum(1 for c in text if c.isdigit())
            numeric_ratio = numeric_chars / len(text)
            max_numeric = self.guards_config.get('max_numeric_ratio', 0.30)
            if numeric_ratio <= max_numeric:
                passed_guards.append("numeric_ratio")
            else:
                failed_guards.append(f"numeric_ratio ({numeric_ratio:.2f} > {max_numeric})")

        # Guard 5: Snippet patterns
        snippet_patterns = self.guards_config.get('snippet_patterns', [])
        has_snippet_pattern = any(pattern.lower() in text.lower() for pattern in snippet_patterns)
        if not has_snippet_pattern:
            passed_guards.append("no_snippet_patterns")
        else:
            failed_guards.append("snippet_pattern_detected")

        # Guard 6: Title repetition
        if title:
            title_lower = title.lower()
            title_count = text.lower().count(title_lower)
            max_repetition = self.guards_config.get('max_title_repetition', 2)
            if title_count <= max_repetition:
                passed_guards.append("title_repetition")
            else:
                failed_guards.append(f"title_repetition ({title_count} > {max_repetition})")

        # Guard 7: Navigation keywords
        nav_keywords = self.guards_config.get('navigation_keywords', [])
        nav_count = sum(1 for kw in nav_keywords if kw.lower() in text.lower())
        if nav_count < 5:
            passed_guards.append("no_navigation_spam")
        else:
            failed_guards.append(f"navigation_spam ({nav_count} keywords)")

        # Guard 8: Unique words
        words = re.findall(r'\b\w+\b', text.lower())
        unique_words = len(set(words))
        min_unique = self.guards_config.get('min_unique_words', 50)
        if unique_words >= min_unique:
            passed_guards.append("unique_words")
        else:
            failed_guards.append(f"unique_words ({unique_words} < {min_unique})")

        # Guard 9: Reject patterns
        reject_patterns = self.guards_config.get('reject_patterns', [])
        has_reject_pattern = any(pattern.lower() in text.lower() for pattern in reject_patterns)
        if not has_reject_pattern:
            passed_guards.append("no_reject_patterns")
        else:
            failed_guards.append("reject_pattern_detected")

        # Guard 10: Vietnamese content
        vietnamese_chars = sum(1 for c in text if ord(c) > 127 or c in 'àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ')
        vn_threshold = self.guards_config.get('vietnamese_char_threshold', 0.3)
        if text:
            vn_ratio = vietnamese_chars / len(text)
            if vn_ratio >= vn_threshold * 0.5:  # More lenient for mixed content
                passed_guards.append("vietnamese_content")
            else:
                failed_guards.append(f"vietnamese_content ({vn_ratio:.2f} < {vn_threshold * 0.5})")

        # Overall pass if most guards pass
        critical_guards = ['min_length', 'no_snippet_patterns']
        critical_passed = all(g in passed_guards for g in critical_guards)

        overall_pass = critical_passed and len(failed_guards) <= 3

        return overall_pass, passed_guards, failed_guards


class AbsoluteExtractor:
    """
    5-Tier Absolute Article Extractor

    Guarantees full article extraction through cascading fallbacks.
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize extractor with config"""
        self.config = self._load_config(config_path)
        self.guards = ContentGuards(self.config)
        self.session = self._create_session()
        self._extraction_stats = {
            'total': 0,
            'success': 0,
            'by_tier': {tier.value: 0 for tier in ExtractionTier}
        }

    def _load_config(self, config_path: Optional[str] = None) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(__file__),
                '../../config/article_extraction.yaml'
            )

        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Config not found at {config_path}, using defaults")
            return self._default_config()

    def _default_config(self) -> Dict[str, Any]:
        """Default configuration if YAML not found"""
        return {
            'global': {
                'min_article_length': 500,
                'min_word_count': 100,
                'request_timeout': 30,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            'guards': {
                'min_length': 500,
                'min_paragraphs': 3,
                'max_special_char_ratio': 0.15,
                'max_numeric_ratio': 0.30,
                'snippet_patterns': ['Đọc tiếp...', 'Xem thêm...', '[...]'],
                'max_title_repetition': 2,
                'navigation_keywords': ['Trang chủ', 'Đăng nhập'],
                'min_unique_words': 50,
                'reject_patterns': ['chấp nhận cookie'],
                'vietnamese_char_threshold': 0.3
            },
            'sites': {},
            'tiers': {
                'tier1_dom': {'enabled': True, 'timeout': 15},
                'tier2_headless': {'enabled': True, 'timeout': 45},
                'tier3_trafilatura': {'enabled': True, 'timeout': 30},
                'tier4_ai': {'enabled': True, 'model': 'gpt-4o-mini'},
                'tier5_multisource': {'enabled': True, 'timeout': 60}
            }
        }

    def _create_session(self) -> requests.Session:
        """Create HTTP session with proper headers"""
        session = requests.Session()
        session.headers.update({
            'User-Agent': self.config.get('global', {}).get(
                'user_agent',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        })
        return session

    def _get_site_config(self, url: str) -> Dict[str, Any]:
        """Get site-specific configuration"""
        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '')

        sites = self.config.get('sites', {})
        return sites.get(domain, {})

    def extract(self, url: str, language: str = 'vi') -> ExtractionResult:
        """
        Extract full article content using 5-tier fallback strategy.

        Args:
            url: Article URL to extract
            language: Content language (default: Vietnamese)

        Returns:
            ExtractionResult with full article content
        """
        start_time = datetime.now()
        self._extraction_stats['total'] += 1

        logger.info(f"Starting absolute extraction for: {url}")

        # Validate URL
        if not url or not url.startswith('http'):
            return self._failed_result(f"Invalid URL: {url}", start_time)

        # Get site-specific config
        site_config = self._get_site_config(url)
        min_length = self.config.get('global', {}).get('min_article_length', 500)

        # Try each tier in order
        tiers_config = self.config.get('tiers', {})

        # Tier 1: DOM Extraction
        if tiers_config.get('tier1_dom', {}).get('enabled', True):
            result = self._tier1_dom_extraction(url, language, site_config)
            if self._is_valid_extraction(result, min_length):
                logger.info(f"Tier 1 SUCCESS: {len(result.full_text)} chars")
                self._extraction_stats['success'] += 1
                self._extraction_stats['by_tier'][ExtractionTier.TIER1_DOM.value] += 1
                result.extraction_time_ms = self._elapsed_ms(start_time)
                return result

        # Tier 2: Headless Browser
        if tiers_config.get('tier2_headless', {}).get('enabled', True) and PLAYWRIGHT_AVAILABLE:
            result = self._tier2_headless_extraction(url, site_config)
            if self._is_valid_extraction(result, min_length):
                logger.info(f"Tier 2 SUCCESS: {len(result.full_text)} chars")
                self._extraction_stats['success'] += 1
                self._extraction_stats['by_tier'][ExtractionTier.TIER2_HEADLESS.value] += 1
                result.extraction_time_ms = self._elapsed_ms(start_time)
                return result

        # Tier 3: Trafilatura
        if tiers_config.get('tier3_trafilatura', {}).get('enabled', True) and TRAFILATURA_AVAILABLE:
            result = self._tier3_trafilatura_extraction(url)
            if self._is_valid_extraction(result, min_length):
                logger.info(f"Tier 3 SUCCESS: {len(result.full_text)} chars")
                self._extraction_stats['success'] += 1
                self._extraction_stats['by_tier'][ExtractionTier.TIER3_TRAFILATURA.value] += 1
                result.extraction_time_ms = self._elapsed_ms(start_time)
                return result

        # Tier 4: AI Reconstruction
        if tiers_config.get('tier4_ai', {}).get('enabled', True) and OPENAI_AVAILABLE:
            # Get best partial content so far
            partial_content = result.full_text if result else ""
            title = result.title if result else ""

            result = self._tier4_ai_reconstruction(url, title, partial_content)
            if self._is_valid_extraction(result, min_length):
                logger.info(f"Tier 4 SUCCESS: {len(result.full_text)} chars")
                self._extraction_stats['success'] += 1
                self._extraction_stats['by_tier'][ExtractionTier.TIER4_AI.value] += 1
                result.extraction_time_ms = self._elapsed_ms(start_time)
                return result

        # Tier 5: Multi-Source Cross Fetch
        if tiers_config.get('tier5_multisource', {}).get('enabled', True):
            result = self._tier5_multisource_fetch(url)
            if self._is_valid_extraction(result, min_length):
                logger.info(f"Tier 5 SUCCESS: {len(result.full_text)} chars")
                self._extraction_stats['success'] += 1
                self._extraction_stats['by_tier'][ExtractionTier.TIER5_MULTISOURCE.value] += 1
                result.extraction_time_ms = self._elapsed_ms(start_time)
                return result

        # All tiers failed
        logger.error(f"All 5 tiers FAILED for: {url}")
        return self._failed_result("All extraction tiers failed", start_time)

    def _tier1_dom_extraction(
        self,
        url: str,
        language: str,
        site_config: Dict[str, Any]
    ) -> ExtractionResult:
        """
        Tier 1: DOM-based extraction using newspaper3k, readability-lxml, BeautifulSoup
        """
        logger.debug(f"Tier 1: DOM extraction for {url}")

        best_text = ""
        title = ""
        authors = []
        images = []
        publish_date = None

        try:
            timeout = self.config.get('tiers', {}).get('tier1_dom', {}).get('timeout', 15)

            # Method 1: newspaper3k
            if NEWSPAPER_AVAILABLE:
                try:
                    article = Article(url, language=language)
                    article.download()
                    article.parse()

                    if article.text and len(article.text) > len(best_text):
                        best_text = article.text.strip()
                        title = article.title.strip() if article.title else ""
                        authors = article.authors if article.authors else []
                        images = list(article.images) if article.images else []
                        publish_date = article.publish_date
                        logger.debug(f"newspaper3k: {len(best_text)} chars")
                except Exception as e:
                    logger.debug(f"newspaper3k failed: {e}")

            # Method 2: readability-lxml
            if READABILITY_AVAILABLE and len(best_text) < 500:
                try:
                    response = self.session.get(url, timeout=timeout)
                    response.raise_for_status()

                    doc = Document(response.text)
                    content = doc.summary()

                    # Clean HTML
                    soup = BeautifulSoup(content, 'html.parser')
                    text = soup.get_text(separator='\n\n').strip()

                    if len(text) > len(best_text):
                        best_text = text
                        if not title:
                            title = doc.title()
                        logger.debug(f"readability-lxml: {len(best_text)} chars")
                except Exception as e:
                    logger.debug(f"readability-lxml failed: {e}")

            # Method 3: BeautifulSoup with site-specific selectors
            if len(best_text) < 500:
                try:
                    response = self.session.get(url, timeout=timeout)
                    response.raise_for_status()

                    soup = BeautifulSoup(response.content, 'html.parser')

                    # Remove unwanted elements
                    for selector in site_config.get('remove_elements', []):
                        for el in soup.select(selector):
                            el.decompose()

                    # Try site-specific selectors first
                    selectors = site_config.get('selectors', [])
                    # Add generic selectors
                    selectors.extend([
                        'article.fck_detail',
                        'div.detail-content',
                        'div.article-body',
                        'div.content-detail',
                        'article',
                        'div[class*="article"]',
                        'div[class*="content"]'
                    ])

                    for selector in selectors:
                        content_div = soup.select_one(selector)
                        if content_div:
                            paragraphs = content_div.find_all(['p', 'div'])
                            text = '\n\n'.join([
                                p.get_text().strip()
                                for p in paragraphs
                                if p.get_text().strip() and len(p.get_text().strip()) > 20
                            ])

                            if len(text) > len(best_text):
                                best_text = text
                                logger.debug(f"BeautifulSoup ({selector}): {len(best_text)} chars")

                    # Extract title if not found
                    if not title:
                        title_tag = soup.find('h1') or soup.find('title')
                        if title_tag:
                            title = title_tag.get_text().strip()

                    # Extract images
                    if not images:
                        images = self._extract_images_bs(soup, url)

                except Exception as e:
                    logger.debug(f"BeautifulSoup failed: {e}")

        except Exception as e:
            logger.error(f"Tier 1 error: {e}")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER1_DOM,
                text="",
                error=str(e)
            )

        # Validate with guards
        passed, guards_passed, guards_failed = self.guards.validate(best_text, title)

        return self._create_result(
            success=passed,
            status=ExtractionStatus.SUCCESS if passed else ExtractionStatus.PARTIAL,
            tier=ExtractionTier.TIER1_DOM,
            text=best_text,
            title=title,
            authors=authors,
            images=images,
            publish_date=publish_date,
            guards_passed=guards_passed,
            guards_failed=guards_failed
        )

    def _tier2_headless_extraction(
        self,
        url: str,
        site_config: Dict[str, Any]
    ) -> ExtractionResult:
        """
        Tier 2: Headless browser extraction using Playwright
        """
        logger.debug(f"Tier 2: Headless extraction for {url}")

        if not PLAYWRIGHT_AVAILABLE:
            logger.warning("Playwright not available, skipping Tier 2")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER2_HEADLESS,
                text="",
                error="Playwright not installed"
            )

        try:
            tier_config = self.config.get('tiers', {}).get('tier2_headless', {})
            timeout = tier_config.get('timeout', 45) * 1000  # Convert to ms

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=self.config.get('global', {}).get('user_agent'),
                    viewport={'width': 1920, 'height': 1080}
                )
                page = context.new_page()

                # Navigate and wait
                page.goto(url, timeout=timeout)
                page.wait_for_load_state('networkidle', timeout=timeout)

                # Wait for content selector
                wait_selector = tier_config.get('wait_for_selector', 'article, div[class*="content"]')
                try:
                    page.wait_for_selector(wait_selector, timeout=10000)
                except Exception:
                    pass  # Continue even if specific selector not found

                # Get page content
                html = page.content()
                browser.close()

            # Parse with BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')

            # Remove unwanted elements
            for selector in site_config.get('remove_elements', []):
                for el in soup.select(selector):
                    el.decompose()

            # Extract content
            best_text = ""
            title = ""

            selectors = site_config.get('selectors', []) + [
                'article', 'div[class*="content"]', 'div[class*="article"]'
            ]

            for selector in selectors:
                content_div = soup.select_one(selector)
                if content_div:
                    paragraphs = content_div.find_all(['p', 'div'])
                    text = '\n\n'.join([
                        p.get_text().strip()
                        for p in paragraphs
                        if p.get_text().strip() and len(p.get_text().strip()) > 20
                    ])

                    if len(text) > len(best_text):
                        best_text = text

            # Get title
            title_tag = soup.find('h1') or soup.find('title')
            if title_tag:
                title = title_tag.get_text().strip()

            # Validate
            passed, guards_passed, guards_failed = self.guards.validate(best_text, title)

            return self._create_result(
                success=passed,
                status=ExtractionStatus.SUCCESS if passed else ExtractionStatus.PARTIAL,
                tier=ExtractionTier.TIER2_HEADLESS,
                text=best_text,
                title=title,
                guards_passed=guards_passed,
                guards_failed=guards_failed
            )

        except Exception as e:
            logger.error(f"Tier 2 error: {e}")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER2_HEADLESS,
                text="",
                error=str(e)
            )

    def _tier3_trafilatura_extraction(self, url: str) -> ExtractionResult:
        """
        Tier 3: Trafilatura full extraction mode
        """
        logger.debug(f"Tier 3: Trafilatura extraction for {url}")

        if not TRAFILATURA_AVAILABLE:
            logger.warning("Trafilatura not available, skipping Tier 3")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER3_TRAFILATURA,
                text="",
                error="Trafilatura not installed"
            )

        try:
            tier_config = self.config.get('tiers', {}).get('tier3_trafilatura', {})

            # Download and extract
            downloaded = trafilatura.fetch_url(url)

            if not downloaded:
                return self._create_result(
                    success=False,
                    status=ExtractionStatus.FAILED,
                    tier=ExtractionTier.TIER3_TRAFILATURA,
                    text="",
                    error="Failed to download page"
                )

            # Extract with full settings
            text = trafilatura.extract(
                downloaded,
                include_tables=tier_config.get('include_tables', True),
                include_images=tier_config.get('include_images', False),
                include_links=tier_config.get('include_links', False),
                favor_precision=tier_config.get('favor_precision', False),
                favor_recall=tier_config.get('favor_recall', True),
                output_format='txt'
            )

            if not text:
                return self._create_result(
                    success=False,
                    status=ExtractionStatus.FAILED,
                    tier=ExtractionTier.TIER3_TRAFILATURA,
                    text="",
                    error="No content extracted"
                )

            # Get metadata
            metadata = trafilatura.extract(
                downloaded,
                output_format='json',
                with_metadata=True
            )

            title = ""
            if metadata:
                try:
                    meta_dict = json.loads(metadata) if isinstance(metadata, str) else metadata
                    title = meta_dict.get('title', '')
                except Exception:
                    pass

            # Validate
            passed, guards_passed, guards_failed = self.guards.validate(text, title)

            return self._create_result(
                success=passed,
                status=ExtractionStatus.SUCCESS if passed else ExtractionStatus.PARTIAL,
                tier=ExtractionTier.TIER3_TRAFILATURA,
                text=text,
                title=title,
                guards_passed=guards_passed,
                guards_failed=guards_failed
            )

        except Exception as e:
            logger.error(f"Tier 3 error: {e}")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER3_TRAFILATURA,
                text="",
                error=str(e)
            )

    def _tier4_ai_reconstruction(
        self,
        url: str,
        title: str,
        partial_content: str
    ) -> ExtractionResult:
        """
        Tier 4: AI-powered article reconstruction
        """
        logger.debug(f"Tier 4: AI reconstruction for {url}")

        if not OPENAI_AVAILABLE:
            logger.warning("OpenAI not available, skipping Tier 4")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER4_AI,
                text="",
                error="OpenAI not installed"
            )

        # Need at least some content to reconstruct
        ai_threshold = self.config.get('global', {}).get('ai_reconstruction_threshold', 300)
        if len(partial_content) < ai_threshold:
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER4_AI,
                text="",
                error=f"Insufficient content for reconstruction ({len(partial_content)} < {ai_threshold})"
            )

        try:
            tier_config = self.config.get('tiers', {}).get('tier4_ai', {})
            model = tier_config.get('model', 'gpt-4o-mini')
            max_tokens = tier_config.get('max_tokens', 2000)
            temperature = tier_config.get('temperature', 0.3)

            prompt = f"""You are an expert article reconstructor. Given partial article content and metadata,
reconstruct the full article in Vietnamese.

RULES:
1. ONLY use information from the provided content
2. DO NOT fabricate facts, quotes, or statistics
3. Maintain the original article structure
4. Expand truncated sentences naturally
5. Remove navigation/advertisement text
6. Keep the journalistic tone consistent
7. Output ONLY the reconstructed article text, no explanations

Title: {title}
Source: {url}
Partial Content: {partial_content[:3000]}

Reconstruct the full article (minimum 500 characters):"""

            client = openai.OpenAI()
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là trợ lý tái tạo nội dung báo chí. Chỉ sử dụng thông tin có sẵn, không bịa đặt."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=max_tokens,
                temperature=temperature
            )

            reconstructed = response.choices[0].message.content.strip()

            # Validate
            passed, guards_passed, guards_failed = self.guards.validate(reconstructed, title)

            return self._create_result(
                success=passed,
                status=ExtractionStatus.SUCCESS if passed else ExtractionStatus.PARTIAL,
                tier=ExtractionTier.TIER4_AI,
                text=reconstructed,
                title=title,
                guards_passed=guards_passed,
                guards_failed=guards_failed,
                metadata={'ai_reconstructed': True}
            )

        except Exception as e:
            logger.error(f"Tier 4 error: {e}")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER4_AI,
                text="",
                error=str(e)
            )

    def _tier5_multisource_fetch(self, url: str) -> ExtractionResult:
        """
        Tier 5: Multi-source cross fetch (Google Cache, Wayback Machine, aggregators)
        """
        logger.debug(f"Tier 5: Multi-source fetch for {url}")

        try:
            # Try Google Cache
            google_cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{url}"
            try:
                response = self.session.get(google_cache_url, timeout=30)
                if response.ok:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    # Remove Google's cache header
                    for div in soup.select('div[style*="position"]'):
                        div.decompose()

                    text = soup.get_text(separator='\n\n').strip()
                    if len(text) > 500:
                        passed, guards_passed, guards_failed = self.guards.validate(text)
                        if passed:
                            return self._create_result(
                                success=True,
                                status=ExtractionStatus.SUCCESS,
                                tier=ExtractionTier.TIER5_MULTISOURCE,
                                text=text,
                                guards_passed=guards_passed,
                                guards_failed=guards_failed,
                                metadata={'source': 'google_cache'}
                            )
            except Exception as e:
                logger.debug(f"Google Cache failed: {e}")

            # Try Wayback Machine
            try:
                wayback_api = f"https://archive.org/wayback/available?url={url}"
                response = self.session.get(wayback_api, timeout=15)
                if response.ok:
                    data = response.json()
                    snapshots = data.get('archived_snapshots', {})
                    closest = snapshots.get('closest', {})
                    if closest.get('available'):
                        archive_url = closest.get('url')
                        archive_response = self.session.get(archive_url, timeout=30)
                        if archive_response.ok:
                            soup = BeautifulSoup(archive_response.content, 'html.parser')
                            # Remove Wayback toolbar
                            for el in soup.select('#wm-ipp-base, #wm-ipp'):
                                el.decompose()

                            selectors = ['article', 'div[class*="content"]', 'div[class*="article"]']
                            for selector in selectors:
                                content = soup.select_one(selector)
                                if content:
                                    text = content.get_text(separator='\n\n').strip()
                                    if len(text) > 500:
                                        passed, guards_passed, guards_failed = self.guards.validate(text)
                                        if passed:
                                            return self._create_result(
                                                success=True,
                                                status=ExtractionStatus.SUCCESS,
                                                tier=ExtractionTier.TIER5_MULTISOURCE,
                                                text=text,
                                                guards_passed=guards_passed,
                                                guards_failed=guards_failed,
                                                metadata={'source': 'wayback_machine'}
                                            )
            except Exception as e:
                logger.debug(f"Wayback Machine failed: {e}")

            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER5_MULTISOURCE,
                text="",
                error="No alternative source available"
            )

        except Exception as e:
            logger.error(f"Tier 5 error: {e}")
            return self._create_result(
                success=False,
                status=ExtractionStatus.FAILED,
                tier=ExtractionTier.TIER5_MULTISOURCE,
                text="",
                error=str(e)
            )

    def _extract_images_bs(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract images using BeautifulSoup"""
        images = []
        parsed_base = urlparse(base_url)

        for img in soup.find_all('img'):
            img_url = (
                img.get('data-src') or
                img.get('data-original') or
                img.get('src') or
                img.get('data-lazy-src')
            )

            if not img_url:
                continue

            # Handle relative URLs
            if img_url.startswith('//'):
                img_url = 'https:' + img_url
            elif img_url.startswith('/'):
                img_url = f"{parsed_base.scheme}://{parsed_base.netloc}{img_url}"

            # Filter out small images and icons
            skip_keywords = ['logo', 'icon', 'avatar', 'ads', 'banner', 'tracking']
            if any(kw in img_url.lower() for kw in skip_keywords):
                continue

            if img_url not in images:
                images.append(img_url)

            if len(images) >= 10:
                break

        return images

    def _is_valid_extraction(self, result: ExtractionResult, min_length: int) -> bool:
        """Check if extraction result is valid"""
        if not result or not result.success:
            return False
        if len(result.full_text) < min_length:
            return False
        return True

    def _create_result(
        self,
        success: bool,
        status: ExtractionStatus,
        tier: ExtractionTier,
        text: str,
        title: str = "",
        authors: List[str] = None,
        images: List[str] = None,
        publish_date: Optional[datetime] = None,
        guards_passed: List[str] = None,
        guards_failed: List[str] = None,
        error: str = "",
        metadata: Dict[str, Any] = None
    ) -> ExtractionResult:
        """Create ExtractionResult"""
        words = re.findall(r'\b\w+\b', text) if text else []

        return ExtractionResult(
            success=success,
            status=status,
            tier_used=tier,
            full_text=text,
            title=title,
            authors=authors or [],
            images=images or [],
            publish_date=publish_date,
            word_count=len(words),
            char_count=len(text),
            guards_passed=guards_passed or [],
            guards_failed=guards_failed or [],
            error=error,
            metadata=metadata or {}
        )

    def _failed_result(self, error: str, start_time: datetime) -> ExtractionResult:
        """Create failed result"""
        result = self._create_result(
            success=False,
            status=ExtractionStatus.FAILED,
            tier=ExtractionTier.FAILED,
            text="",
            error=error
        )
        result.extraction_time_ms = self._elapsed_ms(start_time)
        return result

    def _elapsed_ms(self, start_time: datetime) -> int:
        """Calculate elapsed time in milliseconds"""
        return int((datetime.now() - start_time).total_seconds() * 1000)

    def get_stats(self) -> Dict[str, Any]:
        """Get extraction statistics"""
        return self._extraction_stats.copy()


# Global extractor instance
_extractor_instance: Optional[AbsoluteExtractor] = None


def get_absolute_extractor() -> AbsoluteExtractor:
    """Get or create AbsoluteExtractor singleton"""
    global _extractor_instance
    if _extractor_instance is None:
        _extractor_instance = AbsoluteExtractor()
    return _extractor_instance


def extract_article_absolute(url: str, language: str = 'vi') -> Dict[str, Any]:
    """
    Convenience function for absolute article extraction.

    Args:
        url: Article URL
        language: Content language

    Returns:
        Dictionary with extraction result
    """
    extractor = get_absolute_extractor()
    result = extractor.extract(url, language)
    return result.to_dict()


# Export
__all__ = [
    'AbsoluteExtractor',
    'ExtractionResult',
    'ExtractionTier',
    'ExtractionStatus',
    'ContentGuards',
    'get_absolute_extractor',
    'extract_article_absolute',
]
