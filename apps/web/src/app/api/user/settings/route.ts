import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('theme, locale, timezone')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    theme: profile?.theme || 'system',
    language: profile?.locale?.split('-')[0] || 'en',
    currency: 'USD',
    notificationsEnabled: true,
    dashboardLayout: 'default',
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const updates: Record<string, unknown> = {
    theme: body.theme || 'system',
    updated_at: new Date().toISOString(),
  };
  if (body.language) {
    updates.locale = `${body.language}-US`;
  }

  const { error } = await (supabase as any).from('profiles').update(updates).eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
