'use client';

import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { EnvelopeIcon, EnvelopeOpenIcon, InboxIcon } from '@heroicons/react/24/outline';

/** Client-safe message shape — mirrors /api/email/messages. No tokens, no raw ids. */
export interface SafeEmailMessage {
  ref: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  date: string | null;
  snippet: string;
  unread: boolean;
}

type ListState = 'loading' | 'error' | 'empty' | 'ready';

interface RecentEmailsListProps {
  state: ListState;
  messages: SafeEmailMessage[];
  onRetry?: () => void;
  /** Shown in the empty state so the user knows nothing is connected. */
  anyConnected: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RecentEmailsList({
  state,
  messages,
  onRetry,
  anyConnected,
}: RecentEmailsListProps) {
  if (state === 'loading') {
    return (
      <div className="space-y-2" data-testid="email-list-loading">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <Card className="p-8 text-center" data-testid="email-list-error">
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          We couldn&apos;t load your recent emails. Your connection may need to be refreshed.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} data-testid="email-list-retry">
            Try again
          </Button>
        )}
      </Card>
    );
  }

  if (state === 'empty') {
    return (
      <Card className="p-10 text-center" data-testid="email-list-empty">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <InboxIcon className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold">
          {anyConnected ? 'No recent messages' : 'No email account connected'}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {anyConnected
            ? 'Your inbox is empty or nothing new has arrived yet.'
            : 'Connect Gmail or Outlook above to see your recent messages here. Nothing is shown until you connect an account.'}
        </p>
      </Card>
    );
  }

  return (
    <ul
      className="divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800"
      data-testid="email-list"
    >
      {messages.map((m) => (
        <li
          key={m.ref}
          className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/40"
          data-testid="email-list-item"
        >
          <span className="mt-0.5 flex-shrink-0">
            {m.unread ? (
              <EnvelopeIcon
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
                aria-label="unread"
              />
            ) : (
              <EnvelopeOpenIcon className="h-5 w-5 text-gray-400" aria-label="read" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={`truncate text-sm ${m.unread ? 'font-semibold' : 'font-medium text-gray-700 dark:text-gray-300'}`}
                title={m.fromEmail}
              >
                {m.fromName || m.fromEmail || 'Unknown sender'}
              </p>
              <span className="flex-shrink-0 text-xs text-gray-400">{formatDate(m.date)}</span>
            </div>
            <p
              className={`truncate text-sm ${m.unread ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {m.subject}
            </p>
            {m.snippet && <p className="mt-0.5 truncate text-xs text-gray-400">{m.snippet}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
