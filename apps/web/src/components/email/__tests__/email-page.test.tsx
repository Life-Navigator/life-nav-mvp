/**
 * Component/integration tests for the Email dashboard page + parts.
 *
 * Covers: connect flow renders, list renders, empty state, disconnect flow,
 * and that NO token-shaped data is present in what the client renders.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EmailProviderCard, type EmailProviderStatus } from '../EmailProviderCard';
import { RecentEmailsList, type SafeEmailMessage } from '../RecentEmailsList';
import EmailPage from '@/app/dashboard/email/page';

const connectedGoogle: EmailProviderStatus = {
  provider: 'google',
  connected: true,
  email: 'user@gmail.com',
  connectedAt: '2026-06-16T00:00:00.000Z',
  oauthConfigured: true,
};

const disconnectedMicrosoft: EmailProviderStatus = {
  provider: 'microsoft',
  connected: false,
  email: null,
  connectedAt: null,
  oauthConfigured: true,
};

const sampleMessages: SafeEmailMessage[] = [
  {
    ref: 'abc123',
    fromName: 'Acme HR',
    fromEmail: 'hr@acme.com',
    subject: 'Your benefits enrollment',
    date: '2026-06-15T12:00:00.000Z',
    snippet: 'Open enrollment closes Friday...',
    unread: true,
  },
];

describe('EmailProviderCard', () => {
  test('connect flow: renders a Connect button when disconnected and fires onConnect', () => {
    const onConnect = jest.fn();
    render(
      <EmailProviderCard
        status={disconnectedMicrosoft}
        onConnect={onConnect}
        onDisconnect={jest.fn()}
      />
    );
    const btn = screen.getByTestId('email-connect-microsoft');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onConnect).toHaveBeenCalledWith('microsoft');
  });

  test('disconnect flow: renders Disconnect when connected and fires onDisconnect', () => {
    const onDisconnect = jest.fn();
    render(
      <EmailProviderCard
        status={connectedGoogle}
        onConnect={jest.fn()}
        onDisconnect={onDisconnect}
      />
    );
    expect(screen.getByTestId('email-status-connected-google')).toBeInTheDocument();
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('email-disconnect-google'));
    expect(onDisconnect).toHaveBeenCalledWith('google');
  });

  test('connect disabled + notice when OAuth not provisioned', () => {
    render(
      <EmailProviderCard
        status={{ ...disconnectedMicrosoft, oauthConfigured: false }}
        onConnect={jest.fn()}
        onDisconnect={jest.fn()}
      />
    );
    expect(screen.getByTestId('email-connect-microsoft')).toBeDisabled();
  });
});

describe('RecentEmailsList', () => {
  test('list renders messages', () => {
    render(<RecentEmailsList state="ready" messages={sampleMessages} anyConnected />);
    const list = screen.getByTestId('email-list');
    expect(within(list).getByText('Acme HR')).toBeInTheDocument();
    expect(within(list).getByText('Your benefits enrollment')).toBeInTheDocument();
  });

  test('empty state (connected) shows "No recent messages"', () => {
    render(<RecentEmailsList state="empty" messages={[]} anyConnected />);
    expect(screen.getByText('No recent messages')).toBeInTheDocument();
  });

  test('empty state (nothing connected) prompts to connect', () => {
    render(<RecentEmailsList state="empty" messages={[]} anyConnected={false} />);
    expect(screen.getByText('No email account connected')).toBeInTheDocument();
  });

  test('error state offers retry', () => {
    const onRetry = jest.fn();
    render(<RecentEmailsList state="error" messages={[]} anyConnected onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('email-list-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  test('loading state renders skeleton', () => {
    render(<RecentEmailsList state="loading" messages={[]} anyConnected />);
    expect(screen.getByTestId('email-list-loading')).toBeInTheDocument();
  });
});

describe('EmailPage (integration)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch(impl: (url: string) => unknown) {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      return {
        ok: true,
        json: async () => impl(url),
      } as Response;
    }) as unknown as typeof fetch;
  }

  test('disconnected pilot state: shows connect buttons + honest empty list, NO tokens', async () => {
    mockFetch((url) => {
      if (url.includes('/api/email/status')) {
        return {
          providers: [
            {
              provider: 'google',
              connected: false,
              email: null,
              connectedAt: null,
              oauthConfigured: true,
            },
            {
              provider: 'microsoft',
              connected: false,
              email: null,
              connectedAt: null,
              oauthConfigured: true,
            },
          ],
        };
      }
      if (url.includes('/api/email/messages')) {
        return { connected: false, messages: [] };
      }
      return {};
    });

    render(<EmailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('email-connect-google')).toBeInTheDocument();
    });
    expect(screen.getByTestId('email-connect-microsoft')).toBeInTheDocument();
    expect(screen.getByText('No email account connected')).toBeInTheDocument();

    // Token safety: nothing in the rendered DOM looks like a bearer token.
    expect(document.body.innerHTML).not.toMatch(/access_token|refresh_token|Bearer\s+[A-Za-z0-9]/);
  });

  test('connected state: renders the live message list', async () => {
    mockFetch((url) => {
      if (url.includes('/api/email/status')) {
        return {
          providers: [
            {
              provider: 'google',
              connected: true,
              email: 'user@gmail.com',
              connectedAt: null,
              oauthConfigured: true,
            },
            {
              provider: 'microsoft',
              connected: false,
              email: null,
              connectedAt: null,
              oauthConfigured: true,
            },
          ],
        };
      }
      if (url.includes('/api/email/messages')) {
        return { connected: true, messages: sampleMessages };
      }
      return {};
    });

    render(<EmailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('email-list')).toBeInTheDocument();
    });
    expect(screen.getByText('Your benefits enrollment')).toBeInTheDocument();
    expect(screen.getByTestId('email-status-connected-google')).toBeInTheDocument();
  });

  test('disconnect flow: posts to disconnect route then re-reads status', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/api/email/status')) {
        // First call connected, subsequent calls disconnected (post-disconnect).
        const isFirst = calls.filter((c) => c.includes('/api/email/status')).length === 1;
        return {
          ok: true,
          json: async () => ({
            providers: [
              {
                provider: 'google',
                connected: isFirst,
                email: isFirst ? 'user@gmail.com' : null,
                connectedAt: null,
                oauthConfigured: true,
              },
              {
                provider: 'microsoft',
                connected: false,
                email: null,
                connectedAt: null,
                oauthConfigured: true,
              },
            ],
          }),
        } as Response;
      }
      if (url.includes('/api/email/messages')) {
        return {
          ok: true,
          json: async () => ({ connected: true, messages: sampleMessages }),
        } as Response;
      }
      return { ok: true, json: async () => ({ success: true }) } as Response;
    }) as unknown as typeof fetch;

    render(<EmailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('email-disconnect-google')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('email-disconnect-google'));

    await waitFor(() => {
      expect(calls.some((c) => c === 'POST /api/integrations/google/disconnect')).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId('email-connect-google')).toBeInTheDocument();
    });
  });
});
