import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listPublicPersonas } from '@/lib/integrations/plaid/personas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/plaid/personas
 * Returns the beta "sample financial profiles" — public fields only. Sandbox
 * usernames/passwords never appear here (see toPublicPersona / 'server-only').
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ personas: listPublicPersonas() });
}
