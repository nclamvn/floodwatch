#!/usr/bin/env python3
"""
Quick fix script for incorrect road names in database.

Run this script directly to fix known incorrect road names:
    python scripts/fix_road_names.py

This script can be run multiple times safely (idempotent).
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from datetime import datetime

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://floodwatch:floodwatch@localhost:5432/floodwatch"
)

# Known corrections: {incorrect_name: {correct_name, lat, lon, province, district}}
ROAD_NAME_CORRECTIONS = {
    # Đèo Nhông was incorrectly called "Đèo Phù Mỹ"
    "Đèo Phù Mỹ": {
        "correct_name": "Đèo Nhông",
        "lat": 14.0847,
        "lon": 108.9203,
        "province": "Bình Định",
        "district": "Phù Mỹ",
        "note": "Pass in Phù Mỹ district, often confused due to district name"
    },

    # Add more corrections as discovered
    # "Incorrect Name": {
    #     "correct_name": "Correct Name",
    #     "lat": 0.0,
    #     "lon": 0.0,
    #     "province": "Province",
    #     "district": "District"
    # },
}


def fix_road_events(engine, incorrect: str, correction: dict) -> int:
    """Fix road_events table"""
    with engine.connect() as conn:
        result = conn.execute(text("""
            UPDATE road_events
            SET
                segment_name = :correct_name,
                lat = :lat,
                lon = :lon,
                province = :province,
                district = :district,
                updated_at = :now
            WHERE
                LOWER(segment_name) LIKE :pattern1
                OR LOWER(segment_name) LIKE :pattern2
            RETURNING id
        """), {
            "correct_name": correction["correct_name"],
            "lat": correction["lat"],
            "lon": correction["lon"],
            "province": correction["province"],
            "district": correction.get("district", ""),
            "now": datetime.utcnow(),
            "pattern1": f"%{incorrect.lower()}%",
            "pattern2": f"%{incorrect.lower().replace(' ', '')}%"
        })
        conn.commit()
        return result.rowcount


def fix_road_segments(engine, incorrect: str, correction: dict) -> int:
    """Fix road_segments table (Routes 2.0)"""
    with engine.connect() as conn:
        # First check if table exists
        check = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'road_segments'
            )
        """))
        if not check.scalar():
            return 0

        result = conn.execute(text("""
            UPDATE road_segments
            SET
                segment_name = :correct_name,
                start_lat = :lat,
                start_lon = :lon,
                province = :province,
                district = :district,
                normalized_name = :normalized,
                updated_at = :now
            WHERE
                LOWER(segment_name) LIKE :pattern1
                OR LOWER(segment_name) LIKE :pattern2
                OR LOWER(normalized_name) LIKE :pattern3
            RETURNING id
        """), {
            "correct_name": correction["correct_name"],
            "lat": correction["lat"],
            "lon": correction["lon"],
            "province": correction["province"],
            "district": correction.get("district", ""),
            "normalized": correction["correct_name"].lower().replace("đ", "d").replace("ê", "e").replace("ô", "o"),
            "now": datetime.utcnow(),
            "pattern1": f"%{incorrect.lower()}%",
            "pattern2": f"%{incorrect.lower().replace(' ', '')}%",
            "pattern3": f"%{incorrect.lower().replace('đ', 'd').replace('è', 'e').replace('ù', 'u')}%"
        })
        conn.commit()
        return result.rowcount


def fix_traffic_disruptions(engine, incorrect: str, correction: dict) -> int:
    """Fix traffic_disruptions table"""
    with engine.connect() as conn:
        result = conn.execute(text("""
            UPDATE traffic_disruptions
            SET
                location = REPLACE(location, :incorrect, :correct_name),
                updated_at = :now
            WHERE
                LOWER(location) LIKE :pattern
            RETURNING id
        """), {
            "incorrect": incorrect,
            "correct_name": correction["correct_name"],
            "now": datetime.utcnow(),
            "pattern": f"%{incorrect.lower()}%"
        })
        conn.commit()
        return result.rowcount


def main():
    print("=" * 60)
    print("Road Name Correction Script")
    print("=" * 60)
    print()

    try:
        engine = create_engine(DATABASE_URL)

        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"✅ Connected to database")
        print()
    except Exception as e:
        print(f"❌ Could not connect to database: {e}")
        print(f"   DATABASE_URL: {DATABASE_URL[:50]}...")
        sys.exit(1)

    total_fixed = 0

    for incorrect_name, correction in ROAD_NAME_CORRECTIONS.items():
        print(f"🔄 Fixing: '{incorrect_name}' -> '{correction['correct_name']}'")

        if correction.get("note"):
            print(f"   Note: {correction['note']}")

        # Fix each table
        try:
            count1 = fix_road_events(engine, incorrect_name, correction)
            print(f"   • road_events: {count1} rows updated")
        except Exception as e:
            print(f"   • road_events: Error - {e}")
            count1 = 0

        try:
            count2 = fix_road_segments(engine, incorrect_name, correction)
            print(f"   • road_segments: {count2} rows updated")
        except Exception as e:
            print(f"   • road_segments: Error - {e}")
            count2 = 0

        try:
            count3 = fix_traffic_disruptions(engine, incorrect_name, correction)
            print(f"   • traffic_disruptions: {count3} rows updated")
        except Exception as e:
            print(f"   • traffic_disruptions: Error - {e}")
            count3 = 0

        subtotal = count1 + count2 + count3
        total_fixed += subtotal
        print(f"   ✅ Subtotal: {subtotal} rows fixed")
        print()

    print("=" * 60)
    print(f"✅ COMPLETE: {total_fixed} total rows fixed")
    print("=" * 60)


if __name__ == "__main__":
    main()
