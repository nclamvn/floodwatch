#!/usr/bin/env python3
"""
Cleanup Script: Remove Non-Disaster Articles from Database

Identifies and removes articles that slipped through the old weak filtering.
Targets: political news, fraud cases, hospital development, opinion pieces, etc.
"""

import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal, Report


def identify_non_disaster_articles(db, dry_run=True):
    """
    Find articles that match non-disaster exclude keywords.

    Args:
        db: Database session
        dry_run: If True, only show what would be deleted

    Returns:
        Number of articles identified/deleted
    """
    # Keywords that indicate non-disaster articles
    exclude_patterns = [
        # Political/administrative/diplomatic
        "làm chủ tịch", "lam chu tich", "giữ chức", "giu chuc",
        "bổ nhiệm", "bo nhiem", "phó bí thư", "pho bi thu",
        "thủ tướng", "thu tuong", "tổng thống", "tong thong",
        "nâng cấp quan hệ", "nang cap quan he",
        "đối tác chiến lược", "doi tac chien luoc",
        "hợp tác chiến lược", "hop tac chien luoc",
        "quan hệ ngoại giao", "quan he ngoai giao",
        "chuyển đổi số", "chuyen doi so",
        "phường trung tâm", "phuong trung tam",

        # Infrastructure/development
        "phát triển bệnh viện", "phat trien benh vien",

        # Opinion/lifestyle
        "nhiều hay ít", "nhieu hay it", "tiền lẻ", "tien le",
        "vì sao", "vi sao", "tại sao", "tai sao",

        # Crime/legal/smuggling (unless disaster-related)
        "bắt giám đốc", "bat giam doc", "bắt giữ", "bat giu",
        "khởi tố", "khoi to", "lừa đảo", "lua dao",
        "buôn lậu", "buon lau", "buôn bán", "buon ban",
        "hàng giả", "hang gia", "hàng lậu", "hang lau",
        "truy tố", "truy to", "kết án", "ket an",
        "mỹ phẩm", "my pham", "thẩm mỹ", "tham my",
        "thẩm mỹ viện", "tham my vien", "spa",
        "đối diện mức án", "doi dien muc an",

        # Traffic accidents (unless disaster-caused)
        "tai nạn giao thông", "tai nan giao thong",
        "va chạm giao thông", "va cham giao thong",
        "tai nạn làm", "tai nan lam"
    ]

    # Exception keywords - keep articles if they mention these
    disaster_consequence_keywords = [
        "mưa lũ", "mua lu", "bão lũ", "bao lu",
        "sau bão", "sau bao", "sau lũ", "sau lu",
        "do mưa", "do mua", "do bão", "do bao",
        "sạt lở", "sat lo", "lở đất", "lo dat",
        "ngập", "ngap", "lụt", "lut"
    ]

    to_delete = []

    # Query all reports
    all_reports = db.query(Report).all()

    print(f"\nScanning {len(all_reports)} total reports...")

    for report in all_reports:
        title_lower = report.title.lower()
        desc_lower = (report.description or "").lower()
        full_text = title_lower + " " + desc_lower

        # Check if title contains exclude keywords
        matches_exclude = False
        matched_keyword = None

        for keyword in exclude_patterns:
            if keyword in title_lower:
                matches_exclude = True
                matched_keyword = keyword
                break

        if matches_exclude:
            # Check if it's a legitimate disaster consequence article
            is_disaster_consequence = any(kw in full_text for kw in disaster_consequence_keywords)

            if not is_disaster_consequence:
                to_delete.append({
                    'id': report.id,
                    'title': report.title,
                    'source': report.source,
                    'created_at': report.created_at,
                    'keyword': matched_keyword
                })

    print(f"\n{'=' * 80}")
    print(f"Found {len(to_delete)} non-disaster articles to remove:")
    print(f"{'=' * 80}\n")

    for item in to_delete:
        print(f"[{item['created_at']}] {item['title'][:70]}")
        print(f"  Source: {item['source'][:60]}")
        print(f"  Matched: '{item['keyword']}'")
        print()

    if dry_run:
        print(f"\n[DRY RUN] Would delete {len(to_delete)} articles.")
        print("Run with --delete flag to actually remove them.")
    else:
        print(f"\nDeleting {len(to_delete)} articles...")

        for item in to_delete:
            report = db.query(Report).filter(Report.id == item['id']).first()
            if report:
                db.delete(report)

        db.commit()
        print(f"✓ Successfully deleted {len(to_delete)} non-disaster articles!")

    return len(to_delete)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Clean up non-disaster articles from database")
    parser.add_argument("--delete", action="store_true", help="Actually delete (not dry-run)")
    args = parser.parse_args()

    db = SessionLocal()

    try:
        count = identify_non_disaster_articles(db, dry_run=not args.delete)
        print(f"\n{'=' * 80}")
        print(f"Total: {count} articles {'deleted' if args.delete else 'identified'}")
        print(f"{'=' * 80}\n")
    finally:
        db.close()
