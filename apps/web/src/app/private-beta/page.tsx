import Link from 'next/link';

export const metadata = { title: 'Private beta — LifeNavigator' };

// Public page shown to authenticated-but-not-allowlisted users (and any blocked access). No app data.
export default function PrivateBetaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          LifeNavigator is in private beta
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Access is currently limited to approved testers. If you were invited, please sign in with
          the email address associated with your invitation.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/auth?mode=signin"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Sign in with your invited email
          </Link>
          <Link
            href="/waitlist"
            className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Request access
          </Link>
        </div>
      </div>
    </main>
  );
}
