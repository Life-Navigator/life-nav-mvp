import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import {
  toProfilePrefsRow,
  upsertUserPreferences,
  getUserPreferences,
  preferencesToApiShape,
} from '@/lib/services/settingsService';

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

  let prefs: Record<string, unknown> | null = null;
  try {
    prefs = await getUserPreferences(supabase, user.id);
  } catch {
    prefs = null;
  }

  return NextResponse.json(preferencesToApiShape(profile ?? null, prefs));
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // 1) Display preferences -> public.profiles (theme/locale/timezone) via whitelist mapper.
  const profileRow = toProfilePrefsRow(body);
  const { error: profileError } = await (supabase as any)
    .from('profiles')
    .update(profileRow)
    .eq('id', user.id);
  if (profileError) {
    return safeApiError({
      code: 'db_persistence_error',
      internal: profileError,
      context: { route: 'PUT /api/user/settings', table: 'public.profiles' },
    });
  }

  // 2) Notification + dashboard preferences -> public.user_preferences via whitelist mapper.
  try {
    await upsertUserPreferences(supabase, user.id, body);
  } catch (prefError) {
    return safeApiError({
      code: 'db_persistence_error',
      internal: prefError,
      context: { route: 'PUT /api/user/settings', table: 'public.user_preferences' },
    });
  }

  // 3) Return the freshly persisted, friendly shape so the client round-trips correctly.
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('theme, locale, timezone')
    .eq('id', user.id)
    .single();
  let prefs: Record<string, unknown> | null = null;
  try {
    prefs = await getUserPreferences(supabase, user.id);
  } catch {
    prefs = null;
  }

  return NextResponse.json({ success: true, ...preferencesToApiShape(profile ?? null, prefs) });
}
