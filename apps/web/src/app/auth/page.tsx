import type { Metadata } from 'next';
import UnifiedAuthExperience, {
  type AuthMode,
  type AuthNotice,
} from '@/components/auth/UnifiedAuthExperience';

export const metadata: Metadata = {
  title: 'Sign in · LifeNavigator',
  description:
    'Sign in, create your account, or get a magic link — one premium place to enter LifeNavigator.',
};

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  link_expired:
    'That link has expired or was already used. Request a fresh one below — it only takes a second.',
  confirmation_failed: 'We couldn’t verify that link. Request a new one below and try again.',
  invalid_confirmation_link: 'That link was incomplete. Request a fresh sign-in link below.',
  auth_not_configured: 'Sign-in is temporarily unavailable. Please try again shortly.',
};

function resolveMode(raw: string | undefined, returningSignal: boolean): AuthMode {
  switch (raw) {
    case 'signin':
    case 'login':
      return 'signin';
    case 'create':
    case 'register':
    case 'signup':
      return 'create';
    case 'magic':
    case 'magiclink':
      return 'magic';
    default:
      return returningSignal ? 'signin' : 'create';
  }
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const get = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);

  const errorCode = get('error');
  const error = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? 'Something went wrong. Try again below.')
    : null;
  const registered = get('registered') === 'true';
  const accountDeleted = get('accountDeleted') === 'true';
  const expired = get('expired') === 'true';

  let notice: AuthNotice = null;
  if (error) {
    notice = {
      tone: 'error',
      text: error,
      cta: { href: '/auth?mode=magic', label: 'Email me a new link →' },
    };
  } else if (registered) {
    notice = { tone: 'success', text: 'Account created. Sign in to continue.' };
  } else if (accountDeleted) {
    notice = { tone: 'info', text: 'Your account was deleted. You can create a new one anytime.' };
  } else if (expired) {
    notice = {
      tone: 'error',
      text: 'That link expired or was already used. Request a fresh one below.',
    };
  }

  const next = get('next') ?? get('redirect');
  const returningSignal = !!(error || registered || accountDeleted || expired || get('redirect'));
  const mode = resolveMode(get('mode'), returningSignal);

  return (
    <UnifiedAuthExperience
      defaultMode={mode}
      next={next}
      initialEmail={get('email') ?? ''}
      notice={notice}
    />
  );
}
