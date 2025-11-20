# FloodWatch Daily Snapshots

**PR-23: Daily PDF Snapshot Generation**
**Date:** 2025-11-01

---

## Overview

FloodWatch generates a PDF snapshot of each day's flood reports at 23:55. These snapshots provide a permanent record for historical analysis and compliance.

---

## Features

- **Automatic Daily Generation:** Runs at 23:55 every night
- **Summary Statistics:** Total reports, SOS count, verified count, etc.
- **Complete Report List:** All reports from the day with key details
- **Retention:** Keeps last 30 days, auto-deletes older snapshots
- **Fallback:** Saves HTML if PDF generation fails

---

## File Locations

**Snapshots Directory:**
```
ops/snapshots/
├── 2025-11-01.pdf
├── 2025-11-02.pdf
├── 2025-11-03.pdf
└── ...
```

**Generator Script:**
```
ops/cron/daily_snapshot.py
```

---

## Endpoints

### GET /reports/today

Preview today's report in browser (same format as PDF snapshot).

**URL:**
```
http://localhost:8000/reports/today
```

**Features:**
- Print-friendly layout
- One-click print/PDF button
- Summary statistics at top
- All reports in table format
- Updates in real-time (unlike snapshot)

**Example:**
```bash
# Preview in browser
open http://localhost:8000/reports/today

# Save as PDF from browser
# Chrome: File → Print → Save as PDF
# Firefox: File → Print → Save to PDF
```

---

## Setup

### 1. Install PDF Generation Library

The snapshot generator uses WeasyPrint for HTML-to-PDF conversion.

**Install:**
```bash
# Activate venv
cd /opt/floodwatch/apps/api
source venv/bin/activate

# Install WeasyPrint
pip install weasyprint

# Update requirements.txt
pip freeze > requirements.txt
```

**Dependencies (Debian/Ubuntu):**
```bash
sudo apt-get install -y \
  libpango-1.0-0 \
  libharfbuzz0b \
  libpangoft2-1.0-0 \
  libffi-dev \
  libjpeg-dev \
  libopenjp2-7-dev \
  python3-dev
```

**Without WeasyPrint:**
If WeasyPrint is not installed, the script falls back to saving HTML files instead of PDF.

---

### 2. Configure Cron Job

Add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 23:55)
55 23 * * * cd /opt/floodwatch && /opt/floodwatch/apps/api/venv/bin/python ops/cron/daily_snapshot.py >> logs/snapshot.log 2>&1
```

**With Docker:**
```bash
# Add to docker-compose.prod.yml
services:
  api:
    # ... existing config
    volumes:
      - ./ops:/app/ops
      - ./logs:/app/logs

# Then exec into container and set up cron
docker-compose exec api crontab -e
# Add same cron line as above
```

---

## Manual Execution

### Generate Snapshot Manually

```bash
cd /opt/floodwatch

# Run snapshot generator
python ops/cron/daily_snapshot.py
```

**Example Output:**
```
=== FloodWatch Daily Snapshot Generator ===
Date: 2025-11-01
Time: 2025-11-01 23:55:32

✓ Connected to database
✓ Retrieved 234 reports from today
✓ Generated HTML report (45230 bytes)
✓ PDF generated with WeasyPrint: ops/snapshots/2025-11-01.pdf
  Size: 127.3 KB
✓ Cleaned up 5 old snapshot(s) (>30 days)

=== Snapshot generation complete ===
```

---

## PDF Content

### Header Section

```
🌊 FloodWatch Daily Report
Date: 2025-11-01
Generated: 2025-11-01 23:55:32
```

### Summary Statistics

| Metric | Value |
|--------|-------|
| Total Reports | 234 |
| SOS Reports | 45 |
| Official Alerts | 23 |
| Road Events | 89 |
| Verified | 156 |
| Resolved | 67 |

### Report Table

| Time | Type | Source | Province | Title | Score | Status |
|------|------|--------|----------|-------|-------|--------|
| 08:15 | SOS | community | Quảng Bình | Nước ngập nhanh khu vực... | 0.85 | verified |
| 09:30 | ALERT | KTTV | Quảng Trị | Cảnh báo lũ cấp 3... | 0.92 | verified |
| ... | ... | ... | ... | ... | ... | ... |

### Footer

```
FloodWatch - Vietnam Flood Monitoring System
This report is generated automatically daily at 23:55
https://floodwatch.vn
```

---

## Monitoring

### Check Cron Logs

```bash
# View snapshot generation logs
tail -f /opt/floodwatch/logs/snapshot.log

# Check last 10 runs
tail -50 /opt/floodwatch/logs/snapshot.log | grep "==="
```

### Verify Snapshots

```bash
# List all snapshots
ls -lh /opt/floodwatch/ops/snapshots/

# Count snapshots
ls /opt/floodwatch/ops/snapshots/*.pdf | wc -l

# Find missing days
for i in {1..30}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  if [ ! -f "/opt/floodwatch/ops/snapshots/$date.pdf" ]; then
    echo "Missing: $date"
  fi
done
```

### Check PDF Size

```bash
# Average PDF size
du -sh /opt/floodwatch/ops/snapshots/*.pdf | awk '{sum+=$1; count++} END {print sum/count " KB average"}'

# Largest PDFs (days with many reports)
du -h /opt/floodwatch/ops/snapshots/*.pdf | sort -h | tail -10
```

---

## Troubleshooting

### PDF Generation Fails

**Error:** `ImportError: No module named 'weasyprint'`

**Solution:**
```bash
cd /opt/floodwatch/apps/api
source venv/bin/activate
pip install weasyprint
```

---

### Cron Job Not Running

**Check crontab:**
```bash
crontab -l | grep snapshot
```

**Check cron service:**
```bash
# Check if cron is running
systemctl status cron  # Debian/Ubuntu
systemctl status crond # CentOS/RHEL

# View cron logs
grep CRON /var/log/syslog | tail -20
```

**Test manually:**
```bash
cd /opt/floodwatch
python ops/cron/daily_snapshot.py
```

---

### Empty PDFs (No Reports)

If a day has zero reports, the script skips PDF generation:

```
⚠ No reports found for today. Skipping PDF generation.
```

This is normal for very quiet days.

---

### Old Snapshots Not Deleted

The script auto-deletes snapshots older than 30 days. Check logs:

```bash
grep "Cleaned up" /opt/floodwatch/logs/snapshot.log
```

If cleanup fails, manually delete:
```bash
find /opt/floodwatch/ops/snapshots -name "*.pdf" -mtime +30 -delete
```

---

## Storage Requirements

### Disk Space

| Reports/Day | PDF Size | Monthly Storage |
|-------------|----------|-----------------|
| 50 reports | ~50 KB | ~1.5 MB |
| 200 reports | ~120 KB | ~3.6 MB |
| 500 reports | ~250 KB | ~7.5 MB |

**Retention (30 days):**
- Low traffic: ~45 MB
- Medium traffic: ~108 MB
- High traffic: ~225 MB

**Recommendation:** Allocate 500 MB for snapshots directory

---

## Backup & Export

### Backup Snapshots

Include in daily backup script:

```bash
# Add to infra/scripts/prod_backup.sh
SNAPSHOT_DIR="/opt/floodwatch/ops/snapshots"
BACKUP_DIR="/backups/snapshots"

# Backup snapshots
if [ -d "$SNAPSHOT_DIR" ]; then
  tar -czf "$BACKUP_DIR/snapshots-$(date +%Y%m%d).tar.gz" "$SNAPSHOT_DIR"
  echo "✓ Snapshots backed up"
fi
```

### Download Snapshots

```bash
# Download all snapshots from server
scp -r user@floodwatch.vn:/opt/floodwatch/ops/snapshots ./local-snapshots/

# Download specific date
scp user@floodwatch.vn:/opt/floodwatch/ops/snapshots/2025-11-01.pdf ./
```

### Archive to Cloud

```bash
# Upload to S3 (example)
aws s3 sync /opt/floodwatch/ops/snapshots s3://floodwatch-snapshots/

# Upload to Google Drive (using rclone)
rclone copy /opt/floodwatch/ops/snapshots gdrive:FloodWatch/Snapshots/
```

---

## Custom PDF Generation

### Generate for Specific Date

Modify `daily_snapshot.py`:

```python
# Change this line:
snapshot_date = datetime.now().date()

# To specific date:
snapshot_date = datetime(2025, 10, 15).date()
```

Then run manually:
```bash
python ops/cron/daily_snapshot.py
```

### Generate Weekly Report

Create new script `ops/cron/weekly_snapshot.py`:

```python
# Get last 7 days of reports
reports, total = ReportRepository.get_all(
    db=db,
    since="7d",
    limit=5000,
    offset=0
)

date_str = f"Week-{datetime.now().strftime('%Y-W%W')}"
output_path = SNAPSHOTS_DIR / f"{date_str}.pdf"
```

---

## Metrics

Track snapshot generation in Prometheus metrics:

```python
# In daily_snapshot.py, add:
from app.monitoring.metrics import metrics

try:
    generate_pdf(html_content, output_path)
    metrics.record_cron_run("daily_snapshot", "success")
except Exception as e:
    metrics.record_cron_run("daily_snapshot", "failed")
    raise
```

Then monitor via Prometheus:
```promql
# Snapshot generation rate
rate(cron_runs_total{job="daily_snapshot",status="success"}[24h])

# Failure rate
rate(cron_runs_total{job="daily_snapshot",status="failed"}[24h])
```

---

## Future Enhancements

- [ ] Email snapshots to stakeholders
- [ ] Generate monthly summary PDFs
- [ ] Add charts/graphs to PDF (reports by province, types over time)
- [ ] Compress old PDFs (>30 days) to save space
- [ ] Generate Excel exports alongside PDF
- [ ] Add QR code to PDF linking back to web dashboard

---

## References

- [WeasyPrint Documentation](https://doc.courtbouillon.org/weasyprint/)
- [Cron Best Practices](https://crontab.guru/)
- [PDF Generation Tips](https://weasyprint.org/samples/)

---

**Document Owner:** Operations Team
**Review Schedule:** Quarterly
**Last Updated:** 2025-11-01
