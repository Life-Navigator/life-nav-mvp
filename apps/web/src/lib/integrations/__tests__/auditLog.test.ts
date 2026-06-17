/** @jest-environment node */
/**
 * Tests for the integration audit-log helper.
 *
 * Invariants:
 *  - Events are persisted via the service-role `log_integration_event` RPC with
 *    correct user/tenant/provider/action scoping.
 *  - Token-bearing or otherwise sensitive context keys are SCRUBBED and never
 *    reach the RPC payload.
 *  - It DEGRADES GRACEFULLY: a missing service-role client, a missing RPC
 *    (gated migration not applied), or an RPC throw never throws to the caller.
 *  - classifyError returns a short safe label, never a raw message.
 */

const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: mockRpc })),
}));

import { logIntegrationEvent, classifyError } from '@/lib/integrations/auditLog';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  mockRpc.mockResolvedValue({ data: null, error: null });
});

it('persists an event via log_integration_event with correct scoping', async () => {
  await logIntegrationEvent({
    userId: 'user-1',
    tenantId: 'tenant-9',
    provider: 'google',
    action: 'email_list',
    success: true,
    integrationId: 'tok-1',
    context: { route: 'email/messages', count: 3 },
  });

  expect(mockRpc).toHaveBeenCalledTimes(1);
  const [fn, args] = mockRpc.mock.calls[0];
  expect(fn).toBe('log_integration_event');
  expect(args.p_user_id).toBe('user-1');
  expect(args.p_tenant_id).toBe('tenant-9');
  expect(args.p_provider).toBe('google');
  expect(args.p_action).toBe('email_list');
  expect(args.p_success).toBe(true);
  expect(args.p_integration_id).toBe('tok-1');
  expect(args.p_request_context).toEqual({ route: 'email/messages', count: 3 });
});

it('SCRUBS sensitive keys from context before they reach the RPC', async () => {
  await logIntegrationEvent({
    userId: 'user-1',
    provider: 'google',
    action: 'email_list',
    // Caller "mistakes" — all of these must be dropped.
    context: {
      route: 'email/messages',
      access_token: 'ya29.LEAK',
      refreshToken: '1//LEAK',
      authorization: 'Bearer LEAK',
      client_secret: 'LEAK',
      encryption_key: 'LEAK',
      code: 'AUTHCODE',
      body: 'raw email body',
      subject: 'private subject',
      count: 5,
    } as never,
  });

  const args = mockRpc.mock.calls[0][1];
  const ctx = args.p_request_context;
  expect(ctx).toEqual({ route: 'email/messages', count: 5 });
  const raw = JSON.stringify(args);
  expect(raw).not.toContain('ya29.LEAK');
  expect(raw).not.toContain('1//LEAK');
  expect(raw).not.toContain('Bearer LEAK');
  expect(raw).not.toContain('AUTHCODE');
  expect(raw).not.toContain('raw email body');
  expect(raw).not.toContain('private subject');
});

it('does NOT throw and does NOT call the RPC when the service-role client is unavailable', async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await expect(
    logIntegrationEvent({ userId: 'user-1', provider: 'google', action: 'connect_start' })
  ).resolves.toBeUndefined();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('degrades gracefully when the RPC is absent (gated migration not applied)', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
  await expect(
    logIntegrationEvent({ userId: 'user-1', provider: 'google', action: 'connect_start' })
  ).resolves.toBeUndefined();
});

it('never throws even if the RPC itself rejects', async () => {
  mockRpc.mockRejectedValue(new Error('network down'));
  await expect(
    logIntegrationEvent({ userId: 'user-1', provider: 'google', action: 'connect_start' })
  ).resolves.toBeUndefined();
});

it('skips silently when required fields are missing', async () => {
  await logIntegrationEvent({ userId: '', provider: 'google', action: 'connect_start' });
  expect(mockRpc).not.toHaveBeenCalled();
});

it('classifyError returns a short safe label, never a raw message', () => {
  expect(classifyError(new Error('token ya29.SECRET leaked here'))).toBe('Error');
  expect(classifyError({ code: 'PGRST202' })).toBe('PGRST202');
  expect(classifyError('Timeout: contacting host 1.2.3.4')).toBe('Timeout');
  expect(classifyError(null)).toBe('error');
});
