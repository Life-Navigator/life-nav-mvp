/** @jest-environment node */

/**
 * Tests for the advisor-chat proxy route. Required invariants:
 *  - 401 when there is no session token
 *  - forwards the user's bearer token to the Core API ADVISOR endpoint (mode="advisor"),
 *    NOT the discovery/onboarding endpoint
 *  - passes the upstream status through
 */

const mockToken = jest.fn();
jest.mock('@/app/api/life/_helper', () => ({
  CORE_API: 'https://core.test',
  token: () => mockToken(),
}));

import { POST } from '@/app/api/life/advisor/chat/route';

function req(body: unknown) {
  return { json: async () => body } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

it('returns 401 when there is no session token', async () => {
  mockToken.mockResolvedValue(null);
  const res = await POST(req({ message: 'hi' }));
  expect(res.status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('forwards the bearer token to the Core API ADVISOR endpoint (advisor mode)', async () => {
  mockToken.mockResolvedValue('JWT_123');
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 200,
    json: async () => ({ assistant_message: 'Here is your career picture.' }),
  });

  const res = await POST(req({ message: 'What about my career?' }));

  expect(res.status).toBe(200);
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  // Must hit the advisor endpoint, never the onboarding/discovery one.
  expect(url).toBe('https://core.test/v1/life/advisor/chat');
  expect(url).not.toContain('/discovery/');
  expect(init.headers.Authorization).toBe('Bearer JWT_123');
});

it('passes the upstream status through', async () => {
  mockToken.mockResolvedValue('JWT_123');
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 503,
    json: async () => ({ error: 'upstream down' }),
  });
  const res = await POST(req({ message: 'hi' }));
  expect(res.status).toBe(503);
});
