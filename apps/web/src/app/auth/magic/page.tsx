import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy route. Unified auth lives at /auth — redirect into "magic" mode,
 * preserving any query (email/expired) so resend links keep working.
 */
export default async function LegacyMagicPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const q = new URLSearchParams({ mode: 'magic' });
  for (const k of ['email', 'expired', 'next']) {
    const v = p[k];
    if (typeof v === 'string') q.set(k, v);
  }
  redirect(`/auth?${q.toString()}`);
}
