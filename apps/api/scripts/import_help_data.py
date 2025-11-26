#!/usr/bin/env python3
"""
Import full help_requests and help_offers data to production database.
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

# Read SQL file
script_dir = os.path.dirname(os.path.abspath(__file__))
sql_file = os.path.join(script_dir, "help_data_import.sql")

if not os.path.exists(sql_file):
    print(f"ERROR: SQL file not found: {sql_file}")
    sys.exit(1)

print(f"Reading SQL from: {sql_file}")
with open(sql_file, 'r', encoding='utf-8') as f:
    sql_content = f.read()

# Split into statements and execute
statements = [s.strip() for s in sql_content.split(';') if s.strip()]
print(f"Found {len(statements)} SQL statements")

with engine.connect() as conn:
    trans = conn.begin()
    try:
        for i, stmt in enumerate(statements):
            if stmt and not stmt.startswith('--') and not stmt.startswith('SET ') and not stmt.startswith('SELECT pg_catalog'):
                if stmt.startswith('INSERT') or stmt.startswith('DELETE'):
                    conn.execute(text(stmt))
                    if i % 100 == 0:
                        print(f"Executed {i}/{len(statements)} statements...")
        
        trans.commit()
        print("Import completed successfully!")
        
        # Verify counts
        result = conn.execute(text("SELECT COUNT(*) FROM help_requests"))
        print(f"help_requests: {result.scalar()} records")
        
        result = conn.execute(text("SELECT COUNT(*) FROM help_offers"))
        print(f"help_offers: {result.scalar()} records")
        
    except Exception as e:
        trans.rollback()
        print(f"Error: {e}")
        raise

