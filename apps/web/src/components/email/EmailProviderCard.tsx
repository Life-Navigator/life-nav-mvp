'use client';

import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

export type EmailProviderId = 'google' | 'microsoft';

export interface EmailProviderStatus {
  provider: EmailProviderId;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  oauthConfigured: boolean;
}

const PROVIDER_META: Record<EmailProviderId, { name: string; sub: string; icon: string }> = {
  google: { name: 'Gmail', sub: 'Google', icon: '✉️' },
  microsoft: { name: 'Outlook', sub: 'Microsoft', icon: '📧' },
};

interface EmailProviderCardProps {
  status: EmailProviderStatus;
  busy?: boolean;
  onConnect: (provider: EmailProviderId) => void;
  onDisconnect: (provider: EmailProviderId) => void;
}

export function EmailProviderCard({
  status,
  busy,
  onConnect,
  onDisconnect,
}: EmailProviderCardProps) {
  const meta = PROVIDER_META[status.provider];

  return (
    <Card className="p-5" data-testid={`email-provider-${status.provider}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {meta.icon}
          </span>
          <div>
            <p className="font-semibold">{meta.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{meta.sub}</p>
          </div>
        </div>

        {status.connected ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
            data-testid={`email-status-connected-${status.provider}`}
          >
            <CheckCircleIcon className="h-4 w-4" />
            Connected
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            data-testid={`email-status-disconnected-${status.provider}`}
          >
            Not connected
          </span>
        )}
      </div>

      {status.connected && status.email && (
        <p className="mt-3 truncate text-sm text-gray-700 dark:text-gray-300" title={status.email}>
          {status.email}
        </p>
      )}

      {!status.oauthConfigured && !status.connected && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Connection is not available yet &mdash; {meta.sub} sign-in is being provisioned.
        </p>
      )}

      <div className="mt-4">
        {status.connected ? (
          <Button
            variant="outline"
            size="sm"
            isLoading={busy}
            onClick={() => onDisconnect(status.provider)}
            data-testid={`email-disconnect-${status.provider}`}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            isLoading={busy}
            disabled={!status.oauthConfigured}
            onClick={() => onConnect(status.provider)}
            data-testid={`email-connect-${status.provider}`}
          >
            Connect {meta.name}
          </Button>
        )}
      </div>
    </Card>
  );
}
