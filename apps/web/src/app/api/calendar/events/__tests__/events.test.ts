/** @jest-environment node */

/**
 * Tests for the calendar events aggregation route.
 *
 * Focus areas required by the sprint:
 *  - disconnected provider → honest empty state (connected:false, no events)
 *  - connected provider → events render with only SAFE fields
 *  - provider failure isolation → one provider's error never hides the other
 *  - token NOT exposed → no access/refresh token ever appears in the response
 */

const mockGetUser = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: mockRpc })),
}));

// Google calendar client is mocked so we control the raw provider payload.
const mockListEvents = jest.fn();
jest.mock('@/lib/integrations/google/calendar', () => ({
  GoogleCalendarClient: jest.fn().mockImplementation(() => ({
    listEvents: (...a: unknown[]) => mockListEvents(...a),
  })),
}));

import { GET } from '@/app/api/calendar/events/route';

const ACCESS = 'ACCESS_TOKEN_SHOULD_NEVER_LEAK';
const REFRESH = 'REFRESH_TOKEN_SHOULD_NEVER_LEAK';

function googleToken() {
  return {
    id: 'tok-1',
    access_token: ACCESS,
    refresh_token: REFRESH,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    scope: 'calendar.readonly',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  process.env.INTEGRATION_ENCRYPTION_KEY = 'enc';
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  // Default: global fetch (used by Microsoft Graph) returns no events.
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ value: [] }),
  })) as unknown as typeof fetch;
});

it('returns 401 when not authenticated', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  const res = await GET();
  expect(res.status).toBe(401);
});

it('reports disconnected providers with an honest empty state', async () => {
  // No tokens stored for either provider.
  mockRpc.mockResolvedValue({ data: [], error: null });
  const res = await GET();
  const body = await res.json();

  expect(res.status).toBe(200);
  const google = body.providers.find((p: { provider: string }) => p.provider === 'google');
  const microsoft = body.providers.find((p: { provider: string }) => p.provider === 'microsoft');
  expect(google.connected).toBe(false);
  expect(google.events).toEqual([]);
  expect(microsoft.connected).toBe(false);
  expect(microsoft.events).toEqual([]);
});

it('renders Google events mapped to safe fields only', async () => {
  mockRpc.mockImplementation(async (_fn: string, args: { p_provider: string }) => {
    if (args.p_provider === 'google') return { data: [googleToken()], error: null };
    return { data: [], error: null };
  });
  mockListEvents.mockResolvedValue({
    data: [
      {
        id: 'evt-1',
        summary: 'Standup',
        location: 'Room 4',
        start: { dateTime: '2026-07-01T15:00:00Z' },
        end: { dateTime: '2026-07-01T15:30:00Z' },
        status: 'confirmed',
        htmlLink: 'https://cal/evt-1',
        attendees: [
          { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
          { email: 'bob@example.com', responseStatus: 'needsAction' },
        ],
        conferenceData: {
          entryPoints: [{ entryPointType: 'video', uri: 'https://meet/abc' }],
        },
      },
    ],
  });

  const res = await GET();
  const body = await res.json();
  const google = body.providers.find((p: { provider: string }) => p.provider === 'google');

  expect(google.connected).toBe(true);
  expect(google.events).toHaveLength(1);
  const e = google.events[0];
  expect(e.title).toBe('Standup');
  expect(e.location).toBe('Room 4');
  expect(e.meetingUrl).toBe('https://meet/abc');
  expect(e.attendees).toEqual([
    { name: 'Alice', responseStatus: 'accepted' },
    { name: 'bob', responseStatus: 'needsAction' }, // email local-part only, never raw email
  ]);
});

it('NEVER exposes provider tokens in the response', async () => {
  mockRpc.mockImplementation(async (_fn: string, args: { p_provider: string }) => {
    if (args.p_provider === 'google') return { data: [googleToken()], error: null };
    return { data: [], error: null };
  });
  mockListEvents.mockResolvedValue({
    data: [
      {
        id: 'evt-1',
        summary: 'Secret Meeting',
        start: { dateTime: '2026-07-01T15:00:00Z' },
        end: { dateTime: '2026-07-01T15:30:00Z' },
        status: 'confirmed',
      },
    ],
  });

  const res = await GET();
  const raw = JSON.stringify(await res.json());
  expect(raw).not.toContain(ACCESS);
  expect(raw).not.toContain(REFRESH);
  expect(raw).not.toContain('access_token');
  expect(raw).not.toContain('refresh_token');
});

it('isolates a provider failure so the other provider still returns events', async () => {
  mockRpc.mockResolvedValue({ data: [googleToken()], error: null });
  // Google API throws; Microsoft Graph (global fetch) succeeds with empty list.
  mockListEvents.mockRejectedValue(new Error('boom'));

  const res = await GET();
  const body = await res.json();
  const google = body.providers.find((p: { provider: string }) => p.provider === 'google');
  const microsoft = body.providers.find((p: { provider: string }) => p.provider === 'microsoft');

  expect(google.connected).toBe(true);
  expect(google.error).toBeTruthy();
  expect(google.events).toEqual([]); // no fabricated data on failure
  // Microsoft is unaffected.
  expect(microsoft.connected).toBe(true);
  expect(microsoft.error).toBeUndefined();
});
