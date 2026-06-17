'use client';

import {
  EmailProviderCard,
  type EmailProviderId,
  type EmailProviderStatus,
} from '@/components/email/EmailProviderCard';
import { EmailPrivacyNotice } from '@/components/email/EmailPrivacyNotice';

// Pilot scope: EMAIL is "Coming soon". Gmail is a Google *restricted* scope (needs verification +
// CASA before public use) and Outlook mail follows the same rollout — so for the pilot we surface
// a Coming-soon state instead of a Connect button and request NO mail scopes. Calendar is live.
const COMING_SOON_PROVIDERS: EmailProviderId[] = ['google', 'microsoft'];

const noop = () => {};

export default function EmailPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Email</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Inbox context is coming soon. Connect your calendar today on the{' '}
          <a href="/dashboard/calendar" className="font-medium text-teal-700 hover:underline">
            Calendar
          </a>{' '}
          page — email arrives once Google&rsquo;s security review for inbox access is complete.
        </p>
      </header>

      <section aria-label="Email connections" className="grid gap-4 sm:grid-cols-2">
        {COMING_SOON_PROVIDERS.map((provider) => {
          const status: EmailProviderStatus = {
            provider,
            connected: false,
            email: null,
            connectedAt: null,
            oauthConfigured: false,
          };
          return (
            <EmailProviderCard
              key={provider}
              status={status}
              comingSoon
              onConnect={noop}
              onDisconnect={noop}
            />
          );
        })}
      </section>

      <EmailPrivacyNotice />
    </div>
  );
}
