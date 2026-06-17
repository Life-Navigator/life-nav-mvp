/** @jest-environment node */
/**
 * Tests for the email API routes.
 *
 * Critical invariant: the decrypted provider access/refresh tokens are used
 * server-side to call Gmail/Graph but NEVER appear in the JSON returned to the
 * client. These tests assert that explicitly.
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

// Gmail client is mocked so we don't hit the network; it returns metadata
// shaped like the real GmailClient.
const mockListMessages = jest.fn();
const mockGetMessage = jest.fn();
jest.mock('@/lib/integrations/google/gmail', () => ({
  createGmailClient: jest.fn((token: string) => {
    // Capture that the SERVER got the real token (it should never be returned).
    (global as Record<string, unknown>).__lastGmailToken = token;
    return {
      listMessages: mockListMessages,
      getMessage: mockGetMessage,
      getHeader: (msg: { headers: Record<string, string> }, name: string) =>
        msg.headers[name.toLowerCase()],
    };
  }),
}));

import { GET as statusGET } from '@/app/api/email/status/route';
import { GET as messagesGET } from '@/app/api/email/messages/route';

const SECRET_ACCESS_TOKEN = 'ya29.SUPER-SECRET-ACCESS-TOKEN';
const SECRET_REFRESH_TOKEN = '1//SUPER-SECRET-REFRESH-TOKEN';

function msgReq(qs: string) {
  return { nextUrl: { searchParams: new URLSearchParams(qs) } } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  process.env.INTEGRATION_ENCRYPTION_KEY = 'enc-key';
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
  process.env.MICROSOFT_CLIENT_ID = 'mid';
  process.env.MICROSOFT_CLIENT_SECRET = 'msecret';
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('GET /api/email/status', () => {
  test('unauthenticated → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await statusGET();
    expect(res.status).toBe(401);
  });

  test('connected provider returns email but NEVER the token', async () => {
    mockRpc.mockImplementation(async (_fn: string, args: { p_provider: string }) => {
      if (args.p_provider === 'google') {
        return {
          data: [
            {
              access_token: SECRET_ACCESS_TOKEN,
              refresh_token: SECRET_REFRESH_TOKEN,
              external_email: 'user@gmail.com',
              expires_at: '2026-06-16T00:00:00.000Z',
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const res = await statusGET();
    const body = await res.json();
    const raw = JSON.stringify(body);

    const google = body.providers.find((p: { provider: string }) => p.provider === 'google');
    expect(google.connected).toBe(true);
    expect(google.email).toBe('user@gmail.com');

    // Token-leak guard.
    expect(raw).not.toContain(SECRET_ACCESS_TOKEN);
    expect(raw).not.toContain(SECRET_REFRESH_TOKEN);
    expect(raw).not.toContain('access_token');
    expect(raw).not.toContain('refresh_token');
  });

  test('no token row → connected:false, honest', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await statusGET();
    const body = await res.json();
    expect(body.providers.every((p: { connected: boolean }) => !p.connected)).toBe(true);
  });
});

describe('GET /api/email/messages', () => {
  test('unauthenticated → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await messagesGET(msgReq('provider=google'));
    expect(res.status).toBe(401);
  });

  test('bad provider → 400', async () => {
    const res = await messagesGET(msgReq('provider=yahoo'));
    expect(res.status).toBe(400);
  });

  test('not connected → connected:false, empty list (no mock data)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await messagesGET(msgReq('provider=google'));
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.messages).toEqual([]);
  });

  test('google: maps to safe fields and NEVER returns the token', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          access_token: SECRET_ACCESS_TOKEN,
          refresh_token: SECRET_REFRESH_TOKEN,
          external_email: 'user@gmail.com',
        },
      ],
      error: null,
    });
    mockListMessages.mockResolvedValue({ data: [{ id: 'gmail-real-id-1', threadId: 't1' }] });
    mockGetMessage.mockResolvedValue({
      labelIds: ['INBOX', 'UNREAD'],
      snippet: 'Open enrollment closes Friday',
      headers: {
        from: 'Acme HR <hr@acme.com>',
        subject: 'Your benefits enrollment',
        date: 'Mon, 15 Jun 2026 12:00:00 +0000',
      },
    });

    const res = await messagesGET(msgReq('provider=google&limit=5'));
    const body = await res.json();
    const raw = JSON.stringify(body);

    expect(body.connected).toBe(true);
    expect(body.messages).toHaveLength(1);
    const m = body.messages[0];
    expect(m.fromName).toBe('Acme HR');
    expect(m.fromEmail).toBe('hr@acme.com');
    expect(m.subject).toBe('Your benefits enrollment');
    expect(m.unread).toBe(true);
    expect(m.snippet).toBe('Open enrollment closes Friday');

    // Server DID receive the real token (used for the API call)...
    expect((global as Record<string, unknown>).__lastGmailToken).toBe(SECRET_ACCESS_TOKEN);
    // ...but it is NOT in the response, and neither is the raw provider id.
    expect(raw).not.toContain(SECRET_ACCESS_TOKEN);
    expect(raw).not.toContain(SECRET_REFRESH_TOKEN);
    expect(raw).not.toContain('gmail-real-id-1');
    expect(m.ref).not.toContain('gmail-real-id-1');
  });

  test('microsoft: maps Graph response to safe fields, no token leak', async () => {
    mockRpc.mockResolvedValue({
      data: [{ access_token: SECRET_ACCESS_TOKEN, external_email: 'user@outlook.com' }],
      error: null,
    });
    const graphFetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        value: [
          {
            id: 'graph-real-id-9',
            subject: 'Quarterly review',
            bodyPreview: 'Please prepare your numbers',
            receivedDateTime: '2026-06-14T09:30:00Z',
            isRead: false,
            from: { emailAddress: { name: 'Manager', address: 'mgr@work.com' } },
          },
        ],
      }),
    }));
    global.fetch = graphFetch as unknown as typeof fetch;

    const res = await messagesGET(msgReq('provider=microsoft'));
    const body = await res.json();
    const raw = JSON.stringify(body);

    expect(body.connected).toBe(true);
    expect(body.messages[0].fromEmail).toBe('mgr@work.com');
    expect(body.messages[0].unread).toBe(true);
    // Graph called with bearer token server-side.
    expect(graphFetch).toHaveBeenCalled();
    expect(raw).not.toContain(SECRET_ACCESS_TOKEN);
    expect(raw).not.toContain('graph-real-id-9');
  });

  test('provider failure (e.g. expired token) → 503 honest error, no fabricated list', async () => {
    mockRpc.mockResolvedValue({
      data: [{ access_token: SECRET_ACCESS_TOKEN, external_email: 'user@gmail.com' }],
      error: null,
    });
    mockListMessages.mockRejectedValue(new Error('Gmail API error: Invalid Credentials'));
    const res = await messagesGET(msgReq('provider=google'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.messages).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(SECRET_ACCESS_TOKEN);
  });
});
