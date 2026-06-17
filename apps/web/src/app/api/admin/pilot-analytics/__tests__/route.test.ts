/** @jest-environment node */

/**
 * Tests for the pilot-analytics proxy route.
 *
 * Required invariants:
 *  - forwards the user's bearer token to the Core API
 *  - passes the upstream status through (notably 403 for non-admins, surfaced honestly)
 *  - 401 when there is no session token
 */

const mockToken = jest.fn();
jest.mock('@/app/api/life/_helper', () => ({
  CORE_API: 'https://core.test',
  token: () => mockToken(),
}));

import { GET } from '@/app/api/admin/pilot-analytics/route';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

it('returns 401 when there is no session token', async () => {
  mockToken.mockResolvedValue(null);
  const res = await GET();
  expect(res.status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('forwards the bearer token to the Core API pilot-analytics endpoint', async () => {
  mockToken.mockResolvedValue('JWT_123');
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 200,
    json: async () => ({ instruments: { total_feedback_rows: 0 } }),
  });

  const res = await GET();

  expect(global.fetch).toHaveBeenCalledWith(
    'https://core.test/v1/admin/pilot-analytics',
    expect.objectContaining({
      headers: { Authorization: 'Bearer JWT_123' },
      cache: 'no-store',
    })
  );
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ instruments: { total_feedback_rows: 0 } });
});

it('passes the upstream 403 (non-admin) status straight through', async () => {
  mockToken.mockResolvedValue('JWT_123');
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 403,
    json: async () => ({ detail: 'Admin access required' }),
  });

  const res = await GET();
  expect(res.status).toBe(403);
});

it('returns 502 when the upstream fetch throws', async () => {
  mockToken.mockResolvedValue('JWT_123');
  (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
  const res = await GET();
  expect(res.status).toBe(502);
});
