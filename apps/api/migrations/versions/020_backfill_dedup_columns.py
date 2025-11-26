"""Backfill deduplication columns for existing reports

Revision ID: 020
Revises: 019
Create Date: 2025-11-26

Populates normalized_title, content_hash, and source_domain
for all existing reports that don't have these values.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import hashlib
import re
from urllib.parse import urlparse

# revision identifiers, used by Alembic.
revision: str = '020'
down_revision: Union[str, None] = '019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Vietnamese diacritics mapping for normalization
VIETNAMESE_CHARS = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
}


def normalize_title(title: str) -> str:
    """Normalize title for comparison (must match NewsDedupService.normalize_title)."""
    if not title:
        return ""

    text = title.lower()

    # Remove Vietnamese diacritics
    for viet_char, ascii_char in VIETNAMESE_CHARS.items():
        text = text.replace(viet_char, ascii_char)
        text = text.replace(viet_char.upper(), ascii_char)

    # Remove non-alphanumeric (keep spaces)
    text = re.sub(r'[^\w\s]', '', text, flags=re.UNICODE)

    # Collapse whitespace
    text = ' '.join(text.split())

    # Trim to 100 chars
    return text[:100]


def compute_content_hash(description: str) -> str:
    """Compute SHA256 hash of first 500 chars (must match NewsDedupService)."""
    if not description:
        return None

    normalized = ' '.join(description.lower().split())
    content_sample = normalized[:500]

    if not content_sample:
        return None

    return hashlib.sha256(content_sample.encode('utf-8')).hexdigest()


def extract_source_domain(url: str) -> str:
    """Extract domain from URL (must match NewsDedupService)."""
    if not url:
        return None

    try:
        parsed = urlparse(url)
        domain = parsed.netloc

        if domain.startswith('www.'):
            domain = domain[4:]

        return domain if domain else None
    except Exception:
        return None


def upgrade() -> None:
    """Backfill deduplication columns for existing reports."""
    # Get database connection
    connection = op.get_bind()
    session = Session(bind=connection)

    # Process in batches to avoid memory issues
    batch_size = 500
    offset = 0
    total_updated = 0

    print("Starting backfill of deduplication columns...")

    while True:
        # Fetch batch of reports without normalized_title
        result = connection.execute(
            sa.text("""
                SELECT id, title, description, source
                FROM reports
                WHERE normalized_title IS NULL
                ORDER BY id
                LIMIT :batch_size OFFSET :offset
            """),
            {"batch_size": batch_size, "offset": offset}
        )

        rows = result.fetchall()

        if not rows:
            break

        # Update each report
        for row in rows:
            report_id = row[0]
            title = row[1] or ""
            description = row[2] or ""
            source = row[3] or ""

            normalized = normalize_title(title)
            content_hash = compute_content_hash(description)
            source_domain = extract_source_domain(source)

            connection.execute(
                sa.text("""
                    UPDATE reports
                    SET normalized_title = :normalized_title,
                        content_hash = :content_hash,
                        source_domain = :source_domain
                    WHERE id = :id
                """),
                {
                    "id": report_id,
                    "normalized_title": normalized,
                    "content_hash": content_hash,
                    "source_domain": source_domain
                }
            )

        total_updated += len(rows)
        print(f"  Processed {total_updated} reports...")

        # Move to next batch
        offset += batch_size

        # Commit after each batch
        connection.commit()

    print(f"Backfill complete! Updated {total_updated} reports.")


def downgrade() -> None:
    """Clear backfilled data (columns will be dropped by migration 019 downgrade)."""
    connection = op.get_bind()

    # Clear the backfilled data
    connection.execute(
        sa.text("""
            UPDATE reports
            SET normalized_title = NULL,
                content_hash = NULL,
                source_domain = NULL
        """)
    )

    print("Cleared backfilled deduplication data.")
