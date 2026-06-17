/** @jest-environment node */
/**
 * Tests for the Google OAuth callback.
 *
 * Critical invariants verified here:
 *  - On success the callback persists the token via the SAME service-role
 *    `upsert_integration_token` RPC Microsoft uses (encrypted store), passing
 *    the encryption key and scoping to the authenticated user_id.
 *  - The browser NEVER receives the access/refresh token: the only thing that
 *    leaves the route is a redirect URL with success=google_connected and no
 *    token/code material.
 *  - Missing session → redirect to /login (no persistence).
 *  - The auth `code` is stripped from the post-handling redirect URL.
 *  - Audit events are logged (connect_start / connect_success) and NEVER
 *    contain the token.
 */

const mockGetUserId = jest.fn();
jest.mock('@/lib/jwt', () => ({
  getUserIdFromJWT: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: mockCookieGet })),
}));

const mockExchangeCode = jest.fn();
const mockGetUserInfo = jest.fn();
jest.mock('@/lib/integrations/google/oauth', () => ({
  createGoogleOAuthService: jest.fn(() => ({
    exchangeCode: mockExchangeCode,
    getUserInfo: mockGetUserInfo,
  })),
}));

const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: mockRpc })),
}));

// Capture audit calls; assert tokens never appear in them.
const auditCalls: unknown[] = [];
jest.mock('@/lib/integrations/auditLog', () => ({
  logIntegrationEvent: jest.fn(async (e: unknown) => {
    auditCalls.push(e);
  }),
  classifyError: jest.fn(() => 'TestError'),
}));

import { GET } from '@/app/api/integrations/oauth/callback/google/route';

const ACCESS = 'ya29.GOOGLE-ACCESS-SECRET';
const REFRESH = '1//GOOGLE-REFRESH-SECRET';
const CODE = 'AUTH-CODE-SECRET-4xyz';
const STATE = 'c3RhdGU.sig';

function req(qs: string) {
  const url = `https://app.test/api/integrations/oauth/callback/google?${qs}`;
  return { nextUrl: { searchParams: new URLSearchParams(qs) }, url } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  auditCalls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  process.env.INTEGRATION_ENCRYPTION_KEY = 'enc-key';
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';

  mockGetUserId.mockResolvedValue('user-1');
  mockCookieGet.mockImplementation((name: string) =>
    name === 'google_oauth_state' ? { value: STATE } : undefined
  );
  mockExchangeCode.mockResolvedValue({
    accessToken: ACCESS,
    refreshToken: REFRESH,
    expiresAt: new Date('2026-06-17T01:00:00.000Z'),
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    tokenType: 'Bearer',
  });
  mockGetUserInfo.mockResolvedValue({ id: 'goog-123', email: 'user@gmail.com' });
  mockRpc.mockResolvedValue({ data: 'token-row-id', error: null });
});

it('persists the token via upsert_integration_token (encrypted store) scoped to the user', async () => {
  const res = await GET(req(`code=${CODE}&state=${STATE}`));

  expect(mockRpc).toHaveBeenCalledTimes(1);
  const [fn, args] = mockRpc.mock.calls[0];
  expect(fn).toBe('upsert_integration_token');
  expect(args.p_user_id).toBe('user-1');
  expect(args.p_provider).toBe('google');
  expect(args.p_access_token).toBe(ACCESS);
  expect(args.p_refresh_token).toBe(REFRESH);
  expect(args.p_encryption_key).toBe('enc-key');
  expect(args.p_external_email).toBe('user@gmail.com');

  // Redirect on success, with NO token/code in the URL.
  expect(res.status).toBeGreaterThanOrEqual(300);
  expect(res.status).toBeLessThan(400);
  const location = res.headers.get('location') || '';
  expect(location).toContain('success=google_connected');
  expect(location).not.toContain(ACCESS);
  expect(location).not.toContain(REFRESH);
  expect(location).not.toContain(CODE);
});

it('redirects to /login and does NOT persist when there is no session', async () => {
  mockGetUserId.mockResolvedValue(null);
  const res = await GET(req(`code=${CODE}&state=${STATE}`));
  expect(mockRpc).not.toHaveBeenCalled();
  const location = res.headers.get('location') || '';
  expect(location).toContain('/login');
});

it('rejects a state mismatch (CSRF) without persisting', async () => {
  mockCookieGet.mockImplementation((name: string) =>
    name === 'google_oauth_state' ? { value: 'a-different-state' } : undefined
  );
  const res = await GET(req(`code=${CODE}&state=${STATE}`));
  expect(mockRpc).not.toHaveBeenCalled();
  expect(res.headers.get('location') || '').toContain('error=invalid_state');
});

it('shows honest disabled state when OAuth is not configured', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const res = await GET(req(`code=${CODE}&state=${STATE}`));
  expect(mockRpc).not.toHaveBeenCalled();
  expect(res.headers.get('location') || '').toContain('error=oauth_not_configured');
});

it('logs connect_start + connect_success audit events that NEVER contain the token', async () => {
  await GET(req(`code=${CODE}&state=${STATE}`));
  const actions = auditCalls.map((c) => (c as { action: string }).action);
  expect(actions).toContain('connect_start');
  expect(actions).toContain('connect_success');
  const raw = JSON.stringify(auditCalls);
  expect(raw).not.toContain(ACCESS);
  expect(raw).not.toContain(REFRESH);
  expect(raw).not.toContain(CODE);
});

it('logs connect_failure (no token) when the upsert fails', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
  const res = await GET(req(`code=${CODE}&state=${STATE}`));
  const actions = auditCalls.map((c) => (c as { action: string }).action);
  expect(actions).toContain('connect_failure');
  expect(res.headers.get('location') || '').toContain('error=exchange_failed');
  expect(JSON.stringify(auditCalls)).not.toContain(ACCESS);
});
