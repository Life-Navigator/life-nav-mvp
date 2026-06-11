import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listDependents, createDependent } from '@/lib/services/familyService';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const dependents = await listDependents(supabase, user.id);
    return NextResponse.json({ dependents });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const dependent = await createDependent(supabase, user.id, body);
    return NextResponse.json({ dependent }, { status: 201 });
  } catch (err) {
    return safeApiError({ code: 'bad_request', internal: err });
  }
}
