/**
 * k6 Stress Test - FloodWatch API
 *
 * Find the breaking point of the system
 * - Ramps up from 10 to 200 RPS
 * - 10 minute duration
 * - Identifies bottlenecks and max capacity
 *
 * ⚠️ WARNING: Only run in staging/test environment, NOT production!
 *
 * Run:
 *   BASE_URL=http://localhost:8000 k6 run ops/loadtest/k6_stress_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const slowRequests = new Counter('slow_requests');  // Requests > 500ms

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const API_KEY = __ENV.API_KEY || 'test_key_abc123';

export const options = {
  stages: [
    { duration: '2m', target: 10 },    // Warm-up
    { duration: '2m', target: 50 },    // Gradual increase
    { duration: '2m', target: 100 },   // Double the load
    { duration: '2m', target: 150 },   // Stress level
    { duration: '1m', target: 200 },   // Breaking point
    { duration: '1m', target: 0 },     // Recovery
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // More lenient for stress test
    'errors': ['rate<0.10'],  // Allow 10% errors under stress
  },
};

const provinces = ['Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  const scenario = Math.random();

  let response;
  if (scenario < 0.5) {
    // 50% - Simple GET /reports
    response = http.get(`${BASE_URL}/reports`);
  } else {
    // 50% - API endpoint with filters
    const province = randomChoice(provinces);
    response = http.get(`${BASE_URL}/api/v1/reports?province=${encodeURIComponent(province)}&limit=50`, {
      headers: { 'X-API-Key': API_KEY },
    });
  }

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!success);

  if (response.timings.duration > 500) {
    slowRequests.add(1);
  }

  sleep(0.5);  // Shorter sleep for stress test
}

export function handleSummary(data) {
  const httpReqDuration = data.metrics.http_req_duration;
  const httpReqs = data.metrics.http_reqs;
  const errors = data.metrics.errors;

  console.log('\n========== Stress Test Summary ==========\n');
  console.log(`Total Requests: ${httpReqs.values.count}`);
  console.log(`Peak RPS: ${httpReqs.values.rate.toFixed(2)}\n`);

  console.log('Response Times:');
  console.log(`  avg: ${httpReqDuration.values.avg.toFixed(2)}ms`);
  console.log(`  p50: ${httpReqDuration.values.med.toFixed(2)}ms`);
  console.log(`  p95: ${httpReqDuration.values['p(95)'].toFixed(2)}ms`);
  console.log(`  p99: ${httpReqDuration.values['p(99)'].toFixed(2)}ms`);
  console.log(`  max: ${httpReqDuration.values.max.toFixed(2)}ms\n`);

  const errorRateValue = errors ? errors.values.rate * 100 : 0;
  console.log(`Error Rate: ${errorRateValue.toFixed(2)}%\n`);

  if (data.metrics.slow_requests) {
    console.log(`Slow Requests (>500ms): ${data.metrics.slow_requests.values.count}\n`);
  }

  console.log('==========================================\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
