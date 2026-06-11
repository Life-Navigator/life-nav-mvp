'use client';

// Session-resume interstitial (Rules 1–4). An authenticated user hitting the auth pages lands here —
// NEVER silently resumed into onboarding/dashboard. They must explicitly Continue / Switch Account / Sign Out,
// so they always know who they are and why they're entering the app.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthSessionPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const logEvent = (event_type: string, metadata?: Record<string, unknown>) =>
    fetch('/api/auth/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, metadata }),
    }).catch(() => {});

  useEffect(() => {
    const sb = createClient();
    if (!sb) {
      router.replace('/auth?mode=signin');
      return;
    }
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/auth?mode=signin');
        return;
      }
      setEmail(user.email ?? null);
      const { data: prof } = await sb
        .from('profiles')
        .select('display_name, setup_completed, onboarding_completed')
        .eq('id', user.id)
        .single();
      const p = prof as {
        display_name?: string;
        setup_completed?: boolean;
        onboarding_completed?: boolean;
      } | null;
      setName(p?.display_name ?? null);
      setSetupDone(!!p?.setup_completed);
      setOnboardingDone(!!p?.onboarding_completed);
      setLoading(false);
      logEvent('AUTH_SESSION_RESUMED', { onboarding_completed: !!p?.onboarding_completed });
    });
  }, [router]);

  const onContinue = () => {
    setBusy('continue');
    logEvent('ONBOARDING_RESUMED');
    router.push(
      onboardingDone
        ? '/dashboard'
        : setupDone
          ? '/dashboard/advisor?onboarding=1'
          : '/onboarding/financial-profile'
    );
  };

  const signOutTo = async (event: string, dest: string) => {
    setBusy(event);
    await logEvent(event);
    const sb = createClient();
    await sb?.auth.signOut().catch(() => {});
    // Clear any client onboarding/persona caches so the next account starts clean.
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    router.push(dest);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking your session…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">You&apos;re already signed in</h1>
        <p className="mt-1 text-sm text-gray-500">Choose how you&apos;d like to continue.</p>

        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Account</span>
            <span className="font-medium text-gray-900">{email ?? '—'}</span>
          </div>
          {name && (
            <div className="mt-1 flex justify-between">
              <span className="text-gray-400">Name</span>
              <span className="text-gray-900">{name}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between">
            <span className="text-gray-400">Onboarding</span>
            <span className="text-gray-900">
              {onboardingDone ? 'Complete' : setupDone ? 'In progress (advisor)' : 'Not started'}
            </span>
          </div>
          {setupDone && !onboardingDone && (
            <p className="mt-2 text-xs text-gray-500">
              A beta persona is connected to this account. Continuing resumes that in-progress
              setup.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onContinue}
            disabled={!!busy}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy === 'continue' ? 'Continuing…' : 'Continue'}
          </button>
          <button
            onClick={() => signOutTo('AUTH_SWITCH_ACCOUNT', '/auth?mode=signin')}
            disabled={!!busy}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {busy === 'AUTH_SWITCH_ACCOUNT' ? 'Switching…' : 'Switch account'}
          </button>
          <button
            onClick={() => signOutTo('AUTH_SIGNOUT', '/auth?mode=signin')}
            disabled={!!busy}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-60"
          >
            {busy === 'AUTH_SIGNOUT' ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
