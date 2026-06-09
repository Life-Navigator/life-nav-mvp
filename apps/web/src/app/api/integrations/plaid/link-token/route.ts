import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createLinkToken } from '@/lib/integrations/plaid/client';
import { safeApiError } from '@/lib/security/safe-error';
import { blockRealLinkIfBeta } from '@/lib/integrations/plaid/beta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const betaBlock = blockRealLinkIfBeta();
  if (betaBlock) return betaBlock;

  try {
    const body = await request.json();
    const { products } = body;
    const result = await createLinkToken(user.id, products);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Plaid link token error:', err);
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
