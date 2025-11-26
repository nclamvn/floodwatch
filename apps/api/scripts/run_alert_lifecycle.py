#!/usr/bin/env python3
"""
Alert Lifecycle Daily Job

Run this script daily (via cron) to:
1. Mark stale ACTIVE alerts as RESOLVED (no verification in 3 days)
2. Archive RESOLVED alerts that are 3+ days old

Usage:
    python scripts/run_alert_lifecycle.py [--dry-run]

Examples:
    # Dry run (preview changes without committing)
    python scripts/run_alert_lifecycle.py --dry-run

    # Run for real
    python scripts/run_alert_lifecycle.py

Cron example (run daily at 3 AM):
    0 3 * * * cd /app && python scripts/run_alert_lifecycle.py >> /var/log/alert_lifecycle.log 2>&1
"""

import sys
import os
import json
from datetime import datetime

# Add the app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.db import SessionLocal
from app.services.alert_lifecycle_service import AlertLifecycleService


def main():
    dry_run = "--dry-run" in sys.argv or "-n" in sys.argv

    print(f"\n{'='*60}")
    print(f"Alert Lifecycle Job - {datetime.now().isoformat()}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE'}")
    print(f"{'='*60}\n")

    db = SessionLocal()
    try:
        # Get pre-run stats
        print("Current lifecycle stats:")
        pre_stats = AlertLifecycleService.get_lifecycle_stats(db)
        for table, counts in pre_stats.items():
            print(f"  {table}: {counts['active']} active, {counts['resolved']} resolved, {counts['archived']} archived")

        print("\nRunning lifecycle transitions...")

        # Run the lifecycle job
        results = AlertLifecycleService.run_daily_lifecycle(db, dry_run=dry_run)

        # Print results
        print(f"\nResults:")
        print(f"  Road Segments: {results['road_segments']['resolved']} resolved, {results['road_segments']['archived']} archived")
        print(f"  Hazard Events: {results['hazard_events']['resolved']} resolved, {results['hazard_events']['archived']} archived")
        print(f"  Traffic Disruptions: {results['traffic_disruptions']['resolved']} resolved, {results['traffic_disruptions']['archived']} archived")
        print(f"  Road Events: {results['road_events']['resolved']} resolved, {results['road_events']['archived']} archived")

        print(f"\nTotals:")
        print(f"  Total resolved: {results['totals']['resolved']}")
        print(f"  Total archived: {results['totals']['archived']}")

        if dry_run:
            print("\n[DRY RUN] No changes committed. Run without --dry-run to apply.")
        else:
            print("\nChanges committed successfully.")

        # Get post-run stats
        if not dry_run:
            print("\nPost-run lifecycle stats:")
            post_stats = AlertLifecycleService.get_lifecycle_stats(db)
            for table, counts in post_stats.items():
                print(f"  {table}: {counts['active']} active, {counts['resolved']} resolved, {counts['archived']} archived")

        print(f"\n{'='*60}")
        print(f"Job completed at {results['completed_at']}")
        print(f"{'='*60}\n")

        return 0

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
