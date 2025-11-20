/**
 * k6 Smoke Test - FloodWatch API
 *
 * Quick smoke test to verify API is working
 * - 1-5 VUs (virtual users)
 * - 30 second duration
 * - Minimal load
 *
 * Run before deploying changes:
 *   k6 run ops/loadtest/k6_smoke_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const API_KEY = __ENV.API_KEY || 'test_key_abc123';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    'http_req_duration': ['p(95)<200'],
    'http_req_failed': ['rate<0.05'],  // Allow 5% failure for smoke test
  },
};

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Test 2: Public reports endpoint
  const reportsRes = http.get(`${BASE_URL}/reports`);
  check(reportsRes, {
    'reports endpoint is 200': (r) => r.status === 200,
    'reports has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);

  // Test 3: API with key
  const apiRes = http.get(`${BASE_URL}/api/v1/reports`, {
    headers: {
      'X-API-Key': API_KEY,
    },
  });
  check(apiRes, {
    'API endpoint is 200': (r) => r.status === 200,
  });

  sleep(2);
}
