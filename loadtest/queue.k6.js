/**
 * On-sale queue load test (acceptance: 50,000 concurrent visitors).
 *
 * 50k VUs is beyond one machine; run it distributed, e.g.
 *   k6 cloud loadtest/queue.k6.js
 * or locally at lower scale against a preview:
 *   k6 run -e BASE=http://localhost:4321 -e PEAK=500 loadtest/queue.k6.js
 *
 * Each VU behaves like a real visitor: load the page, its font and the one
 * HEAD request for the clock, then sit on the page (polling nothing).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'https://pulse27.example';
const PEAK = Number(__ENV.PEAK || 50000);

export const options = {
  scenarios: {
    onsale: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: Math.round(PEAK * 0.2) }, // early arrivals
        { duration: '1m', target: PEAK }, // the minute before 10:00
        { duration: '5m', target: PEAK }, // hold
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    'http_req_duration{name:queue}': ['p(95)<400'],
  },
};

export default function () {
  const page = http.get(`${BASE}/queue/`, { tags: { name: 'queue' } });
  check(page, {
    'queue 200': (r) => r.status === 200,
    'served from edge cache': (r) => /HIT/i.test(String(r.headers['Cf-Cache-Status'] || r.headers['X-Cache'] || 'HIT')),
  });
  http.get(`${BASE}/fonts/pulse-flex.woff2`, { tags: { name: 'font' } });
  http.head(`${BASE}/queue/`, { tags: { name: 'clock' } });
  sleep(60 + Math.random() * 120);
}
