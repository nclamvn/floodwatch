# FloodWatch Load Testing

Load testing scripts for FloodWatch using [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Available Tests

### 1. Smoke Test (Quick Validation)

Quick test to verify API is working before deployment.

**Duration:** 30 seconds
**Load:** 5 virtual users
**Purpose:** Catch obvious errors

```bash
cd /opt/floodwatch
k6 run ops/loadtest/k6_smoke_test.js
```

**Pass Criteria:**
- ✅ p95 < 200ms
- ✅ Error rate < 5%

---

### 2. Load Test (Realistic Traffic)

Simulates realistic flood event traffic.

**Duration:** 5 minutes
**Load:** 10-50 RPS (ramps up gradually)
**Purpose:** Verify performance under normal load

```bash
cd /opt/floodwatch

# Local testing
BASE_URL=http://localhost:8000 API_KEY=your_api_key k6 run ops/loadtest/k6_reports_scenario.js

# Production testing (be careful!)
BASE_URL=https://floodwatch.vn API_KEY=prod_api_key k6 run ops/loadtest/k6_reports_scenario.js
```

**Pass Criteria:**
- ✅ p95 ≤ 150ms
- ✅ p99 ≤ 300ms
- ✅ Error rate < 1%

---

### 3. Stress Test (Find Breaking Point)

Find the maximum capacity before system degrades.

**Duration:** 10 minutes
**Load:** Ramps up to 200+ RPS
**Purpose:** Identify bottlenecks

```bash
cd /opt/floodwatch
k6 run ops/loadtest/k6_stress_test.js
```

**Expected:** System should gracefully degrade, not crash

---

## Running Tests

### Before Deployment

1. Run smoke test locally:
   ```bash
   docker-compose up -d
   k6 run ops/loadtest/k6_smoke_test.js
   ```

2. If smoke test passes, run load test:
   ```bash
   BASE_URL=http://localhost:8000 API_KEY=$(cat .env | grep API_KEY_1 | cut -d= -f2) k6 run ops/loadtest/k6_reports_scenario.js
   ```

3. Review results and fix any issues

### Production Validation

**⚠️ WARNING:** Only run during low-traffic periods!

```bash
# SSH to production server
ssh user@floodwatch.vn

# Run smoke test
cd /opt/floodwatch
BASE_URL=http://localhost:8000 k6 run ops/loadtest/k6_smoke_test.js

# If smoke test passes, run light load test
BASE_URL=http://localhost:8000 API_KEY=prod_key k6 run --vus 10 --duration 1m ops/loadtest/k6_reports_scenario.js
```

---

## Interpreting Results

### Example Output

```
scenarios: (100.00%) 1 scenario, 50 max VUs, 5m30s max duration

✓ status is 200
✓ response has data
✓ response time < 200ms

checks.........................: 98.50%  ✓ 2955  ✗ 45
data_received..................: 12 MB   40 kB/s
data_sent......................: 380 kB  1.3 kB/s
http_req_duration..............: avg=85ms  p(95)=142ms  p(99)=256ms
http_req_failed................: 0.50%   ✓ 15    ✗ 2985
http_reqs......................: 3000    10/s
iteration_duration.............: avg=2.1s
vus............................: 10      min=1   max=50

========== k6 Load Test Summary ==========

Total Requests: 3000
Requests/sec: 10.00

Response Times:
  avg: 85.23ms
  p50: 78.50ms
  p95: 142.30ms ✓ (target: ≤150ms)
  p99: 256.10ms ✓ (target: ≤300ms)

Error Rate: 0.50% ✓ (target: <1%)

==========================================
```

### Key Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| p95 latency | < 100ms | 100-150ms | > 150ms |
| p99 latency | < 200ms | 200-300ms | > 300ms |
| Error rate | < 0.1% | 0.1-1% | > 1% |
| RPS | 30+ | 20-30 | < 20 |

### What to Do If Tests Fail

**High Latency (p95 > 150ms):**
1. Check database query performance with `EXPLAIN ANALYZE`
2. Verify indexes are being used (see `docs/PERF_NOTES.md`)
3. Check for N+1 queries in SQLAlchemy
4. Review PostgreSQL slow query log

**High Error Rate (> 1%):**
1. Check application logs: `docker-compose logs api`
2. Verify database connection pool size
3. Check rate limiting settings (may be too aggressive)
4. Review CORS configuration

**Low Throughput (< 20 RPS):**
1. Check CPU usage: `docker stats`
2. Check database connections: `SELECT count(*) FROM pg_stat_activity;`
3. Verify Gunicorn worker count (should be 2-4x CPU cores)
4. Check for database locks

---

## Test Scenarios

### Reports Scenario Mix

The `k6_reports_scenario.js` simulates realistic user behavior:

- **40%** - Web users fetching `/reports`
- **30%** - API users with keys fetching `/api/v1/reports`
- **15%** - Filtered queries (by province, type, time)
- **15%** - Road events queries

### Think Time

Users don't make requests continuously. The test includes random "think time" between requests (1-3 seconds) to simulate real browsing.

---

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run k6 smoke test
  run: |
    k6 run --quiet ops/loadtest/k6_smoke_test.js
    if [ $? -ne 0 ]; then
      echo "Smoke test failed! Deployment aborted."
      exit 1
    fi
```

---

## Performance Monitoring

After running load tests, check these metrics:

### Database
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check connection pool
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
```

### Application
```bash
# Check Gunicorn worker status
docker-compose exec api ps aux | grep gunicorn

# Check memory usage
docker stats --no-stream api
```

---

## Troubleshooting

### k6 Installation Issues

If `k6 run` fails with "command not found":

```bash
# Verify installation
which k6
k6 version

# Re-install if needed
brew reinstall k6  # macOS
```

### API Key Issues

If you get 401 Unauthorized errors:

```bash
# Generate a test API key
cd /opt/floodwatch
docker-compose exec api python ops/scripts/seed_api_keys.py

# Use the generated key
export API_KEY="the_generated_key"
k6 run ops/loadtest/k6_reports_scenario.js
```

### Rate Limiting Issues

If you hit rate limits during testing:

1. Temporarily increase rate limits in `.env`:
   ```
   RATE_LIMIT_PER_MINUTE=300
   ```

2. Restart API:
   ```bash
   docker-compose restart api
   ```

3. After testing, restore normal limits

---

## Best Practices

1. **Always run smoke test first** - Catch errors early
2. **Test locally before production** - Don't discover issues in prod
3. **Monitor during tests** - Watch logs, metrics, database
4. **Run during low traffic** - Don't impact real users
5. **Document results** - Keep history of performance trends
6. **Automate in CI** - Catch regressions automatically

---

## Future Enhancements

- [ ] Add write operation tests (POST /report)
- [ ] Add WebSocket connection tests (if added)
- [ ] Add geospatial query tests (radius search)
- [ ] Add CSV export load test
- [ ] Add Grafana dashboard for k6 metrics

---

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Cloud](https://k6.io/cloud/) - For distributed load testing
- [Performance Notes](../../docs/PERF_NOTES.md) - Database optimization
- [Runbook](../../docs/RUNBOOK.md) - Incident response

---

**Last Updated:** 2025-11-01
**Owner:** Operations Team
