'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import {
  EmailProviderCard,
  type EmailProviderId,
  type EmailProviderStatus,
} from '@/components/email/EmailProviderCard';
import { RecentEmailsList, type SafeEmailMessage } from '@/components/email/RecentEmailsList';
import { EmailPrivacyNotice } from '@/components/email/EmailPrivacyNotice';

type ListState = 'loading' | 'error' | 'empty' | 'ready';

// OAuth bundles that include MAIL scope for each provider. The shared OAuth
// init routes default to no-mail (google) / mail (microsoft); we request mail
// explicitly so the connect button grants inbox read access.
const CONNECT_URL: Record<EmailProviderId, string> = {
  google: '/api/integrations/oauth/google?bundles=basic,gmail&redirect=/dashboard/email',
  microsoft: '/api/integrations/oauth/microsoft?bundles=basic,mail&redirect=/dashboard/email',
};

const DISCONNECT_URL: Record<EmailProviderId, string> = {
  google: '/api/integrations/google/disconnect',
  microsoft: '/api/integrations/microsoft/disconnect',
};

export default function EmailPage() {
  const [providers, setProviders] = useState<EmailProviderStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [busyProvider, setBusyProvider] = useState<EmailProviderId | null>(null);

  const [messages, setMessages] = useState<SafeEmailMessage[]>([]);
  const [listState, setListState] = useState<ListState>('loading');

  const anyConnected = providers.some((p) => p.connected);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(false);
    try {
      const res = await fetch('/api/email/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('status_failed');
      const json = (await res.json()) as { providers: EmailProviderStatus[] };
      setProviders(json.providers ?? []);
    } catch {
      setStatusError(true);
      setProviders([]);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (connected: EmailProviderStatus[]) => {
    const first = connected.find((p) => p.connected);
    if (!first) {
      setMessages([]);
      setListState('empty');
      return;
    }
    setListState('loading');
    try {
      const res = await fetch(`/api/email/messages?provider=${first.provider}&limit=10`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('messages_failed');
      const json = (await res.json()) as { connected: boolean; messages: SafeEmailMessage[] };
      const list = json.messages ?? [];
      setMessages(list);
      setListState(list.length === 0 ? 'empty' : 'ready');
    } catch {
      setMessages([]);
      setListState('error');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!statusLoading && !statusError) {
      void loadMessages(providers);
    }
  }, [statusLoading, statusError, providers, loadMessages]);

  const handleConnect = useCallback((provider: EmailProviderId) => {
    // Full-page redirect into the shared OAuth flow; it returns to /dashboard/email.
    window.location.href = CONNECT_URL[provider];
  }, []);

  const handleDisconnect = useCallback(
    async (provider: EmailProviderId) => {
      setBusyProvider(provider);
      try {
        await fetch(DISCONNECT_URL[provider], { method: 'POST' });
      } finally {
        setBusyProvider(null);
        await loadStatus();
      }
    },
    [loadStatus]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Email</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Connect Gmail or Outlook so Arcana can see recent context from your inbox.
        </p>
      </header>

      {/* Connection status */}
      <section aria-label="Email connections">
        {statusLoading ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="email-status-loading">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : statusError ? (
          <Card className="p-6 text-center" data-testid="email-status-error">
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              Unable to load your email connections.
            </p>
            <Button variant="outline" size="sm" onClick={loadStatus}>
              Try again
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {providers.map((p) => (
              <EmailProviderCard
                key={p.provider}
                status={p}
                busy={busyProvider === p.provider}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </section>

      <EmailPrivacyNotice />

      {/* Recent emails */}
      <section aria-label="Recent emails" className="space-y-3">
        <h2 className="text-lg font-semibold">Recent messages</h2>
        <RecentEmailsList
          state={listState}
          messages={messages}
          anyConnected={anyConnected}
          onRetry={() => loadMessages(providers)}
        />
      </section>
    </div>
  );
}
