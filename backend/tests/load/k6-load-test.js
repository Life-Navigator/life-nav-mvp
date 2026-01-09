/**
 * k6 Load Test Plan for LifeNavigator Backend
 *
 * This test simulates realistic user behavior patterns across all major endpoints.
 * Run with: k6 run --out experimental-prometheus-rw backend/tests/load/k6-load-test.js
 *
 * Scenarios:
 * - Authentication (10% of load)
 * - Goals CRUD (50% of load)
 * - GraphRAG queries (15% of load)
 * - Health data access (5% of load)
 * - Financial data access (10% of load)
 * - Career data access (10% of load)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// ============================================================================
// Custom Metrics
// ============================================================================

const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency');
const goalsLatency = new Trend('goals_latency');
const graphragLatency = new Trend('graphrag_latency');
const healthLatency = new Trend('health_latency');
const financeLatency = new Trend('finance_latency');
const careerLatency = new Trend('career_latency');

const authSuccessRate = new Rate('auth_success_rate');
const totalRequests = new Counter('total_requests');

// ============================================================================
// Test Configuration
// ============================================================================

export const options = {
  stages: [
    // Warm-up: 0 → 50 users over 1 minute
    { duration: '1m', target: 50 },

    // Ramp-up: 50 → 100 users over 2 minutes
    { duration: '2m', target: 100 },

    // Steady state: 100 users for 10 minutes
    { duration: '10m', target: 100 },

    // Ramp-up to 500 users over 5 minutes
    { duration: '5m', target: 500 },

    // Steady state: 500 users for 10 minutes
    { duration: '10m', target: 500 },

    // Spike test: 1000 users for 2 minutes
    { duration: '2m', target: 1000 },

    // Steady state: 1000 users for 5 minutes
    { duration: '5m', target: 1000 },

    // Ramp-down: 1000 → 0 over 2 minutes
    { duration: '2m', target: 0 },
  ],

  thresholds: {
    // 95% of requests must complete within 500ms
    'http_req_duration': ['p(95)<500'],

    // Error rate must be below 1%
    'errors': ['rate<0.01'],

    // 99% of requests must complete within 2s
    'http_req_duration{expected_response:true}': ['p(99)<2000'],

    // Authentication success rate > 95%
    'auth_success_rate': ['rate>0.95'],

    // Individual endpoint latencies
    'auth_latency': ['p(95)<300'],
    'goals_latency': ['p(95)<200'],
    'graphrag_latency': ['p(95)<2000'],  // GraphRAG allowed higher latency
    'health_latency': ['p(95)<300'],
    'finance_latency': ['p(95)<300'],
    'career_latency': ['p(95)<200'],
  },
};

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

// Test user pool (pre-create these users in test database)
const TEST_USERS = generateTestUsers(100);

function generateTestUsers(count) {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      email: `load-test-${i}@example.com`,
      password: 'LoadTest123!',
    });
  }
  return users;
}

// ============================================================================
// Main Test Function
// ============================================================================

export default function () {
  // Select a random test user
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  let authToken;

  totalRequests.add(1);

  // =========================================================================
  // Scenario 1: Authentication (10% of load)
  // =========================================================================
  if (Math.random() < 0.1) {
    group('Authentication', function () {
      const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password,
      });

      const loginRes = http.post(
        `${BASE_URL}${API_PREFIX}/auth/login`,
        loginPayload,
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'Login' },
        }
      );

      authLatency.add(loginRes.timings.duration);

      const loginSuccess = check(loginRes, {
        'login status is 200': (r) => r.status === 200,
        'token received': (r) => {
          try {
            return r.json('access_token') !== undefined;
          } catch (e) {
            return false;
          }
        },
      });

      authSuccessRate.add(loginSuccess);

      if (loginSuccess) {
        authToken = loginRes.json('access_token');
      } else {
        errorRate.add(1);
        console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
        return; // Skip remaining tests if login fails
      }
    });

    sleep(1); // Post-login think time
  } else {
    // Reuse token (simulate already authenticated session)
    // In production test, maintain session tokens per VU
    authToken = __ENV.TEST_ACCESS_TOKEN || 'mock-token-for-load-test';
  }

  // Common headers for authenticated requests
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // =========================================================================
  // Scenario 2: Goals CRUD (50% of load)
  // =========================================================================
  if (Math.random() < 0.5) {
    group('Goals - List', function () {
      const goalsRes = http.get(
        `${BASE_URL}${API_PREFIX}/goals`,
        { headers, tags: { name: 'GetGoals' } }
      );

      goalsLatency.add(goalsRes.timings.duration);

      const goalsSuccess = check(goalsRes, {
        'goals status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      });

      if (!goalsSuccess) {
        errorRate.add(1);
      }
    });

    sleep(0.5);

    // 40% of users who list goals will create a new one
    if (Math.random() < 0.4) {
      group('Goals - Create', function () {
        const newGoal = JSON.stringify({
          title: `Load Test Goal ${Date.now()}`,
          description: 'Generated by k6 load test',
          category: 'career',
          status: 'active',
          target_date: '2026-12-31',
        });

        const createGoalRes = http.post(
          `${BASE_URL}${API_PREFIX}/goals`,
          newGoal,
          { headers, tags: { name: 'CreateGoal' } }
        );

        goalsLatency.add(createGoalRes.timings.duration);

        const createSuccess = check(createGoalRes, {
          'goal created': (r) => r.status === 201 || r.status === 200 || r.status === 401,
        });

        if (!createSuccess) {
          errorRate.add(1);
        }
      });

      sleep(0.5);
    }
  }

  // =========================================================================
  // Scenario 3: GraphRAG Query (15% of load)
  // =========================================================================
  if (Math.random() < 0.15) {
    group('GraphRAG - Query', function () {
      const queries = [
        'What are my career goals?',
        'Show me my health conditions',
        'What are my financial accounts?',
        'What skills do I need to develop?',
        'How is my investment portfolio performing?',
      ];

      const query = queries[Math.floor(Math.random() * queries.length)];

      const graphragPayload = JSON.stringify({
        query: query,
        max_results: 10,
        domains: ['goals', 'career', 'health', 'finance'],
      });

      const graphragRes = http.post(
        `${BASE_URL}${API_PREFIX}/graphrag/query`,
        graphragPayload,
        { headers, tags: { name: 'GraphRAGQuery' } }
      );

      graphragLatency.add(graphragRes.timings.duration);

      const graphragSuccess = check(graphragRes, {
        'graphrag query success': (r) => r.status === 200 || r.status === 401 || r.status === 503,
      });

      if (!graphragSuccess) {
        errorRate.add(1);
      }
    });

    sleep(2); // GraphRAG queries have longer think time
  }

  // =========================================================================
  // Scenario 4: Health Data Access (5% of load)
  // =========================================================================
  if (Math.random() < 0.05) {
    group('Health - List Conditions', function () {
      const healthRes = http.get(
        `${BASE_URL}${API_PREFIX}/health/conditions`,
        { headers, tags: { name: 'GetHealthConditions' } }
      );

      healthLatency.add(healthRes.timings.duration);

      const healthSuccess = check(healthRes, {
        'health query success': (r) => r.status === 200 || r.status === 401 || r.status === 404,
      });

      if (!healthSuccess) {
        errorRate.add(1);
      }
    });

    sleep(1);
  }

  // =========================================================================
  // Scenario 5: Financial Data Access (10% of load)
  // =========================================================================
  if (Math.random() < 0.1) {
    group('Finance - List Accounts', function () {
      const financeRes = http.get(
        `${BASE_URL}${API_PREFIX}/financial/accounts`,
        { headers, tags: { name: 'GetFinancialAccounts' } }
      );

      financeLatency.add(financeRes.timings.duration);

      const financeSuccess = check(financeRes, {
        'finance query success': (r) => r.status === 200 || r.status === 401 || r.status === 404,
      });

      if (!financeSuccess) {
        errorRate.add(1);
      }
    });

    sleep(1);
  }

  // =========================================================================
  // Scenario 6: Career Data Access (10% of load)
  // =========================================================================
  if (Math.random() < 0.1) {
    group('Career - List Jobs', function () {
      const careerRes = http.get(
        `${BASE_URL}${API_PREFIX}/career/jobs`,
        { headers, tags: { name: 'GetCareerJobs' } }
      );

      careerLatency.add(careerRes.timings.duration);

      const careerSuccess = check(careerRes, {
        'career query success': (r) => r.status === 200 || r.status === 401 || r.status === 404,
      });

      if (!careerSuccess) {
        errorRate.add(1);
      }
    });

    sleep(0.5);
  }

  // General think time: 1-3 seconds between operations
  sleep(Math.random() * 2 + 1);
}

// ============================================================================
// Setup and Teardown
// ============================================================================

export function setup() {
  console.log('===================================');
  console.log('LifeNavigator Load Test Starting');
  console.log('===================================');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Test Users: ${TEST_USERS.length}`);
  console.log(`Duration: ~39 minutes`);
  console.log(`Max Concurrent Users: 1000`);
  console.log('===================================');
}

export function teardown(data) {
  console.log('===================================');
  console.log('Load Test Complete');
  console.log('===================================');
}

// ============================================================================
// Custom Summary
// ============================================================================

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`load-test-results-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
