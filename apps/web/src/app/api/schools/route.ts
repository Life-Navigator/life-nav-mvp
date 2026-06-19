/**
 * GET /api/schools?q=&type= — search the global school/issuer catalog (public.school_catalog).
 *
 * Powers the searchable school picker (with logos). Read-only reference data shared by
 * all users. Free-text entries the user types that aren't in the catalog are allowed by
 * the picker and simply won't carry a logo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ schools: [] });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let query = sb
    .from('school_catalog')
    .select('id, name, domain, logo_url, type, location')
    .order('name', { ascending: true })
    .limit(20);
  if (q) query = query.ilike('name', `%${q}%`);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ schools: [] });
  return NextResponse.json({ schools: data || [] });
}
