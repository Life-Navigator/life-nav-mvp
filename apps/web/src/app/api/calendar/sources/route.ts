/**
 * Connected calendar sources (for the header's calendar widget).
 *
 * Calendar OAuth integrations are not yet wired for beta (provider credentials pending),
 * so there are no connected sources to list — we return an honest empty array rather than
 * 404. When the Google/Microsoft calendar integration lands, this reads connected sources
 * from core.integration_tokens.
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
  return NextResponse.json({ sources: [] });
}
