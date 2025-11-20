# FloodWatch Load Testing Guide

**PR-21: k6 Load Testing Implementation**
**Date:** 2025-11-01

---

## Overview

This document describes the load testing strategy for FloodWatch using k6, an open-source load testing tool. Load tests ensure the system performs well under realistic and peak traffic conditions.

---

## Goals

1. **Verify performance targets:**
   - p95 latency ≤ 150ms
   - p99 latency ≤ 300ms
   - Error rate < 1%

2. **Find system limits:**
   - Maximum sustainable RPS (requests per second)
   - Breaking point under stress
   - Resource bottlenecks

3. **Prevent regressions:**
   - Run tests before each deployment
   - Track performance trends over time
   - Catch performance issues early

---

## Test Suite

### 1. Smoke Test (`k6_smoke_test.js`)

**Purpose:** Quick validation that API is working

**Configuration:**
- Duration: 30 seconds
- Load: 5 virtual users
- Endpoints tested:
  - GET `/health`
  - GET `/reports`
  - GET `/api/v1/reports`

**Pass Criteria:**
- ✅ p95 < 200ms
- ✅ Error rate < 5%

**When to run:**
- Before every deployment
- After configuration changes
- After database migrations

**Example:**
```bash
cd /opt/floodwatch
k6 run ops/loadtest/k6_smoke_test.js
```

---

### 2. Load Test (`k6_reports_scenario.js`)

**Purpose:** Simulate realistic flood event traffic

**Configuration:**
- Duration: 5 minutes
- Load stages:
  - 0-1min: Ramp up to 10 RPS
  - 1-3min: Ramp up to 30 RPS
  - 3-4min: Peak at 50 RPS
  - 4-5min: Ramp down to 10 RPS

**Traffic Mix:**
- 40% - Public web users (GET `/reports`)
- 30% - API users with keys (GET `/api/v1/reports`)
- 15% - Filtered queries (province, type, time)
- 15% - Road events queries

**Pass Criteria:**
- ✅ p95 ≤ 150ms
- ✅ p99 ≤ 300ms
- ✅ Error rate < 1%
- ✅ No database connection pool exhaustion
- ✅ No memory leaks

**When to run:**
- Weekly performance check
- Before major releases
- After performance optimizations

**Example:**
```bash
cd /opt/floodwatch
BASE_URL=http://localhost:8000 \
API_KEY=your_api_key \
k6 run ops/loadtest/k6_reports_scenario.js
```

---

### 3. Stress Test (`k6_stress_test.js`)

**Purpose:** Find the breaking point

**Configuration:**
- Duration: 10 minutes
- Load stages:
  - 0-2min: Warm-up to 10 RPS
  - 2-4min: Ramp to 50 RPS
  - 4-6min: Ramp to 100 RPS
  - 6-8min: Ramp to 150 RPS
  - 8-9min: Peak at 200 RPS
  - 9-10min: Recovery (0 RPS)

**Pass Criteria:**
- System should degrade gracefully (no crashes)
- Error rate < 10% under stress
- Recovery after load removal

**⚠️ WARNING:** Only run in test/staging environment!

**When to run:**
- Capacity planning
- Before infrastructure scaling
- After major architecture changes

**Example:**
```bash
cd /opt/floodwatch
BASE_URL=http://staging.floodwatch.vn \
k6 run ops/loadtest/k6_stress_test.js
```

---

## Running Tests

### Quick Start

Use the convenience script:

```bash
cd /opt/floodwatch

# Run smoke test only
./ops/loadtest/run_tests.sh smoke

# Run full load test
./ops/loadtest/run_tests.sh load

# Run stress test (with confirmation)
./ops/loadtest/run_tests.sh stress

# Run all tests (smoke + load)
./ops/loadtest/run_tests.sh all
```

### Manual Execution

```bash
# Set environment variables
export BASE_URL="http://localhost:8000"
export API_KEY="your_test_api_key"

# Run specific test
k6 run ops/loadtest/k6_reports_scenario.js

# Save results to file
k6 run --out json=results.json ops/loadtest/k6_reports_scenario.js

# Run with custom options
k6 run --vus 20 --duration 2m ops/loadtest/k6_smoke_test.js
```

---

## Interpreting Results

### Sample Output

```
          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: ops/loadtest/k6_reports_scenario.js
     output: -

  scenarios: (100.00%) 1 scenario, 50 max VUs, 5m30s max duration (incl. graceful stop):
           * default: Up to 50 looping VUs for 5m0s over 4 stages (gracefulRampDown: 30s, gracefulStop: 30s)


running (5m00.2s), 00/50 VUs, 3000 complete and 0 interrupted iterations
default ✓ [======================================] 00/50 VUs  5m0s

     ✓ status is 200
     ✓ response has data
     ✓ response time < 200ms

     checks.........................: 98.50%  ✓ 8850   ✗ 150
     data_received..................: 12 MB   40 kB/s
     data_sent......................: 380 kB  1.3 kB/s
   ✓ http_req_duration..............: avg=85ms  min=12ms med=78ms max=486ms p(90)=125ms p(95)=142ms p(99)=256ms
       { expected_response:true }...: avg=83ms  min=12ms med=76ms max=456ms p(90)=122ms p(95)=138ms p(99)=245ms
   ✗ http_req_failed................: 0.50%   ✓ 15     ✗ 2985
     http_reqs......................: 3000    10/s
     iteration_duration.............: avg=2.1s  min=1.2s med=2.0s max=3.8s  p(90)=2.8s  p(95)=3.1s  p(99)=3.5s
     iterations.....................: 3000    10/s
     vus............................: 10      min=1    max=50
     vus_max........................: 50      min=50   max=50


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

### Key Metrics Explained

| Metric | Description | Target |
|--------|-------------|--------|
| **http_req_duration** | Response time distribution | p95 ≤ 150ms |
| **http_req_failed** | Percentage of failed requests (non-2xx) | < 1% |
| **http_reqs** | Total requests and RPS | - |
| **checks** | Percentage of successful validation checks | > 95% |
| **vus** | Number of virtual users (concurrent) | - |
| **iteration_duration** | Full iteration time (request + sleep) | - |

### Pass/Fail Criteria

**✅ Pass:**
```
✓ http_req_duration..............: p(95)=142ms  p(99)=256ms
✗ http_req_failed................: 0.50%
  checks.........................: 98.50%
```
- p95: 142ms < 150ms target ✅
- p99: 256ms < 300ms target ✅
- Error rate: 0.5% < 1% target ✅

**❌ Fail:**
```
✗ http_req_duration..............: p(95)=287ms  p(99)=1245ms
✗ http_req_failed................: 5.20%
  checks.........................: 85.30%
```
- p95: 287ms > 150ms target ❌
- p99: 1245ms > 300ms target ❌
- Error rate: 5.2% > 1% target ❌

---

## Monitoring During Tests

### Application Logs

```bash
# Watch API logs during test
docker-compose logs -f --tail=100 api
```

### Database Metrics

```sql
-- Active connections
SELECT count(*), state
FROM pg_stat_activity
WHERE datname = 'floodwatch'
GROUP BY state;

-- Slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
AND now() - query_start > interval '1 second'
ORDER BY duration DESC;

-- Lock contention
SELECT relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;
```

### System Resources

```bash
# Container stats
docker stats --no-stream

# CPU and memory
top -b -n 1 | head -20

# Disk I/O
iostat -x 1 5
```

---

## Troubleshooting

### High Latency (p95 > 150ms)

**Symptoms:**
- Slow response times
- Requests queuing up

**Possible Causes:**
1. Database query performance
2. Missing indexes
3. N+1 queries
4. Insufficient database connections

**Solutions:**
```bash
# Check query performance
docker-compose exec db psql -U fw_user -d floodwatch -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Verify indexes are used
# See docs/PERF_NOTES.md

# Increase database connections
# Edit .env: DB_POOL_SIZE=20
docker-compose restart api
```

---

### High Error Rate (> 1%)

**Symptoms:**
- Many 500 errors
- Connection timeouts
- Rate limiting errors

**Possible Causes:**
1. Database connection pool exhausted
2. Application crashes
3. Rate limiting too aggressive
4. Memory leaks

**Solutions:**
```bash
# Check error logs
docker-compose logs api | grep ERROR

# Check database connections
docker-compose exec db psql -U fw_user -d floodwatch -c "
SELECT count(*) FROM pg_stat_activity;
"

# Temporarily disable rate limiting for testing
# Edit main.py: @limiter.limit("1000/minute")
docker-compose restart api
```

---

### Memory Issues

**Symptoms:**
- OOM (Out of Memory) errors
- Container restarts
- Increasing memory usage

**Solutions:**
```bash
# Monitor memory during test
watch -n 1 'docker stats --no-stream api'

# Check for memory leaks in Python
docker-compose exec api pip install memory-profiler
docker-compose exec api python -m memory_profiler app/main.py

# Increase container memory limit
# Edit docker-compose.yml:
#   api:
#     deploy:
#       resources:
#         limits:
#           memory: 1G
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker-compose up -d

      - name: Wait for API
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:8000/health; do sleep 2; done'

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 \
            --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run smoke test
        run: |
          k6 run ops/loadtest/k6_smoke_test.js

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results.json
```

---

## Performance Trends

Track performance over time:

```bash
# Save results with timestamp
k6 run --out json=results-$(date +%Y%m%d-%H%M%S).json \
  ops/loadtest/k6_reports_scenario.js

# Extract key metrics
cat results-*.json | jq '
  select(.type == "Point" and .metric == "http_req_duration") |
  {timestamp: .data.time, value: .data.value}
'
```

### Expected Performance

| Dataset Size | p95 Latency | p99 Latency | Max RPS |
|--------------|-------------|-------------|---------|
| 1k reports | ~50ms | ~100ms | 100+ |
| 10k reports | ~80ms | ~150ms | 80+ |
| 100k reports | ~120ms | ~250ms | 50+ |

---

## Best Practices

1. **Always start with smoke test** - Catch obvious errors quickly
2. **Test locally first** - Don't discover issues in production
3. **Monitor during tests** - Watch logs, metrics, database
4. **Run during low traffic** - Avoid impacting real users
5. **Document results** - Track trends over time
6. **Automate in CI** - Catch regressions early
7. **Test realistic scenarios** - Match real user behavior
8. **Include think time** - Users don't spam requests

---

## Future Enhancements

- [ ] Add write operation tests (POST `/report`)
- [ ] Test geospatial queries (radius search)
- [ ] Test CSV export under load
- [ ] Add Grafana dashboard for k6 metrics
- [ ] Set up k6 Cloud for distributed testing
- [ ] Add chaos engineering tests (network failures, etc.)

---

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [Performance Notes](./PERF_NOTES.md)
- [Runbook](./RUNBOOK.md)

---

**Document Owner:** Operations Team
**Review Schedule:** Monthly
**Last Updated:** 2025-11-01
