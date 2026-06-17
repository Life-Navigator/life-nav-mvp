/** @jest-environment node */
/**
 * Tests for the Google disconnect route.
 *
 * Invariants:
 *  - Disconnect removes the token via the service-role `disconnect_integration`
 *    RPC (same store/path as Microsoft), scoped to the authenticated user.
 *  - Best-effort Google revocation happens server-side; the token never leaves
 *    the server in the response.
 *  - Unauthenticated → 401, no RPC.
 *  - Audit logs disconnect_success / disconnect_failure with no token material.
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

const mockRevoke = jest.fn();
jest.mock('@/lib/integrations/google/oauth', () => ({
  GoogleOAuthService: jest.fn().mockImplementation(() => ({ revokeToken: mockRevoke })),
}));

const auditCalls: unknown[] = [];
jest.mock('@/lib/integrations/auditLog', () => ({
  logIntegrationEvent: jest.fn(async (e: unknown) => {
    auditCalls.push(e);
  }),
  classifyError: jest.fn(() => 'TestError'),
}));

import { POST } from '@/app/api/integrations/google/disconnect/route';

const ACCESS = 'ya29.GOOGLE-ACCESS-SECRET';

beforeEach(() => {
  jest.clearAllMocks();
  auditCalls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  process.env.INTEGRATION_ENCRYPTION_KEY = 'enc-key';
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockRevoke.mockResolvedValue(undefined);
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_integration_token') {
      return { data: [{ id: 'tok-1', access_token: ACCESS }], error: null };
    }
    return { data: null, error: null };
  });
});

it('returns 401 when unauthenticated and does not disconnect', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  const res = await POST({} as never);
  expect(res.status).toBe(401);
  expect(mockRpc).not.toHaveBeenCalled();
});

it('revokes at Google then removes the token via disconnect_integration', async () => {
  const res = await POST({} as never);
  expect(res.status).toBe(200);

  expect(mockRevoke).toHaveBeenCalledWith(ACCESS);
  const disconnectCall = mockRpc.mock.calls.find((c) => c[0] === 'disconnect_integration');
  expect(disconnectCall).toBeTruthy();
  expect(disconnectCall![1]).toEqual({ p_user_id: 'user-1', p_provider: 'google' });

  const body = await res.json();
  expect(body.success).toBe(true);
  expect(JSON.stringify(body)).not.toContain(ACCESS);

  const actions = auditCalls.map((c) => (c as { action: string }).action);
  expect(actions).toContain('disconnect_success');
  expect(JSON.stringify(auditCalls)).not.toContain(ACCESS);
});

it('still disconnects locally if Google revocation fails (non-fatal)', async () => {
  mockRevoke.mockRejectedValue(new Error('revoke failed'));
  const res = await POST({} as never);
  expect(res.status).toBe(200);
  const disconnectCall = mockRpc.mock.calls.find((c) => c[0] === 'disconnect_integration');
  expect(disconnectCall).toBeTruthy();
});

it('logs disconnect_failure when the RPC errors', async () => {
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_integration_token') {
      return { data: [{ id: 'tok-1', access_token: ACCESS }], error: null };
    }
    return { data: null, error: { message: 'db down' } };
  });
  await POST({} as never);
  const actions = auditCalls.map((c) => (c as { action: string }).action);
  expect(actions).toContain('disconnect_failure');
});
