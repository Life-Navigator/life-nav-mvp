'use client';

import { ShieldCheckIcon } from '@heroicons/react/24/outline';

/**
 * Privacy notice: tells the user exactly what Arcana can access when they
 * connect an email account, and what it can NOT do. No tokens, no surprises.
 */
export function EmailPrivacyNotice() {
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40"
      data-testid="email-privacy-notice"
    >
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-900 dark:text-blue-100">
          <p className="font-semibold">What Arcana can access</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-blue-800 dark:text-blue-200">
            <li>Read recent messages from your inbox (sender, subject, date, a short preview).</li>
            <li>
              Your access stays server-side &mdash; your email password and access tokens are never
              shown to the app or stored unencrypted.
            </li>
          </ul>
          <p className="mt-2 font-semibold">What Arcana does not do</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-blue-800 dark:text-blue-200">
            <li>It does not send email on your behalf from this page.</li>
            <li>It does not share your messages with third parties.</li>
            <li>You can disconnect at any time; access is revoked immediately.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
