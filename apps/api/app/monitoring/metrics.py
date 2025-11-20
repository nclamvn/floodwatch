"""
Prometheus-compatible Metrics Collection

Tracks application metrics for monitoring and alerting:
- HTTP request counters and durations
- Report counters by type and status
- Cron job failures
- Database query performance

Metrics exposed at GET /metrics (requires ADMIN_TOKEN)
"""

import time
from typing import Dict, List, Optional
from collections import defaultdict
from threading import Lock

class MetricsCollector:
    """Thread-safe metrics collector for Prometheus format"""

    def __init__(self):
        self._lock = Lock()

        # Counters
        self._http_requests_total = defaultdict(int)  # by method, path, status
        self._http_requests_duration_sum = defaultdict(float)  # by method, path
        self._http_requests_duration_count = defaultdict(int)

        self._reports_total = defaultdict(int)  # by type, source, status
        self._cron_runs_total = defaultdict(int)  # by job_name, status
        self._db_queries_total = defaultdict(int)  # by query_type
        self._db_queries_duration_sum = defaultdict(float)

        # Gauges (current values)
        self._reports_by_status = defaultdict(int)  # current count by status
        self._last_scraper_run = {}  # job_name -> timestamp
        self._last_alert_sent = {}  # subscription_id -> timestamp

    def record_http_request(self, method: str, path: str, status_code: int, duration_ms: float):
        """Record HTTP request metrics"""
        with self._lock:
            key = (method, self._normalize_path(path), status_code)
            self._http_requests_total[key] += 1

            duration_key = (method, self._normalize_path(path))
            self._http_requests_duration_sum[duration_key] += duration_ms
            self._http_requests_duration_count[duration_key] += 1

    def record_report_created(self, report_type: str, source: str, status: str):
        """Record report creation"""
        with self._lock:
            key = (report_type, source, status)
            self._reports_total[key] += 1
            self._reports_by_status[status] += 1

    def record_report_status_change(self, old_status: str, new_status: str):
        """Record report status change"""
        with self._lock:
            self._reports_by_status[old_status] -= 1
            self._reports_by_status[new_status] += 1

    def record_cron_run(self, job_name: str, status: str, duration_ms: Optional[float] = None):
        """Record cron job execution"""
        with self._lock:
            key = (job_name, status)
            self._cron_runs_total[key] += 1

            if status == "success":
                self._last_scraper_run[job_name] = time.time()

    def record_db_query(self, query_type: str, duration_ms: float):
        """Record database query performance"""
        with self._lock:
            self._db_queries_total[query_type] += 1
            self._db_queries_duration_sum[query_type] += duration_ms

    def record_alert_sent(self, subscription_id: str, success: bool):
        """Record alert delivery"""
        with self._lock:
            if success:
                self._last_alert_sent[subscription_id] = time.time()

    def get_prometheus_metrics(self) -> str:
        """
        Generate Prometheus text format metrics

        Returns:
            Multi-line string in Prometheus exposition format
        """
        with self._lock:
            lines = []

            # HTTP requests total
            lines.append("# HELP http_requests_total Total HTTP requests by method, path, and status")
            lines.append("# TYPE http_requests_total counter")
            for (method, path, status), count in self._http_requests_total.items():
                lines.append(f'http_requests_total{{method="{method}",path="{path}",status="{status}"}} {count}')

            lines.append("")

            # HTTP request duration
            lines.append("# HELP http_request_duration_milliseconds HTTP request duration in milliseconds")
            lines.append("# TYPE http_request_duration_milliseconds summary")
            for (method, path), total_ms in self._http_requests_duration_sum.items():
                count = self._http_requests_duration_count[(method, path)]
                avg_ms = total_ms / count if count > 0 else 0
                lines.append(f'http_request_duration_milliseconds_sum{{method="{method}",path="{path}"}} {total_ms:.2f}')
                lines.append(f'http_request_duration_milliseconds_count{{method="{method}",path="{path}"}} {count}')
                lines.append(f'http_request_duration_milliseconds_avg{{method="{method}",path="{path}"}} {avg_ms:.2f}')

            lines.append("")

            # Reports total
            lines.append("# HELP reports_total Total reports created by type, source, and status")
            lines.append("# TYPE reports_total counter")
            for (report_type, source, status), count in self._reports_total.items():
                lines.append(f'reports_total{{type="{report_type}",source="{source}",status="{status}"}} {count}')

            lines.append("")

            # Reports by status (current count)
            lines.append("# HELP reports_by_status_current Current number of reports by status")
            lines.append("# TYPE reports_by_status_current gauge")
            for status, count in self._reports_by_status.items():
                lines.append(f'reports_by_status_current{{status="{status}"}} {count}')

            lines.append("")

            # Cron runs
            lines.append("# HELP cron_runs_total Total cron job executions by job and status")
            lines.append("# TYPE cron_runs_total counter")
            for (job_name, status), count in self._cron_runs_total.items():
                lines.append(f'cron_runs_total{{job="{job_name}",status="{status}"}} {count}')

            lines.append("")

            # Last scraper run
            lines.append("# HELP last_scraper_run_timestamp_seconds Unix timestamp of last successful scraper run")
            lines.append("# TYPE last_scraper_run_timestamp_seconds gauge")
            for job_name, timestamp in self._last_scraper_run.items():
                lines.append(f'last_scraper_run_timestamp_seconds{{job="{job_name}"}} {timestamp:.0f}')

            lines.append("")

            # Database queries
            lines.append("# HELP db_queries_total Total database queries by type")
            lines.append("# TYPE db_queries_total counter")
            for query_type, count in self._db_queries_total.items():
                lines.append(f'db_queries_total{{type="{query_type}"}} {count}')

            lines.append("")

            # Database query duration
            lines.append("# HELP db_query_duration_milliseconds_sum Total database query duration in milliseconds")
            lines.append("# TYPE db_query_duration_milliseconds_sum counter")
            for query_type, total_ms in self._db_queries_duration_sum.items():
                count = self._db_queries_total[query_type]
                avg_ms = total_ms / count if count > 0 else 0
                lines.append(f'db_query_duration_milliseconds_sum{{type="{query_type}"}} {total_ms:.2f}')
                lines.append(f'db_query_duration_milliseconds_avg{{type="{query_type}"}} {avg_ms:.2f}')

            lines.append("")

            # Process info
            lines.append("# HELP process_start_time_seconds Start time of the process since unix epoch in seconds")
            lines.append("# TYPE process_start_time_seconds gauge")
            lines.append(f"process_start_time_seconds {time.time():.0f}")

            return "\n".join(lines) + "\n"

    def _normalize_path(self, path: str) -> str:
        """
        Normalize path to reduce cardinality

        Examples:
            /ops/verify/abc-123 -> /ops/verify/{id}
            /reports?province=X -> /reports
        """
        # Remove query params
        if "?" in path:
            path = path.split("?")[0]

        # Replace UUIDs with {id}
        parts = path.split("/")
        normalized = []
        for part in parts:
            if len(part) == 36 and "-" in part:  # UUID pattern
                normalized.append("{id}")
            elif len(part) == 8 and part.isalnum():  # Short ID
                normalized.append("{id}")
            else:
                normalized.append(part)

        return "/".join(normalized)


# Global singleton instance
metrics = MetricsCollector()
