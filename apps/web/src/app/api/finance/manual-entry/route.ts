import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  createFinanceEntry,
  listFinanceEntries,
  type FinanceEntryType,
} from '@/lib/services/financeService';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const TYPES: FinanceEntryType[] = [
  'account',
  'transaction',
  'investment',
  'debt',
  'asset',
  'retirement',
];

// POST { type, data } — save a manual finance entry to the user's finance.* tables (RLS-scoped).
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const type = body?.type as FinanceEntryType;
    if (!TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of ${TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    const entry = await createFinanceEntry(supabase, user.id, type, body?.data || {});
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return safeApiError({ code: 'bad_request', internal: err });
  }
}

// GET ?type=account — list the user's manual entries (render-on-refresh).
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const type = (new URL(request.url).searchParams.get('type') || 'account') as FinanceEntryType;
    const entries = await listFinanceEntries(supabase, user.id, type);
    return NextResponse.json({ entries });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
