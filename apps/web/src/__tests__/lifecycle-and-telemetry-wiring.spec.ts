/**
 * @jest-environment node
 *
 * Sprint O.0.1 Phase 3 — structural lifecycle + telemetry wiring tests.
 *
 * Two kinds of assertion:
 *
 *   1. Each canonical user event type has at least one source-file
 *      that calls `recordUserEvent` with that literal.
 *   2. Each recommendation-emitting route passes `subject.id` to
 *      `guardOutgoing` so the lifecycle row registers.
 *
 * These are STRUCTURAL — they catch regression by grep, not by
 * running the route. The integration paths are covered by
 * existing test files (sprint-l2-runtime, upload-pipeline-wiring,
 * events-and-outcomes).
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(SRC, rel));
}

// ---------------------------------------------------------------------------
// Section 1 — Event-type coverage
// ---------------------------------------------------------------------------

interface EventOrigin {
  event_type: string;
  route: string;
}

const REQUIRED_ORIGINS: EventOrigin[] = [
  { event_type: 'onboarding_started', route: 'app/api/onboarding/sections/route.ts' },
  { event_type: 'onboarding_completed', route: 'app/api/onboarding/complete/route.ts' },
  { event_type: 'goal_created', route: 'app/api/goals/route.ts' },
  { event_type: 'goal_updated', route: 'app/api/goals/[id]/route.ts' },
  { event_type: 'document_uploaded', route: 'lib/ingestion/upload-pipeline.ts' },
  { event_type: 'plaid_connected', route: 'app/api/integrations/plaid/exchange/route.ts' },
  { event_type: 'recommendation_generated', route: 'lib/governance/route-guard.ts' },
  { event_type: 'recommendation_viewed', route: 'app/api/recommendations/[id]/view/route.ts' },
  { event_type: 'recommendation_accepted', route: 'app/api/optimizer/runs/[id]/accept/route.ts' },
  {
    event_type: 'recommendation_dismissed',
    route: 'app/api/feedback/recommendation/quality/route.ts',
  },
  {
    event_type: 'recommendation_completed',
    route: 'app/api/feedback/recommendation/quality/route.ts',
  },
  { event_type: 'simulation_run', route: 'app/api/simulations/[id]/run/route.ts' },
  { event_type: 'simulation_compared', route: 'app/api/simulations/compare/route.ts' },
  { event_type: 'arcana_intake_started', route: 'app/api/arcana/intake/start/route.ts' },
  { event_type: 'arcana_intake_completed', route: 'app/api/arcana/intake/upsert/route.ts' },
  { event_type: 'provider_referral_generated', route: 'lib/governance/route-guard.ts' },
];

describe('Sprint O.0.1 — every canonical event type has a producer', () => {
  test.each(REQUIRED_ORIGINS)('event %p originates from %p', ({ event_type, route }) => {
    expect(fileExists(route)).toBe(true);
    const src = readFile(route);
    expect(src).toMatch(/recordUserEvent/);
    // The literal event_type must appear quoted in the source.
    expect(src).toMatch(new RegExp(`['"\`]${event_type}['"\`]`));
  });
});

// ---------------------------------------------------------------------------
// Section 2 — Recommendation routes pass subject.id
// ---------------------------------------------------------------------------

const RECOMMENDATION_GENERATION_ROUTES = [
  'app/api/optimizer/run/route.ts',
  'app/api/arcana/readiness/route.ts',
  'app/api/arcana/catch-up/route.ts',
  'app/api/arcana/lead-package/route.ts',
  'app/api/provider/patients/[id]/recommendation/route.ts',
];

describe('Sprint O.0.1 — recommendation generation routes pass subject.id', () => {
  test.each(RECOMMENDATION_GENERATION_ROUTES)('%s subject carries an id', (route) => {
    const src = readFile(route);
    // The subject literal MUST include an `id:` key inside the
    // guardOutgoing call OR the route must call
    // `recordRecommendationGenerated` directly.
    const hasId = /subject:\s*\{[^}]*\bid:/s.test(src);
    const hasDirect = /recordRecommendationGenerated/.test(src);
    expect(hasId || hasDirect).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 3 — guardOutgoing wires lifecycle for recommendation kinds
// ---------------------------------------------------------------------------

describe('Sprint O.0.1 — guardOutgoing wires lifecycle', () => {
  test('route-guard imports recordRecommendationGenerated', () => {
    const src = readFile('lib/governance/route-guard.ts');
    expect(src).toMatch(/recordRecommendationGenerated/);
  });
  test('route-guard imports recordUserEvent', () => {
    const src = readFile('lib/governance/route-guard.ts');
    expect(src).toMatch(/recordUserEvent/);
  });
  test('route-guard recognizes the 5 recommendation subject kinds', () => {
    const src = readFile('lib/governance/route-guard.ts');
    expect(src).toMatch(/'recommendation'/);
    expect(src).toMatch(/'provider_recommendation'/);
    expect(src).toMatch(/'arcana_recommendation'/);
    expect(src).toMatch(/'optimizer_recommendation'/);
    expect(src).toMatch(/'partner_recommendation'/);
  });
});
