import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy route. Unified auth lives at /auth — redirect into "create" mode,
 * preserving any query.
 */
export default async function LegacyRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const q = new URLSearchParams({ mode: 'create' });
  for (const k of ['email', 'next', 'redirect']) {
    const v = p[k];
    if (typeof v === 'string') q.set(k, v);
  }
  redirect(`/auth?${q.toString()}`);
}
