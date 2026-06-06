import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy route. The platform now has ONE unified auth experience at /auth.
 * Redirect in, preserving any query (error/registered/redirect/email) so old
 * email links and the /auth/confirm error redirects still land correctly.
 */
export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const q = new URLSearchParams({ mode: 'signin' });
  for (const k of [
    'error',
    'registered',
    'accountDeleted',
    'email',
    'expired',
    'next',
    'redirect',
  ]) {
    const v = p[k];
    if (typeof v === 'string') q.set(k, v);
  }
  redirect(`/auth?${q.toString()}`);
}
