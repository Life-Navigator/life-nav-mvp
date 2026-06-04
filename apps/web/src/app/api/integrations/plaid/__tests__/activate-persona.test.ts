/** @jest-environment node */

const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser, getSession: mockGetSession },
    from: () => ({ insert: jest.fn(async () => ({ error: null })) }),
  })),
  createServiceRoleClient: jest.fn(() => ({ __svc: true })),
}));

const mockCreateSandbox = jest.fn();
const mockExchange = jest.fn();
const mockGetAccounts = jest.fn();
const mockGetTransactions = jest.fn();
jest.mock('@/lib/integrations/plaid/client', () => ({
  createSandboxPublicToken: (...a: unknown[]) => mockCreateSandbox(...a),
  exchangePublicToken: (...a: unknown[]) => mockExchange(...a),
  getAccounts: (...a: unknown[]) => mockGetAccounts(...a),
  getTransactions: (...a: unknown[]) => mockGetTransactions(...a),
}));

const mockPersistItem = jest.fn();
const mockPersistAccounts = jest.fn();
const mockPersistTxns = jest.fn();
jest.mock('@/lib/integrations/plaid/persist', () => ({
  persistPlaidItem: (...a: unknown[]) => mockPersistItem(...a),
  persistAccounts: (...a: unknown[]) => mockPersistAccounts(...a),
  persistTransactions: (...a: unknown[]) => mockPersistTxns(...a),
}));

const mockRecordEvent = jest.fn();
jest.mock('@/lib/analytics/events', () => ({
  recordUserEvent: (...a: unknown[]) => mockRecordEvent(...a),
}));

import { POST } from '@/app/api/integrations/plaid/activate-persona/route';

function req(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PLAID_CLIENT_ID = 'test-id';
  process.env.PLAID_CLIENT_SECRET = 'test-secret';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockGetSession.mockResolvedValue({ data: { session: null } });
});

it('rejects an unknown persona_id with 400', async () => {
  const res = await POST(req({ persona_id: 'not_a_real_persona' }));
  expect(res.status).toBe(400);
  expect(mockCreateSandbox).not.toHaveBeenCalled();
});

it('rejects unauthenticated callers with 401', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  const res = await POST(req({ persona_id: 'young_professional' }));
  expect(res.status).toBe(401);
});

it('returns 503 when Plaid is not configured', async () => {
  delete process.env.PLAID_CLIENT_ID;
  const res = await POST(req({ persona_id: 'young_professional' }));
  expect(res.status).toBe(503);
});

it('valid persona: exchanges sandbox token, syncs accounts, writes audit event', async () => {
  mockCreateSandbox.mockResolvedValue({ publicToken: 'public-sandbox-token' });
  mockExchange.mockResolvedValue({ accessToken: 'access-token', itemId: 'item-1' });
  mockGetAccounts.mockResolvedValue([
    {
      account_id: 'acct-1',
      name: 'Checking',
      type: 'depository',
      subtype: 'checking',
      balances: { current: 100 },
    },
  ]);
  mockPersistItem.mockResolvedValue(undefined);
  mockPersistAccounts.mockResolvedValue({ 'acct-1': 'fa-1' });
  mockGetTransactions.mockResolvedValue({ transactions: [], totalTransactions: 0 });
  mockPersistTxns.mockResolvedValue(0);
  mockRecordEvent.mockResolvedValue(undefined);

  const res = await POST(req({ persona_id: 'young_professional' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.success).toBe(true);
  expect(json.graph_promotion).toBe('enqueued');
  // sandbox token exchange works
  expect(mockCreateSandbox).toHaveBeenCalledTimes(1);
  expect(mockExchange).toHaveBeenCalledWith('public-sandbox-token');
  // account sync (persisting accounts fires the graph-promotion trigger = the
  // "financial activation job")
  expect(mockPersistItem).toHaveBeenCalledTimes(1);
  expect(mockPersistAccounts).toHaveBeenCalledTimes(1);
  // audit event written
  expect(mockRecordEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ event_type: 'sample_financial_profile_activated' })
  );
});
