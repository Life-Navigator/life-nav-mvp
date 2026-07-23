/** @jest-environment node */

// The route is now a thin proxy to core-api: it authenticates, records the
// activation funnel events, and forwards the persona_id with the caller's JWT.
// All Plaid work + finance.* persistence happen on the backend, so these tests
// assert the proxy contract (forwarding + analytics), not direct Plaid calls.

const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser, getSession: mockGetSession },
  })),
  createServiceRoleClient: jest.fn(() => ({})),
}));

const mockRecordEvent = jest.fn();
jest.mock('@/lib/analytics/events', () => ({
  recordUserEvent: (...a: unknown[]) => mockRecordEvent(...a),
}));

import { POST } from '@/app/api/integrations/plaid/activate-persona/route';

function req(body: unknown) {
  return { json: async () => body } as never;
}

const CORE = 'https://lifenavigator-core-api.fly.dev';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  delete process.env.NEXT_PUBLIC_API_URL; // skip the best-effort recommendation kickoff
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt-123' } } });
  mockRecordEvent.mockResolvedValue(undefined);
  global.fetch = jest.fn();
});

it('rejects unauthenticated callers with 401', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  const res = await POST(req({ persona_id: 'young_professional' }));
  expect(res.status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('rejects a missing/invalid persona_id with 400', async () => {
  const res = await POST(req({ persona_id: 123 }));
  expect(res.status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('forwards the persona_id + JWT to the backend and passes through the response', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      persona_id: 'young_professional',
      accounts_linked: 3,
      graph_promotion: 'enqueued',
    }),
  });

  const res = await POST(req({ persona_id: 'young_professional' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.success).toBe(true);
  expect(json.graph_promotion).toBe('enqueued');

  // Proxied to the backend activate-persona endpoint with the JWT + persona_id.
  expect(global.fetch).toHaveBeenCalledWith(
    `${CORE}/v1/finance/plaid/activate-persona`,
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      body: JSON.stringify({ persona_id: 'young_professional' }),
    })
  );

  // Funnel: selection recorded + activation recorded.
  expect(mockRecordEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ event_type: 'sample_financial_profile_selected' })
  );
  expect(mockRecordEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ event_type: 'sample_financial_profile_activated' })
  );
});

it('passes through a backend 503 and records a failure event', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({ detail: 'Sample financial profiles are not available yet.' }),
  });

  const res = await POST(req({ persona_id: 'young_professional' }));
  expect(res.status).toBe(503);
  expect(mockRecordEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ event_type: 'persona_activation_failed' })
  );
});
