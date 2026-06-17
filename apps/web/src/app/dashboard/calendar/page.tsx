'use client';

/**
 * Calendar Dashboard
 *
 * Shows the user's upcoming events from connected calendar providers
 * (Google Calendar and Microsoft / Outlook Calendar) so Arcana can use
 * calendar context in its guidance.
 *
 * Honesty invariants:
 *  - Events are fetched from /api/calendar/events, which reads the stored
 *    provider token SERVER-SIDE and returns only safe display fields.
 *    The page never sees or handles provider tokens.
 *  - When a provider is disconnected, an honest "connect" state is shown.
 *  - When a provider is connected but has no upcoming events, an honest
 *    empty state is shown. No placeholder / sample events are ever rendered.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { format, isSameDay } from 'date-fns';
import type {
  CalendarEventsResponse,
  ProviderEvents,
  SafeCalendarEvent,
  CalendarProvider,
} from '@/app/api/calendar/events/route';

const PROVIDER_META: Record<
  CalendarProvider,
  { name: string; connectPath: string; disconnectPath: string; icon: string }
> = {
  google: {
    name: 'Google Calendar',
    connectPath: '/api/integrations/oauth/google?bundles=calendar&redirect=/dashboard/calendar',
    disconnectPath: '/api/integrations/google/disconnect',
    icon: '📅',
  },
  microsoft: {
    name: 'Outlook Calendar',
    connectPath: '/api/integrations/oauth/microsoft?bundles=calendar&redirect=/dashboard/calendar',
    disconnectPath: '/api/integrations/microsoft/disconnect',
    icon: '📆',
  },
};

const PROVIDER_ORDER: CalendarProvider[] = ['google', 'microsoft'];

function formatEventTime(event: SafeCalendarEvent): string {
  if (!event.start) return '';
  const start = new Date(event.start);
  if (event.allDay) {
    return `${format(start, 'EEE, MMM d')} · All day`;
  }
  const end = event.end ? new Date(event.end) : null;
  const datePart = format(start, 'EEE, MMM d');
  const startTime = format(start, 'h:mm a');
  if (end && isSameDay(start, end)) {
    return `${datePart} · ${startTime} – ${format(end, 'h:mm a')}`;
  }
  return `${datePart} · ${startTime}`;
}

function EventRow({ event }: { event: SafeCalendarEvent }) {
  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{event.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatEventTime(event)}</p>
          {event.location && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">📍 {event.location}</p>
          )}
          {event.attendees.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
              {event.attendees.length === 1
                ? event.attendees[0].name
                : `${event.attendees[0].name} +${event.attendees.length - 1} more`}
            </p>
          )}
        </div>
        {event.meetingUrl && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
          >
            Join
          </a>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  data,
  onConnect,
  onDisconnect,
  disconnecting,
}: {
  data: ProviderEvents;
  onConnect: (p: CalendarProvider) => void;
  onDisconnect: (p: CalendarProvider) => void;
  disconnecting: boolean;
}) {
  const meta = PROVIDER_META[data.provider];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {meta.icon}
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{meta.name}</h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                data.connected
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {data.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </div>

        {data.connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDisconnect(data.provider)}
            disabled={disconnecting}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        ) : (
          <Button size="sm" onClick={() => onConnect(data.provider)}>
            Connect
          </Button>
        )}
      </div>

      {/* Per-provider body */}
      {!data.connected ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect {meta.name} to see your upcoming events here.
        </p>
      ) : data.error ? (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {data.error} Try reconnecting if this persists.
          </p>
        </div>
      ) : data.events.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No upcoming events in the next 30 days.
        </p>
      ) : (
        <div>
          {data.events.map((event) => (
            <EventRow key={`${event.provider}-${event.id}`} event={event} />
          ))}
        </div>
      )}
    </Card>
  );
}

type LoadState = 'loading' | 'error' | 'ready';

export default function CalendarPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [providers, setProviders] = useState<ProviderEvents[]>([]);
  const [disconnecting, setDisconnecting] = useState<CalendarProvider | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoadState('loading');
      const res = await fetch('/api/calendar/events');
      if (!res.ok) {
        throw new Error('Failed to load calendar events');
      }
      const body = (await res.json()) as CalendarEventsResponse;
      // Keep a stable provider order regardless of API ordering.
      const ordered = PROVIDER_ORDER.map(
        (p) =>
          body.providers.find((entry) => entry.provider === p) || {
            provider: p,
            connected: false,
            events: [],
          }
      );
      setProviders(ordered);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleConnect = (provider: CalendarProvider) => {
    window.location.href = PROVIDER_META[provider].connectPath;
  };

  const handleDisconnect = async (provider: CalendarProvider) => {
    setDisconnecting(provider);
    try {
      const res = await fetch(PROVIDER_META[provider].disconnectPath, {
        method: 'POST',
      });
      if (res.ok) {
        await loadEvents();
      }
    } catch {
      // Surface via reload of state; keep the UI honest on failure.
      await loadEvents();
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <CalendarIcon className="w-7 h-7 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Your upcoming events from connected calendars.
      </p>

      {/* Privacy notice */}
      <div className="mb-6 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-4">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
          How Arcana uses your calendar
        </h2>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Arcana reads your upcoming event titles, times, locations, and attendee names to give you
          time-aware guidance. Your calendar is accessed read-only, processed securely on our
          servers, and never shared. Provider access tokens are stored encrypted and are never sent
          to your browser. Disconnect a provider at any time to stop access.
        </p>
      </div>

      {/* Loading state */}
      {loadState === 'loading' && (
        <div className="space-y-4" data-testid="calendar-loading">
          {[0, 1].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <Card className="p-8 text-center" data-testid="calendar-error">
          <p className="text-red-500 mb-4">We couldn&apos;t load your calendar right now.</p>
          <Button onClick={loadEvents}>Try again</Button>
        </Card>
      )}

      {/* Ready state */}
      {loadState === 'ready' && (
        <div className="space-y-4" data-testid="calendar-ready">
          {providers.map((p) => (
            <ProviderCard
              key={p.provider}
              data={p}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              disconnecting={disconnecting === p.provider}
            />
          ))}
        </div>
      )}
    </div>
  );
}
