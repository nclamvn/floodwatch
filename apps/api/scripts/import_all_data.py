#!/usr/bin/env python3
"""
Import all data (help + routes) to production database.
Run this script on Render after deployment.
"""
import os
import sys

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

# Fix postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL)
script_dir = os.path.dirname(os.path.abspath(__file__))

def import_sql_file(filename, description):
    sql_file = os.path.join(script_dir, filename)

    if not os.path.exists(sql_file):
        print(f"WARNING: {filename} not found, skipping {description}")
        return False

    print(f"\n{'='*50}")
    print(f"Importing {description}...")
    print(f"Reading SQL from: {sql_file}")

    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    statements = [s.strip() for s in sql_content.split(';') if s.strip()]
    print(f"Found {len(statements)} SQL statements")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            executed = 0
            for i, stmt in enumerate(statements):
                if stmt and not stmt.startswith('--') and not stmt.startswith('SET ') and not stmt.startswith('SELECT pg_catalog'):
                    if stmt.startswith('INSERT') or stmt.startswith('DELETE'):
                        conn.execute(text(stmt))
                        executed += 1
                        if executed % 100 == 0:
                            print(f"Executed {executed} statements...")

            trans.commit()
            print(f"✓ {description} imported successfully! ({executed} statements)")
            return True

        except Exception as e:
            trans.rollback()
            print(f"✗ Error importing {description}: {e}")
            return False

# Import all data files
print("="*50)
print("PRODUCTION DATA IMPORT")
print("="*50)

import_sql_file("help_data_import.sql", "Help Requests & Offers")
import_sql_file("routes_data_import.sql", "Routes & Traffic Data")

# Verify final counts
print("\n" + "="*50)
print("FINAL DATA COUNTS:")
print("="*50)

with engine.connect() as conn:
    tables = [
        ("help_requests", "SELECT COUNT(*) FROM help_requests"),
        ("help_offers", "SELECT COUNT(*) FROM help_offers"),
        ("road_segments", "SELECT COUNT(*) FROM road_segments"),
        ("road_events", "SELECT COUNT(*) FROM road_events"),
        ("traffic_disruptions", "SELECT COUNT(*) FROM traffic_disruptions"),
    ]

    for table_name, query in tables:
        try:
            result = conn.execute(text(query))
            count = result.scalar()
            print(f"  {table_name}: {count} records")
        except Exception as e:
            print(f"  {table_name}: ERROR - {e}")

print("\n✓ Import complete!")
