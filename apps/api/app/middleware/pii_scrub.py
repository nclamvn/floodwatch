"""
PII Scrubbing Middleware
Masks sensitive personal information from public API responses
"""
import re
from typing import Any, Dict, List


class PIIScrubber:
    """Scrub PII (Personally Identifiable Information) from text"""

    # Regex patterns
    PHONE_PATTERN = re.compile(
        r'(\+?\d{1,3}[-.\s]?)?'  # Optional country code
        r'(\(?\d{2,4}\)?[-.\s]?)'  # Area code
        r'(\d{3,4}[-.\s]?)'  # First part
        r'(\d{3,4})'  # Last part
    )

    EMAIL_PATTERN = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    )

    # Additional patterns for Vietnamese phone numbers
    VN_PHONE_PATTERN = re.compile(
        r'(?:\+84|0)(?:\d{9,10})'  # +84 or 0 followed by 9-10 digits
    )

    @staticmethod
    def scrub_phone(text: str) -> str:
        """Replace phone numbers with ***"""
        if not text:
            return text

        # Scrub general phone pattern
        text = PIIScrubber.PHONE_PATTERN.sub('***-****-***', text)

        # Scrub Vietnamese phone pattern
        text = PIIScrubber.VN_PHONE_PATTERN.sub('+84-***-***-***', text)

        return text

    @staticmethod
    def scrub_email(text: str) -> str:
        """Replace email addresses with ***@***"""
        if not text:
            return text

        return PIIScrubber.EMAIL_PATTERN.sub('***@***', text)

    @staticmethod
    def scrub_text(text: str) -> str:
        """Scrub all PII from text"""
        if not text:
            return text

        text = PIIScrubber.scrub_phone(text)
        text = PIIScrubber.scrub_email(text)

        return text

    @staticmethod
    def scrub_report(report_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Scrub PII from a report dictionary"""
        scrubbed = report_dict.copy()

        # Fields to scrub
        text_fields = ['title', 'description']

        for field in text_fields:
            if field in scrubbed and scrubbed[field]:
                scrubbed[field] = PIIScrubber.scrub_text(scrubbed[field])

        return scrubbed

    @staticmethod
    def scrub_reports_list(reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Scrub PII from a list of reports"""
        return [PIIScrubber.scrub_report(report) for report in reports]


def should_scrub_pii(path: str) -> bool:
    """
    Determine if PII should be scrubbed for this endpoint

    Returns True for public endpoints, False for admin endpoints
    """
    # Admin endpoints - keep PII intact
    admin_paths = [
        '/ops',
        '/admin',
        '/deliveries',
        '/subscriptions'
    ]

    for admin_path in admin_paths:
        if path.startswith(admin_path):
            return False

    # Public endpoints - scrub PII
    public_paths = [
        '/api/v1/',
        '/reports',
        '/lite',
        '/reports/export'
    ]

    for public_path in public_paths:
        if path.startswith(public_path):
            return True

    # Default: don't scrub
    return False


def scrub_response_data(data: Any, path: str) -> Any:
    """
    Scrub PII from response data if needed

    Args:
        data: Response data (dict or list)
        path: Request path

    Returns:
        Scrubbed data (or original if no scrubbing needed)
    """
    if not should_scrub_pii(path):
        return data

    # Handle different response formats
    if isinstance(data, dict):
        # Single report or paginated response
        if 'data' in data and isinstance(data['data'], list):
            # Paginated response
            scrubbed = data.copy()
            scrubbed['data'] = PIIScrubber.scrub_reports_list(data['data'])
            return scrubbed
        elif any(key in data for key in ['id', 'type', 'title']):
            # Single report
            return PIIScrubber.scrub_report(data)
        else:
            # Other dict response
            return data

    elif isinstance(data, list):
        # List of reports
        return PIIScrubber.scrub_reports_list(data)

    # Return as-is for other types
    return data
