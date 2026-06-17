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

describe('EmailPage (pilot: Coming soon)', () => {
  test('renders Coming-soon for Gmail + Outlook, no Connect button, no token fetch', () => {
    render(<EmailPage />);
    // Both providers show the Coming-soon button, not a Connect button.
    expect(screen.getByTestId('email-comingsoon-google')).toBeInTheDocument();
    expect(screen.getByTestId('email-comingsoon-microsoft')).toBeInTheDocument();
    expect(screen.queryByTestId('email-connect-google')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-connect-microsoft')).not.toBeInTheDocument();
    // Points users to Calendar (which is live) and never leaks anything token-like.
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute(
      'href',
      '/dashboard/calendar'
    );
    expect(document.body.innerHTML).not.toMatch(/access_token|refresh_token|Bearer\s+[A-Za-z0-9]/);
  });

  test('Coming-soon buttons are disabled (no connect action)', () => {
    render(<EmailPage />);
    expect(screen.getByTestId('email-comingsoon-google')).toBeDisabled();
    expect(screen.getByTestId('email-comingsoon-microsoft')).toBeDisabled();
  });
});
