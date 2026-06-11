import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPersona } from '@/lib/integrations/plaid/personas';

export const dynamic = 'force-dynamic';

// Returns the user's ACTIVE beta persona (from the latest plaid_persona activation event) so the UI can be
// transparent about which sandbox profile is connected and when it was selected. No persona → { persona: null }.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ persona: null }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ persona: null }, { status: 401 });

  let ev: { event_metadata?: { persona_id?: string }; created_at?: string } | null = null;
  try {
    const { data } = await (supabase as any)
      .from('analytics_user_events')
      .select('event_metadata, created_at')
      .eq('user_id', user.id)
      .eq('subject_kind', 'plaid_persona')
      .order('created_at', { ascending: false })
      .limit(1);
    ev = data?.[0] ?? null;
  } catch {
    ev = null;
  }

  const pid = ev?.event_metadata?.persona_id;
  const persona = pid ? getPersona(pid) : null;
  if (!persona) return NextResponse.json({ persona: null });

  return NextResponse.json({
    persona: {
      persona_id: persona.persona_id,
      display_name: persona.display_name,
      profession: persona.profession,
      data_source: 'Plaid Sandbox Persona',
      selected_at: ev?.created_at ?? null,
    },
  });
}
