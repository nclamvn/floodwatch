# FloodWatch Metrics & Monitoring

**PR-22: Prometheus Metrics Endpoint**
**Date:** 2025-11-01

---

## Overview

FloodWatch exposes application metrics in Prometheus format for monitoring and alerting. The `/metrics` endpoint provides real-time performance and operational metrics.

---

## Accessing Metrics

**Endpoint:** `GET /metrics`

**Authentication:** Requires `ADMIN_TOKEN` query parameter

**Example:**
```bash
curl "http://localhost:8000/metrics?token=YOUR_ADMIN_TOKEN"
```

**Response Format:** Prometheus text exposition format (text/plain)

---

## Available Metrics

### HTTP Request Metrics

#### `http_requests_total`
**Type:** Counter
**Labels:** `method`, `path`, `status`
**Description:** Total number of HTTP requests by method, path, and status code

**Example:**
```prometheus
http_requests_total{method="GET",path="/reports",status="200"} 1523
http_requests_total{method="GET",path="/api/v1/reports",status="200"} 892
http_requests_total{method="POST",path="/ops/verify/{id}",status="303"} 45
```

#### `http_request_duration_milliseconds`
**Type:** Summary
**Labels:** `method`, `path`
**Description:** HTTP request duration in milliseconds

**Metrics:**
- `http_request_duration_milliseconds_sum` - Total cumulative duration
- `http_request_duration_milliseconds_count` - Total request count
- `http_request_duration_milliseconds_avg` - Average duration

**Example:**
```prometheus
http_request_duration_milliseconds_sum{method="GET",path="/reports"} 45230.50
http_request_duration_milliseconds_count{method="GET",path="/reports"} 1523
http_request_duration_milliseconds_avg{method="GET",path="/reports"} 29.70
```

---

### Report Metrics

#### `reports_total`
**Type:** Counter
**Labels:** `type`, `source`, `status`
**Description:** Total reports created by type, source, and status

**Example:**
```prometheus
reports_total{type="SOS",source="community",status="new"} 234
reports_total{type="ALERT",source="KTTV",status="verified"} 156
reports_total{type="ROAD",source="community",status="resolved"} 89
```

#### `reports_by_status_current`
**Type:** Gauge
**Labels:** `status`
**Description:** Current number of reports in each status

**Example:**
```prometheus
reports_by_status_current{status="new"} 45
reports_by_status_current{status="verified"} 123
reports_by_status_current{status="resolved"} 567
reports_by_status_current{status="invalid"} 12
```

---

### Cron Job Metrics

#### `cron_runs_total`
**Type:** Counter
**Labels:** `job`, `status`
**Description:** Total cron job executions by job name and status

**Example:**
```prometheus
cron_runs_total{job="kttv_scraper",status="success"} 145
cron_runs_total{job="kttv_scraper",status="failed"} 2
cron_runs_total{job="alerts_dispatcher",status="success"} 289
```

#### `last_scraper_run_timestamp_seconds`
**Type:** Gauge
**Labels:** `job`
**Description:** Unix timestamp of last successful scraper run

**Example:**
```prometheus
last_scraper_run_timestamp_seconds{job="kttv_scraper"} 1730476800
last_scraper_run_timestamp_seconds{job="alerts_dispatcher"} 1730476920
```

---

### Database Metrics

#### `db_queries_total`
**Type:** Counter
**Labels:** `type`
**Description:** Total database queries by type

**Example:**
```prometheus
db_queries_total{type="reports_get_all"} 2341
db_queries_total{type="reports_create"} 456
db_queries_total{type="road_events_update"} 123
```

#### `db_query_duration_milliseconds`
**Type:** Summary
**Labels:** `type`
**Description:** Database query duration in milliseconds

**Example:**
```prometheus
db_query_duration_milliseconds_sum{type="reports_get_all"} 12340.25
db_query_duration_milliseconds_avg{type="reports_get_all"} 5.27
```

---

## Prometheus Configuration

### Scrape Config

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'floodwatch-api'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    params:
      token: ['YOUR_ADMIN_TOKEN']  # WARNING: Use Prometheus secrets management!
    static_configs:
      - targets: ['localhost:8000']
        labels:
          service: 'floodwatch'
          environment: 'production'
```

### Secure Token Management

**Option 1: Environment Variable**
```yaml
scrape_configs:
  - job_name: 'floodwatch-api'
    params:
      token: ['${FLOODWATCH_ADMIN_TOKEN}']
```

Then run Prometheus with:
```bash
export FLOODWATCH_ADMIN_TOKEN="your_token"
prometheus --config.file=prometheus.yml
```

**Option 2: File-based Secret**
```yaml
scrape_configs:
  - job_name: 'floodwatch-api'
    file_sd_configs:
      - files:
        - '/etc/prometheus/floodwatch-targets.json'
```

`/etc/prometheus/floodwatch-targets.json`:
```json
[
  {
    "targets": ["localhost:8000"],
    "labels": {
      "service": "floodwatch"
    },
    "params": {
      "token": ["your_admin_token"]
    }
  }
]
```

---

## Alert Rules

### High Error Rate

```yaml
groups:
  - name: floodwatch_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on FloodWatch API"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
```

### Slow Response Time

```yaml
      - alert: SlowResponseTime
        expr: |
          (
            http_request_duration_milliseconds_avg{path="/reports"}
            > 200
          )
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time on /reports"
          description: "Average response time is {{ $value }}ms (threshold: 200ms)"
```

### Scraper Failure

```yaml
      - alert: ScraperNotRunning
        expr: |
          (time() - last_scraper_run_timestamp_seconds{job="kttv_scraper"}) > 3600
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "KTTV scraper has not run in over 1 hour"
          description: "Last successful run was {{ $value | humanizeDuration }} ago"
```

### High Report Queue

```yaml
      - alert: HighNewReportsQueue
        expr: reports_by_status_current{status="new"} > 100
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High number of unverified reports"
          description: "{{ $value }} reports waiting for verification"
```

---

## Grafana Dashboards

### Example Dashboard Panels

#### Request Rate
```promql
# QPS (queries per second)
rate(http_requests_total[5m])

# By endpoint
sum(rate(http_requests_total[5m])) by (path)
```

#### Response Time
```promql
# p95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_milliseconds_bucket[5m])) by (le, path)
)

# Average latency by endpoint
http_request_duration_milliseconds_avg
```

#### Error Rate
```promql
# Error percentage
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
* 100
```

#### Reports Created
```promql
# Reports per hour
sum(rate(reports_total[1h])) * 3600

# By type
sum(rate(reports_total[1h])) by (type) * 3600
```

#### System Health
```promql
# Reports awaiting verification
reports_by_status_current{status="new"}

# Scraper health (minutes since last run)
(time() - last_scraper_run_timestamp_seconds) / 60
```

---

## Monitoring Best Practices

### 1. Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| p95 latency | > 200ms | > 500ms |
| New reports queue | > 50 | > 100 |
| Scraper lag | > 30min | > 1hr |

### 2. Retention

- **Short-term (15s scrape):** 15 days
- **Long-term (5m average):** 1 year

### 3. Cardinality Management

The metrics system normalizes paths to prevent high cardinality:
- UUID paths: `/ops/verify/abc-123` → `/ops/verify/{id}`
- Query params: `/reports?province=X` → `/reports`

**Estimated series:** ~500 total metrics

### 4. Performance Impact

- Metrics collection adds < 1ms per request
- Memory overhead: ~50MB
- CPU overhead: < 1%

---

## Troubleshooting

### Metrics Not Updating

**Check middleware is registered:**
```bash
curl http://localhost:8000/health
curl "http://localhost:8000/metrics?token=ADMIN_TOKEN" | grep http_requests_total
```

### High Memory Usage

If metrics memory grows unbounded, check for cardinality explosion:

```bash
# Count unique metric series
curl -s "http://localhost:8000/metrics?token=TOKEN" | grep -c "^http_requests_total"
```

Expected: < 100 series for `http_requests_total`

If > 500 series, paths may not be normalized correctly.

### Missing Cron Metrics

Cron scripts must explicitly record metrics:

```python
from app.monitoring.metrics import metrics

try:
    # ... scraper logic
    metrics.record_cron_run("kttv_scraper", "success")
except Exception as e:
    metrics.record_cron_run("kttv_scraper", "failed")
    raise
```

---

## Integration Examples

### Alertmanager

Send alerts to Telegram:

```yaml
route:
  receiver: 'telegram'
  group_by: ['alertname']
  group_wait: 10s

receivers:
  - name: 'telegram'
    telegram_configs:
      - bot_token: 'YOUR_BOT_TOKEN'
        chat_id: -1001234567890
        message: |
          *{{ .GroupLabels.alertname }}*
          {{ range .Alerts }}
          {{ .Annotations.description }}
          {{ end }}
```

### Datadog

Forward Prometheus metrics to Datadog:

```yaml
# datadog.yaml
logs_enabled: true
process_config:
  enabled: true

# Enable Prometheus scraping
prometheus:
  enabled: true
  scrape_configs:
    - job_name: 'floodwatch'
      static_configs:
        - targets: ['localhost:8000']
      metrics_path: '/metrics'
      params:
        token: ['${ADMIN_TOKEN}']
```

---

## Future Enhancements

- [ ] Add histogram buckets for latency percentiles (p50, p90, p99)
- [ ] Track active WebSocket connections (if added)
- [ ] Add business metrics (alerts sent, SOS reports per province)
- [ ] Trace database query performance by table
- [ ] Add go_gc_duration_seconds for Python GC stats
- [ ] Export metrics to StatsD/Graphite

---

## References

- [Prometheus Exposition Formats](https://prometheus.io/docs/instrumenting/exposition_formats/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)

---

**Document Owner:** Operations Team
**Review Schedule:** Quarterly
**Last Updated:** 2025-11-01
