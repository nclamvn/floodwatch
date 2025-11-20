#!/usr/bin/env python3
"""
Daily Snapshot Generator

Generates a PDF snapshot of the day's flood reports at 23:55 daily.
Saved to: ops/snapshots/YYYY-MM-DD.pdf

Usage:
    python ops/cron/daily_snapshot.py

Crontab:
    55 23 * * * cd /opt/floodwatch && python ops/cron/daily_snapshot.py >> logs/snapshot.log 2>&1
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.models import Report
from app.services.report_repo import ReportRepository

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://fw_user:fw_password@localhost/floodwatch")
SNAPSHOTS_DIR = Path(__file__).parent.parent / "snapshots"
SNAPSHOTS_DIR.mkdir(exist_ok=True)


def generate_html_report(reports, date_str):
    """Generate HTML report for reports"""

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FloodWatch Daily Report - {date_str}</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
        }}
        body {{
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            font-size: 24pt;
        }}
        h2 {{
            color: #34495e;
            font-size: 16pt;
            margin-top: 20px;
            page-break-after: avoid;
        }}
        .summary {{
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }}
        .summary table {{
            width: 100%;
        }}
        .summary td {{
            padding: 5px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }}
        th {{
            background: #34495e;
            color: white;
            padding: 10px;
            text-align: left;
            font-size: 10pt;
        }}
        td {{
            padding: 8px;
            border-bottom: 1px solid #ddd;
            font-size: 9pt;
        }}
        tr:nth-child(even) {{
            background: #f8f9fa;
        }}
        .type-sos {{ color: #e74c3c; font-weight: bold; }}
        .type-alert {{ color: #e67e22; font-weight: bold; }}
        .type-road {{ color: #f39c12; font-weight: bold; }}
        .status-new {{ color: #e67e22; }}
        .status-verified {{ color: #27ae60; font-weight: bold; }}
        .status-resolved {{ color: #95a5a6; }}
        .footer {{
            margin-top: 30px;
            text-align: center;
            font-size: 9pt;
            color: #7f8c8d;
            border-top: 1px solid #bdc3c7;
            padding-top: 10px;
        }}
        .page-break {{
            page-break-before: always;
        }}
    </style>
</head>
<body>
    <h1>🌊 FloodWatch Daily Report</h1>
    <p><strong>Date:</strong> {date_str}</p>
    <p><strong>Generated:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>

    <div class="summary">
        <h2>Summary</h2>
        <table>
            <tr>
                <td><strong>Total Reports:</strong></td>
                <td>{len(reports)}</td>
                <td><strong>SOS Reports:</strong></td>
                <td>{sum(1 for r in reports if r.type.value == "SOS")}</td>
            </tr>
            <tr>
                <td><strong>Official Alerts:</strong></td>
                <td>{sum(1 for r in reports if r.type.value == "ALERT")}</td>
                <td><strong>Road Events:</strong></td>
                <td>{sum(1 for r in reports if r.type.value == "ROAD")}</td>
            </tr>
            <tr>
                <td><strong>Verified:</strong></td>
                <td>{sum(1 for r in reports if r.status == "verified")}</td>
                <td><strong>Resolved:</strong></td>
                <td>{sum(1 for r in reports if r.status == "resolved")}</td>
            </tr>
        </table>
    </div>

    <h2>All Reports</h2>
    <table>
        <thead>
            <tr>
                <th style="width: 12%">Time</th>
                <th style="width: 8%">Type</th>
                <th style="width: 10%">Source</th>
                <th style="width: 15%">Province</th>
                <th style="width: 40%">Title</th>
                <th style="width: 8%">Score</th>
                <th style="width: 7%">Status</th>
            </tr>
        </thead>
        <tbody>
"""

    # Add reports
    for report in reports:
        time_str = report.created_at.strftime("%H:%M") if report.created_at else "-"
        type_class = f"type-{report.type.value.lower()}"
        type_display = report.type.value
        status_class = f"status-{report.status}"
        title = report.title[:60] + "..." if len(report.title) > 60 else report.title

        html += f"""
            <tr>
                <td>{time_str}</td>
                <td class="{type_class}">{type_display}</td>
                <td>{report.source}</td>
                <td>{report.province or '-'}</td>
                <td>{title}</td>
                <td>{report.trust_score:.2f}</td>
                <td class="{status_class}">{report.status}</td>
            </tr>
        """

    html += """
        </tbody>
    </table>

    <div class="footer">
        <p>FloodWatch - Vietnam Flood Monitoring System</p>
        <p>This report is generated automatically daily at 23:55</p>
        <p>For more information: https://floodwatch.vn</p>
    </div>
</body>
</html>
"""

    return html


def generate_pdf(html_content, output_path):
    """
    Generate PDF from HTML content

    Uses weasyprint for HTML to PDF conversion
    Falls back to simple HTML save if weasyprint not available
    """
    try:
        from weasyprint import HTML
        HTML(string=html_content).write_pdf(output_path)
        print(f"✓ PDF generated with WeasyPrint: {output_path}")
        return True
    except ImportError:
        print("⚠ WeasyPrint not installed. Saving as HTML instead.")
        print("  Install: pip install weasyprint")

        # Fallback: save as HTML
        html_path = output_path.replace(".pdf", ".html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"✓ HTML saved: {html_path}")
        print("  Note: To generate PDF, install WeasyPrint")
        return False
    except Exception as e:
        print(f"✗ Error generating PDF: {e}")
        # Save HTML as fallback
        html_path = output_path.replace(".pdf", ".html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"✓ HTML fallback saved: {html_path}")
        return False


def main():
    """Generate daily snapshot PDF"""

    # Use yesterday's date (since this runs at 23:55)
    # Or use today if you want same-day snapshot
    snapshot_date = datetime.now().date()
    date_str = snapshot_date.strftime("%Y-%m-%d")

    print(f"=== FloodWatch Daily Snapshot Generator ===")
    print(f"Date: {date_str}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")

    # Connect to database
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        print("✓ Connected to database")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        sys.exit(1)

    # Get today's reports
    try:
        reports, total = ReportRepository.get_all(
            db=db,
            since="24h",
            limit=1000,
            offset=0
        )
        print(f"✓ Retrieved {total} reports from today")
    except Exception as e:
        print(f"✗ Failed to fetch reports: {e}")
        db.close()
        sys.exit(1)

    if total == 0:
        print("⚠ No reports found for today. Skipping PDF generation.")
        db.close()
        return

    # Generate HTML
    try:
        html_content = generate_html_report(reports, date_str)
        print(f"✓ Generated HTML report ({len(html_content)} bytes)")
    except Exception as e:
        print(f"✗ Failed to generate HTML: {e}")
        db.close()
        sys.exit(1)

    # Generate PDF
    output_path = SNAPSHOTS_DIR / f"{date_str}.pdf"
    try:
        success = generate_pdf(html_content, str(output_path))
        if success:
            print(f"\n✓ Daily snapshot saved: {output_path}")
            print(f"  Size: {output_path.stat().st_size / 1024:.1f} KB")
        else:
            print(f"\n⚠ PDF generation failed, but HTML saved as fallback")
    except Exception as e:
        print(f"✗ Failed to save snapshot: {e}")
        db.close()
        sys.exit(1)

    # Cleanup old snapshots (keep last 30 days)
    try:
        cutoff_date = datetime.now() - timedelta(days=30)
        deleted_count = 0

        for snapshot_file in SNAPSHOTS_DIR.glob("*.pdf"):
            try:
                file_date = datetime.strptime(snapshot_file.stem, "%Y-%m-%d")
                if file_date < cutoff_date:
                    snapshot_file.unlink()
                    deleted_count += 1
            except (ValueError, OSError):
                continue

        if deleted_count > 0:
            print(f"✓ Cleaned up {deleted_count} old snapshot(s) (>30 days)")

    except Exception as e:
        print(f"⚠ Cleanup warning: {e}")

    db.close()
    print("\n=== Snapshot generation complete ===")


if __name__ == "__main__":
    main()
