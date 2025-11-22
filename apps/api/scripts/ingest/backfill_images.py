#!/usr/bin/env python3
"""
Backfill missing images for existing reports using improved extraction
"""
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.database import SessionLocal, Report
from app.services.article_extractor import extract_article_hybrid
import structlog

logger = structlog.get_logger(__name__)


def backfill_missing_images(limit: int = 100, dry_run: bool = False):
    """
    Backfill images for reports that have full text but no/few images

    Args:
        limit: Maximum number of reports to process
        dry_run: If True, don't update database
    """
    print(f"\n[{datetime.now()}] Starting image backfill...")
    print(f"Limit: {limit} reports")
    print(f"Dry run: {dry_run}\n")

    db = SessionLocal()
    updated_count = 0
    failed_count = 0

    try:
        # Find reports with description but no/few images
        # Focus on disaster-related types
        reports = db.query(Report).filter(
            Report.description.isnot(None),
            Report.description != '',
            Report.type.in_(['RAIN', 'ALERT', 'SOS', 'ROAD'])
        ).order_by(Report.created_at.desc()).limit(limit).all()

        print(f"Found {len(reports)} reports to check\n")

        for report in reports:
            # Check current image count
            current_image_count = len(report.media) if report.media else 0

            # Skip if already has 3+ images
            if current_image_count >= 3:
                continue

            print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing: {report.title[:60]}...")
            print(f"  Current images: {current_image_count}")
            print(f"  Source: {report.source[:60]}...")

            # Extract images from source URL
            try:
                result = extract_article_hybrid(report.source, language='vi')

                if result['success'] and result.get('images'):
                    new_images = result['images'][:10]  # Max 10 images
                    print(f"  ✓ Extracted {len(new_images)} images")

                    if not dry_run:
                        # Update report with images
                        report.media = new_images
                        db.commit()
                        updated_count += 1
                        print(f"  ✓ Updated database")
                    else:
                        print(f"  [DRY RUN] Would update with {len(new_images)} images")
                        updated_count += 1

                    # Print first 3 image URLs
                    for i, img in enumerate(new_images[:3], 1):
                        print(f"    {i}. {img[:70]}...")

                else:
                    print(f"  ✗ No images found")
                    failed_count += 1

            except Exception as e:
                print(f"  ✗ Extraction failed: {str(e)[:100]}")
                failed_count += 1
                db.rollback()
                continue

    except Exception as e:
        print(f"\n[ERROR] Backfill failed: {e}")
        db.rollback()
        raise

    finally:
        db.close()

    print(f"\n{'='*80}")
    print(f"[{datetime.now()}] Backfill complete!")
    print(f"  Updated: {updated_count} reports")
    print(f"  Failed: {failed_count} reports")
    print(f"{'='*80}\n")

    return updated_count


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill missing images for reports")
    parser.add_argument("--limit", type=int, default=100, help="Max reports to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    args = parser.parse_args()

    count = backfill_missing_images(limit=args.limit, dry_run=args.dry_run)
    print(f"\nTotal reports updated: {count}")
