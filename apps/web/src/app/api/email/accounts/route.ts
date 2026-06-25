/**
 * Connected email accounts (for the header's account switcher).
 *
 * Email OAuth integrations are not yet wired for beta (provider credentials pending),
 * so there are no connected accounts to list — we return an honest empty array rather
 * than 404. When the Google/Microsoft email integration lands, this reads the connected
 * accounts from core.integration_tokens (see /api/email/status for the status shape).
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ accounts: [] });
}
