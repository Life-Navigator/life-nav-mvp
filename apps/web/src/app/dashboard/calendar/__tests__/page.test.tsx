/** @jest-environment jsdom */

/**
 * Tests for the Calendar dashboard page states:
 *  - loading → ready → connect (disconnected) state
 *  - events render
 *  - empty state (connected, no events)
 *  - disconnect flow calls the correct endpoint and refetches
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CalendarPage from '../page';

function mockFetchOnce(body: unknown, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: async () => body,
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
  // jsdom: make window.location.href assignable without navigation errors.
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

afterEach(() => jest.clearAllMocks());

it('renders the privacy notice explaining how Arcana uses calendar context', async () => {
  mockFetchOnce({ providers: [] });
  render(<CalendarPage />);
  expect(screen.getByText(/How Arcana uses your calendar/i)).toBeInTheDocument();
  expect(screen.getByText(/accessed read-only/i)).toBeInTheDocument();
  // Let the pending fetch settle so the post-render state update is flushed.
  await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
});

it('shows the connect (disconnected) state for a provider with no token', async () => {
  mockFetchOnce({
    providers: [
      { provider: 'google', connected: false, events: [] },
      { provider: 'microsoft', connected: false, events: [] },
    ],
  });
  render(<CalendarPage />);

  await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
  expect(screen.getByText('Google Calendar')).toBeInTheDocument();
  expect(screen.getByText('Outlook Calendar')).toBeInTheDocument();
  expect(screen.getAllByText('Not connected')).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(2);
});

it('renders connected events with title, time and location', async () => {
  mockFetchOnce({
    providers: [
      {
        provider: 'google',
        connected: true,
        events: [
          {
            id: 'e1',
            provider: 'google',
            title: 'Quarterly Review',
            start: '2026-07-01T15:00:00Z',
            end: '2026-07-01T16:00:00Z',
            allDay: false,
            location: 'HQ Boardroom',
            attendees: [{ name: 'Alice' }, { name: 'Bob' }],
            meetingUrl: 'https://meet/xyz',
          },
        ],
      },
      { provider: 'microsoft', connected: false, events: [] },
    ],
  });
  render(<CalendarPage />);

  await waitFor(() => expect(screen.getByText('Quarterly Review')).toBeInTheDocument());
  expect(screen.getByText('HQ Boardroom', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('Alice +1 more')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', 'https://meet/xyz');
});

it('shows an honest empty state when connected but no events', async () => {
  mockFetchOnce({
    providers: [
      { provider: 'google', connected: true, events: [] },
      { provider: 'microsoft', connected: false, events: [] },
    ],
  });
  render(<CalendarPage />);

  await waitFor(() =>
    expect(screen.getByText(/No upcoming events in the next 30 days/i)).toBeInTheDocument()
  );
});

it('shows the error state and retries when the events API fails', async () => {
  mockFetchOnce({}, false);
  render(<CalendarPage />);

  await waitFor(() => expect(screen.getByTestId('calendar-error')).toBeInTheDocument());

  // Retry → succeeds.
  mockFetchOnce({
    providers: [{ provider: 'google', connected: false, events: [] }],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
});

it('disconnect flow posts to the provider disconnect endpoint and refetches', async () => {
  // initial load: google connected
  mockFetchOnce({
    providers: [
      { provider: 'google', connected: true, events: [] },
      { provider: 'microsoft', connected: false, events: [] },
    ],
  });
  render(<CalendarPage />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  );

  // disconnect POST + subsequent refetch
  mockFetchOnce({ success: true });
  mockFetchOnce({
    providers: [
      { provider: 'google', connected: false, events: [] },
      { provider: 'microsoft', connected: false, events: [] },
    ],
  });

  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith('/api/integrations/google/disconnect', {
      method: 'POST',
    })
  );
  await waitFor(() => expect(screen.getAllByText('Not connected')).toHaveLength(2));
});
