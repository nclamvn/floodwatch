#!/usr/bin/env python3
"""
Import help_requests and help_offers from JSON file.
Run on Render: python apps/api/scripts/import_help_json.py
"""

import os
import json
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from datetime import datetime

def convert_value(key, value):
    """Convert value to appropriate type for PostgreSQL"""
    if value is None:
        return None

    # Convert list/array to JSON string for jsonb columns
    if key == 'images' and isinstance(value, list):
        return json.dumps(value)

    return value

def main():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    # Load JSON data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "help_data.json")

    if not os.path.exists(json_path):
        print(f"ERROR: {json_path} not found")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    help_requests = data.get("help_requests", [])
    help_offers = data.get("help_offers", [])

    print(f"Loaded {len(help_requests)} help_requests")
    print(f"Loaded {len(help_offers)} help_offers")

    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Clear existing data
        print("\nClearing existing data...")
        conn.execute(text("DELETE FROM help_requests"))
        conn.execute(text("DELETE FROM help_offers"))
        conn.commit()

        # Import help_requests one by one with individual transactions
        print("\nImporting help_requests...")
        success_count = 0
        error_count = 0

        for record in help_requests:
            try:
                # Build column names and placeholders
                columns = []
                values = {}

                for key, value in record.items():
                    converted = convert_value(key, value)
                    if converted is not None:
                        columns.append(key)
                        # For images column, cast to jsonb
                        if key == 'images':
                            values[key] = converted
                        else:
                            values[key] = converted

                if columns:
                    cols_str = ", ".join(columns)
                    # Use ::jsonb cast for images column
                    placeholders = ", ".join(
                        f":{col}::jsonb" if col == 'images' else f":{col}"
                        for col in columns
                    )

                    sql = f"INSERT INTO help_requests ({cols_str}) VALUES ({placeholders})"
                    conn.execute(text(sql), values)
                    conn.commit()  # Commit each record individually
                    success_count += 1

            except Exception as e:
                conn.rollback()  # Rollback failed transaction
                error_count += 1
                if error_count <= 5:
                    print(f"  Error inserting request {record.get('id', 'unknown')}: {str(e)[:100]}")

        print(f"  Imported {success_count} help_requests ({error_count} errors)")

        # Import help_offers
        print("\nImporting help_offers...")
        success_count = 0
        error_count = 0

        for record in help_offers:
            try:
                columns = []
                values = {}

                for key, value in record.items():
                    converted = convert_value(key, value)
                    if converted is not None:
                        columns.append(key)
                        values[key] = converted

                if columns:
                    cols_str = ", ".join(columns)
                    placeholders = ", ".join(
                        f":{col}::jsonb" if col == 'images' else f":{col}"
                        for col in columns
                    )

                    sql = f"INSERT INTO help_offers ({cols_str}) VALUES ({placeholders})"
                    conn.execute(text(sql), values)
                    conn.commit()  # Commit each record individually
                    success_count += 1

            except Exception as e:
                conn.rollback()  # Rollback failed transaction
                error_count += 1
                if error_count <= 5:
                    print(f"  Error inserting offer {record.get('id', 'unknown')}: {str(e)[:100]}")

        print(f"  Imported {success_count} help_offers ({error_count} errors)")

        # Verify counts
        result = conn.execute(text("SELECT COUNT(*) FROM help_requests"))
        req_count = result.scalar()

        result = conn.execute(text("SELECT COUNT(*) FROM help_offers"))
        offer_count = result.scalar()

        print(f"\nFinal counts:")
        print(f"  help_requests: {req_count}")
        print(f"  help_offers: {offer_count}")
        print("\nDone!")

if __name__ == "__main__":
    main()
