'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mark } from '@/components/brand/Logo';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';
import DeviceMockup from '@/components/site/DeviceMockup';
import FloatingInsightCard from '@/components/site/FloatingInsightCard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/analytics/auth-events';

/**
 * The single, unified authentication experience for the whole platform.
 *
 * One premium page handles all three modes — Sign in / Create account / Magic
 * link — so every entry point (Sign In, Get Started, Freemium, Beta Access,
 * Join Beta) lands on the same branded journey. The dark, editorial system,
 * the live dashboard mockup, and the floating recommendation cards match the
 * marketing site, and the post-auth transition overlay carries that same
 * aesthetic straight into onboarding so the seam disappears.
 */

export type AuthMode = 'signin' | 'create' | 'magic';

export type AuthNotice = {
  tone: 'success' | 'error' | 'info';
  text: string;
  cta?: { href: string; label: string };
} | null;

// eslint-disable-next-line no-useless-escape
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;

const inputClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-[#2dd4bf]/50 focus:ring-2 focus:ring-[#2dd4bf]/25 disabled:opacity-60';
const oauthClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50';

const COPY: Record<AuthMode, { title: string; subtitle: string; tab: string }> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in to your decision-intelligence dashboard.',
    tab: 'Sign in',
  },
  create: {
    title: 'Create your account',
    subtitle: 'Start making decisions grounded in your own data.',
    tab: 'Create account',
  },
  magic: {
    title: 'Get your sign-in link',
    subtitle: 'No password needed — we email you a secure link.',
    tab: 'Magic link',
  },
};

function TransitionOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[#06060a]/95 text-white backdrop-blur-sm">
      <Mark className="h-10 w-10" size={40} />
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[#2dd4bf]" />
      <p className="text-sm font-medium text-white/70">{message}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function UnifiedAuthExperience({
  defaultMode = 'signin',
  next,
  initialEmail = '',
  notice = null,
}: {
  defaultMode?: AuthMode;
  next?: string;
  initialEmail?: string;
  notice?: AuthNotice;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentKind, setSentKind] = useState<'magic' | 'signup'>('magic');

  // Only honor in-app relative paths for the post-auth destination.
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  function switchMode(m: AuthMode) {
    setMode(m);
    setError(null);
    setSentTo(null);
  }

  function client() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Authentication is temporarily unavailable. Please try again shortly.');
      setBusy(false);
      return null;
    }
    return supabase;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = client();
    if (!supabase) return;

    trackAuthEvent({ event: 'login_started', metadata: { method: 'password' } });
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      trackAuthEvent({ event: 'login_error', error: authError.message });
      setError(
        /invalid login/i.test(authError.message)
          ? 'That email and password don’t match. Try again, or use a magic link.'
          : authError.message
      );
      setBusy(false);
      return;
    }
    trackAuthEvent({ event: 'login_success', metadata: { method: 'password' } });
    setOverlay('Loading your dashboard…');
    router.push(dest);
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError(
        'Use at least 12 characters with uppercase, lowercase, a number, and a special character.'
      );
      return;
    }
    if (!agree) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setBusy(true);
    const supabase = client();
    if (!supabase) return;

    trackAuthEvent({ event: 'signup_started' });
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });
    if (authError) {
      trackAuthEvent({ event: 'signup_error', error: authError.message });
      setError(authError.message);
      setBusy(false);
      return;
    }
    trackAuthEvent({ event: 'signup_success' });

    // If email confirmation is required, no session is returned — show the
    // branded "check your email" state. If a session exists, the account is
    // live now, so flow straight into onboarding without a hand-off seam.
    if (data.session) {
      setOverlay('Preparing your profile…');
      router.push('/onboarding/financial-profile');
      router.refresh();
      return;
    }
    setSentKind('signup');
    setSentTo(email);
    setBusy(false);
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = client();
    if (!supabase) return;

    trackAuthEvent({ event: 'login_started', metadata: { method: 'magiclink' } });
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/confirm?next=/onboarding`,
      },
    });
    if (authError && !/rate|limit|seconds/i.test(authError.message)) {
      // Don't leak whether an email exists; only surface true rate-limits.
      trackAuthEvent({ event: 'login_error', error: authError.message });
    }
    if (authError && /rate|limit|seconds/i.test(authError.message)) {
      setError('You’ve requested a few links quickly. Please wait a minute and try again.');
      setBusy(false);
      return;
    }
    trackAuthEvent({ event: 'login_success', metadata: { method: 'magiclink_sent' } });
    setSentKind('magic');
    setSentTo(email);
    setBusy(false);
  }

  async function handleOAuth(provider: 'google' | 'linkedin_oidc') {
    setBusy(true);
    setError(null);
    const supabase = client();
    if (!supabase) return;
    trackAuthEvent({ event: 'oauth_started', provider });
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (authError) {
      trackAuthEvent({ event: 'login_error', provider, error: authError.message });
      setError(authError.message);
      setBusy(false);
    }
  }

  const noticeTone =
    notice?.tone === 'success'
      ? 'border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#a7f3e4]'
      : notice?.tone === 'error'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
        : 'border-white/12 bg-white/[0.04] text-white/70';

  return (
    <div className="relative min-h-screen bg-[#06060a] text-white antialiased">
      <ParallaxBackdrop />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* ── Brand panel: live dashboard mockup + floating recommendation cards ── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-12 lg:flex">
          <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-70" />
          <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-50" />

          <Link href="/" className="relative inline-flex items-center gap-2">
            <Mark className="h-8 w-8" size={32} />
            <span className="text-lg font-semibold tracking-tight">LifeNavigator</span>
          </Link>

          <div className="relative my-8">
            <h2 className="font-display text-[2.6rem] font-medium leading-[1.05] tracking-tight">
              One place to decide
              <br />
              <span className="italic-display text-gradient">your whole life.</span>
            </h2>

            <div className="relative mt-10 max-w-[440px]">
              <DeviceMockup variant="laptop" />
              <FloatingInsightCard
                className="float absolute -left-6 top-6 w-56 shadow-2xl"
                eyebrow="Grounded"
                spark
                title="Your checking balance is $3,200.00"
                detail="Cited from your accounts — never invented."
              />
              <FloatingInsightCard
                className="float-2 absolute -right-5 bottom-2 w-56 shadow-2xl"
                eyebrow="Recommendation"
                spark
                title="Pay down the 21.99% card first"
                detail="$1,420/yr saved vs. the market’s expected return."
              />
            </div>
          </div>

          <p className="relative text-sm text-white/45">
            Finances, career, education, health, and goals — reasoned together, private by
            architecture.
          </p>
        </aside>

        {/* ── Form panel ── */}
        <main className="flex items-center justify-center px-6 py-14 sm:px-10">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
              <Mark className="h-8 w-8" size={32} />
              <span className="text-lg font-semibold tracking-tight">LifeNavigator</span>
            </Link>

            {sentTo ? (
              <CheckEmail
                email={sentTo}
                kind={sentKind}
                busy={busy}
                onResend={
                  sentKind === 'magic' ? () => handleMagic(new Event('submit') as never) : undefined
                }
                onBack={() => switchMode(sentKind === 'magic' ? 'magic' : 'signin')}
              />
            ) : (
              <>
                <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
                  {COPY[mode].title}
                </h1>
                <p className="mt-3 text-white/55">{COPY[mode].subtitle}</p>

                {/* mode switcher */}
                <div className="mt-7 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
                  {(['signin', 'create', 'magic'] as AuthMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`rounded-lg px-2 py-2 font-medium transition ${
                        mode === m
                          ? 'bg-white/[0.08] text-white shadow-sm'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {COPY[m].tab}
                    </button>
                  ))}
                </div>

                {notice && (
                  <div className={`mt-6 rounded-xl border p-3 text-sm ${noticeTone}`}>
                    <p>{notice.text}</p>
                    {notice.cta && (
                      <Link
                        href={notice.cta.href}
                        className="mt-1 inline-block font-semibold underline"
                      >
                        {notice.cta.label}
                      </Link>
                    )}
                  </div>
                )}

                {error && (
                  <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="mt-6">
                  {mode === 'signin' && (
                    <SignInForm
                      email={email}
                      password={password}
                      busy={busy}
                      onEmail={setEmail}
                      onPassword={setPassword}
                      onSubmit={handleSignIn}
                      onOAuth={handleOAuth}
                    />
                  )}
                  {mode === 'create' && (
                    <CreateForm
                      name={name}
                      email={email}
                      password={password}
                      confirm={confirm}
                      agree={agree}
                      busy={busy}
                      onName={setName}
                      onEmail={setEmail}
                      onPassword={setPassword}
                      onConfirm={setConfirm}
                      onAgree={setAgree}
                      onSubmit={handleCreate}
                    />
                  )}
                  {mode === 'magic' && (
                    <MagicForm
                      email={email}
                      busy={busy}
                      onEmail={setEmail}
                      onSubmit={handleMagic}
                    />
                  )}
                </div>

                <p className="mt-8 text-center text-xs text-white/35">
                  By continuing you agree to our{' '}
                  <Link href="/legal/terms" className="text-white/55 hover:text-white">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/legal/privacy" className="text-white/55 hover:text-white">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </main>
      </div>

      {overlay && <TransitionOverlay message={overlay} />}
    </div>
  );
}

function CheckEmail({
  email,
  kind,
  busy,
  onResend,
  onBack,
}: {
  email: string;
  kind: 'magic' | 'signup';
  busy: boolean;
  onResend?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#2dd4bf]/15 text-[#5eead4]">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 6h16v12H4z" strokeLinejoin="round" />
          <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="font-display text-2xl font-medium tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-white/60">
        We sent a secure {kind === 'signup' ? 'verification' : 'sign-in'} link to{' '}
        <span className="font-medium text-white/85">{email}</span>. Open it on this device to
        continue — it expires in 1 hour.
      </p>
      <div className="mt-6 space-y-3">
        {onResend && (
          <button
            type="button"
            onClick={onResend}
            disabled={busy}
            className="btn-ghost w-full rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Sending verification…' : 'Resend link'}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-[#5eead4] hover:underline"
        >
          ← Use a different email
        </button>
      </div>
    </div>
  );
}

function SignInForm({
  email,
  password,
  busy,
  onEmail,
  onPassword,
  onSubmit,
  onOAuth,
}: {
  email: string;
  password: string;
  busy: boolean;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOAuth: (p: 'google' | 'linkedin_oidc') => void;
}) {
  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            disabled={busy}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-white/70">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-[#5eead4] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            disabled={busy}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#06060a] px-3 text-white/40">Or continue with</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onOAuth('google')}
            disabled={busy}
            className={oauthClass}
          >
            <GoogleIcon />
            <span>Google</span>
          </button>
          <button
            type="button"
            onClick={() => onOAuth('linkedin_oidc')}
            disabled={busy}
            className={oauthClass}
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="#0A66C2" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span>LinkedIn</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateForm({
  name,
  email,
  password,
  confirm,
  agree,
  busy,
  onName,
  onEmail,
  onPassword,
  onConfirm,
  onAgree,
  onSubmit,
}: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  agree: boolean;
  busy: boolean;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  onAgree: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-white/70">
          Full name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => onName(e.target.value)}
          disabled={busy}
          className={inputClass}
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          disabled={busy}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/70">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          disabled={busy}
          className={inputClass}
          placeholder="Create a strong password"
        />
        <p className="mt-1.5 text-xs text-white/40">
          At least 12 characters with uppercase, lowercase, a number, and a special character.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-white/70">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          disabled={busy}
          className={inputClass}
          placeholder="Re-enter your password"
        />
      </div>
      <div className="flex items-start gap-3">
        <input
          id="agree"
          type="checkbox"
          checked={agree}
          onChange={(e) => onAgree(e.target.checked)}
          disabled={busy}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-[#2dd4bf] accent-[#2dd4bf] focus:ring-[#2dd4bf]"
        />
        <label htmlFor="agree" className="text-sm text-white/65">
          I agree to the{' '}
          <Link href="/legal/terms" className="text-[#5eead4] hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="text-[#5eead4] hover:underline">
            Privacy Policy
          </Link>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

function MagicForm({
  email,
  busy,
  onEmail,
  onSubmit,
}: {
  email: string;
  busy: boolean;
  onEmail: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          disabled={busy}
          className={inputClass}
          placeholder="you@example.com"
        />
        <p className="mt-1.5 text-xs text-white/40">
          We’ll email a one-tap link. New here? Use “Create account” to set a password.
        </p>
      </div>
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? 'Sending verification…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
