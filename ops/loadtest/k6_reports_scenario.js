/**
 * k6 Load Test - FloodWatch Reports API
 *
 * Scenario: Simulate realistic traffic during flood event
 * - 10-50 RPS (requests per second)
 * - 5 minute duration
 * - Mix of read queries (GET /reports, /api/v1/reports)
 *
 * Targets:
 * - p95 ≤ 150ms
 * - p99 ≤ 300ms
 * - Error rate < 1%
 *
 * Run:
 *   k6 run ops/loadtest/k6_reports_scenario.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const reportsFetchDuration = new Trend('reports_fetch_duration');
const apiFetchDuration = new Trend('api_fetch_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const API_KEY = __ENV.API_KEY || 'test_key_abc123';  // Replace with real API key

// Load test stages
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp-up to 10 RPS
    { duration: '2m', target: 30 },   // Ramp-up to 30 RPS
    { duration: '1m', target: 50 },   // Peak: 50 RPS
    { duration: '1m', target: 10 },   // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<150', 'p(99)<300'],  // 95th percentile < 150ms, 99th < 300ms
    'errors': ['rate<0.01'],  // Error rate < 1%
    'http_req_failed': ['rate<0.01'],  // Failed requests < 1%
  },
};

// Test data
const provinces = [
  'Quảng Bình',
  'Quảng Trị',
  'Thừa Thiên Huế',
  'Đà Nẵng',
  'Quảng Nam',
];

const reportTypes = ['ALL', 'SOS', 'ALERT', 'ROAD', 'NEEDS'];
const sinceValues = ['1h', '6h', '24h', '7d'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  // Scenario mix (realistic user behavior)
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Web endpoint: GET /reports (most common)
    testWebReports();
  } else if (scenario < 0.7) {
    // 30% - API endpoint with key: GET /api/v1/reports
    testApiReports();
  } else if (scenario < 0.85) {
    // 15% - Filtered query (by province)
    testFilteredReports();
  } else {
    // 15% - Road events endpoint
    testRoadEvents();
  }

  // Think time (users don't immediately make next request)
  sleep(Math.random() * 2 + 1);  // Random sleep 1-3 seconds
}

function testWebReports() {
  const params = {
    tags: { name: 'GET_/reports' },
  };

  const response = http.get(`${BASE_URL}/reports`, params);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  reportsFetchDuration.add(response.timings.duration);
}

function testApiReports() {
  const params = {
    headers: {
      'X-API-Key': API_KEY,
    },
    tags: { name: 'GET_/api/v1/reports' },
  };

  const response = http.get(`${BASE_URL}/api/v1/reports?limit=50`, params);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  apiFetchDuration.add(response.timings.duration);
}

function testFilteredReports() {
  const province = randomChoice(provinces);
  const type = randomChoice(reportTypes);
  const since = randomChoice(sinceValues);

  const params = {
    headers: {
      'X-API-Key': API_KEY,
    },
    tags: { name: 'GET_/api/v1/reports_filtered' },
  };

  const url = `${BASE_URL}/api/v1/reports?province=${encodeURIComponent(province)}&type=${type}&since=${since}&limit=50`;
  const response = http.get(url, params);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
    'response time < 250ms': (r) => r.timings.duration < 250,
  });

  errorRate.add(!success);
  apiFetchDuration.add(response.timings.duration);
}

function testRoadEvents() {
  const params = {
    headers: {
      'X-API-Key': API_KEY,
    },
    tags: { name: 'GET_/api/v1/road-events' },
  };

  const response = http.get(`${BASE_URL}/api/v1/road-events`, params);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
    'response time < 150ms': (r) => r.timings.duration < 150,
  });

  errorRate.add(!success);
}

// Teardown function (runs once at end)
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  const green = enableColors ? '\x1b[32m' : '';
  const red = enableColors ? '\x1b[31m' : '';
  const yellow = enableColors ? '\x1b[33m' : '';
  const reset = enableColors ? '\x1b[0m' : '';

  let summary = '\n\n';
  summary += `${indent}========== k6 Load Test Summary ==========\n\n`;

  // Requests
  const httpReqs = data.metrics.http_reqs;
  const httpReqDuration = data.metrics.http_req_duration;
  const httpReqFailed = data.metrics.http_req_failed;

  if (httpReqs) {
    summary += `${indent}Total Requests: ${httpReqs.values.count}\n`;
    summary += `${indent}Requests/sec: ${httpReqs.values.rate.toFixed(2)}\n`;
  }

  if (httpReqDuration) {
    const p95 = httpReqDuration.values['p(95)'];
    const p99 = httpReqDuration.values['p(99)'];
    const avg = httpReqDuration.values.avg;

    const p95Status = p95 <= 150 ? `${green}✓${reset}` : `${red}✗${reset}`;
    const p99Status = p99 <= 300 ? `${green}✓${reset}` : `${red}✗${reset}`;

    summary += `\n${indent}Response Times:\n`;
    summary += `${indent}  avg: ${avg.toFixed(2)}ms\n`;
    summary += `${indent}  p50: ${httpReqDuration.values.med.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${p95.toFixed(2)}ms ${p95Status} (target: ≤150ms)\n`;
    summary += `${indent}  p99: ${p99.toFixed(2)}ms ${p99Status} (target: ≤300ms)\n`;
  }

  if (httpReqFailed) {
    const failRate = httpReqFailed.values.rate * 100;
    const failStatus = failRate < 1 ? `${green}✓${reset}` : `${red}✗${reset}`;
    summary += `\n${indent}Error Rate: ${failRate.toFixed(2)}% ${failStatus} (target: <1%)\n`;
  }

  // Custom metrics
  if (data.metrics.errors) {
    const errorRateValue = data.metrics.errors.values.rate * 100;
    summary += `${indent}Check Failures: ${errorRateValue.toFixed(2)}%\n`;
  }

  summary += `\n${indent}==========================================\n\n`;

  return summary;
}
