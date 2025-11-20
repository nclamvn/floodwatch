#!/usr/bin/env python3
"""
Performance Analysis Script
Runs EXPLAIN ANALYZE on common queries before/after indexing
"""

import os
import sys
import time
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../apps/api'))

from app.database import get_db_context


QUERIES = {
    "Q1: Recent reports by province": """
        SELECT id, type, title, province, trust_score, created_at
        FROM reports
        WHERE province = 'Quảng Bình'
        AND created_at > NOW() - INTERVAL '6 hours'
        ORDER BY created_at DESC
        LIMIT 50;
    """,

    "Q2: Reports by province + type + time": """
        SELECT id, type, title, province, trust_score, created_at
        FROM reports
        WHERE province = 'Quảng Trị'
        AND type = 'SOS'
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 50;
    """,

    "Q3: Verified reports only": """
        SELECT id, type, title, province, trust_score, created_at
        FROM reports
        WHERE status = 'verified'
        ORDER BY created_at DESC
        LIMIT 100;
    """,

    "Q4: High-trust reports": """
        SELECT id, type, title, province, trust_score, created_at
        FROM reports
        WHERE trust_score >= 0.7
        ORDER BY trust_score DESC, created_at DESC
        LIMIT 50;
    """,

    "Q5: Road events by province + status": """
        SELECT id, segment_name, status, province, last_verified
        FROM road_events
        WHERE province = 'Đà Nẵng'
        AND status = 'CLOSED'
        ORDER BY last_verified DESC
        LIMIT 50;
    """,

    "Q6: CSV export query (full scan)": """
        SELECT id, created_at, type, source, title, province, trust_score, status
        FROM reports
        WHERE created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 1000;
    """
}


def run_explain_analyze(db, query_name, query):
    """Run EXPLAIN ANALYZE and return results"""
    print(f"\n{'='*60}")
    print(f"Query: {query_name}")
    print(f"{'='*60}")

    # Run EXPLAIN ANALYZE
    explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"

    try:
        result = db.execute(explain_query)
        plan = result.fetchone()[0]

        # Extract key metrics
        if plan and len(plan) > 0:
            root_plan = plan[0]
            execution_time = root_plan.get('Execution Time', 0)
            planning_time = root_plan.get('Planning Time', 0)
            total_time = execution_time + planning_time

            print(f"Planning Time: {planning_time:.2f} ms")
            print(f"Execution Time: {execution_time:.2f} ms")
            print(f"Total Time: {total_time:.2f} ms")

            # Extract node info
            if 'Plan' in root_plan:
                node = root_plan['Plan']
                print(f"Node Type: {node.get('Node Type', 'Unknown')}")

                if 'Index Name' in node:
                    print(f"Index Used: {node['Index Name']}")
                else:
                    print("Index Used: None (Sequential Scan)")

                if 'Actual Rows' in node:
                    print(f"Rows Returned: {node['Actual Rows']}")

            return {
                'planning_time': planning_time,
                'execution_time': execution_time,
                'total_time': total_time
            }

    except Exception as e:
        print(f"Error: {e}")
        return None


def main():
    print("="*60)
    print("FloodWatch Performance Analysis")
    print("="*60)
    print(f"Date: {datetime.now().isoformat()}")
    print()

    results = {}

    with get_db_context() as db:
        # Check if indexes exist
        index_check = db.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'reports'
            AND indexname LIKE 'idx_%';
        """).fetchall()

        print("\nCurrent Indexes on 'reports' table:")
        if index_check:
            for idx in index_check:
                print(f"  - {idx[0]}")
        else:
            print("  (No custom indexes found)")

        print("\nRunning EXPLAIN ANALYZE on common queries...")
        print("(This will take a few moments...)")

        for query_name, query in QUERIES.items():
            metrics = run_explain_analyze(db, query_name, query)
            if metrics:
                results[query_name] = metrics

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"{'Query':<50} {'Total (ms)':<12} {'Status'}")
    print("-"*60)

    for query_name, metrics in results.items():
        total_time = metrics['total_time']
        status = "✅ Fast" if total_time < 100 else "⚠️  Slow" if total_time < 200 else "🚨 Very Slow"
        print(f"{query_name:<50} {total_time:>10.2f} ms  {status}")

    # Overall assessment
    print("\n" + "="*60)
    avg_time = sum(m['total_time'] for m in results.values()) / len(results)
    print(f"Average Query Time: {avg_time:.2f} ms")

    if avg_time < 100:
        print("Status: ✅ Excellent - All queries under 100ms")
    elif avg_time < 150:
        print("Status: ⚠️  Good - Most queries acceptable")
    else:
        print("Status: 🚨 Needs Optimization - Consider adding indexes")

    print("\nRecommendations:")
    if avg_time >= 100:
        print("  1. Run migration 005_performance_indexes.py")
        print("  2. Re-run this script to verify improvements")
        print("  3. Consider additional indexes based on query patterns")
    else:
        print("  Performance is good! Monitor with:")
        print("  - pg_stat_statements extension")
        print("  - Regular VACUUM ANALYZE")

    print("\n" + "="*60)


if __name__ == "__main__":
    main()
