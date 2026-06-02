import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangePublicToken, getAccounts } from '@/lib/integrations/plaid/client';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { publicToken, institutionId, institutionName } = await request.json();
    if (!publicToken) {
      return NextResponse.json({ error: 'Missing publicToken' }, { status: 400 });
    }

    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Store in plaid_items table via Supabase
    const { error: insertError } = await (supabase as any).from('plaid_items').upsert(
      {
        user_id: user.id,
        item_id: itemId,
        access_token: accessToken,
        institution_id: institutionId || null,
        institution_name: institutionName || null,
        status: 'active',
      },
      { onConflict: 'item_id' }
    );

    if (insertError) throw insertError;

    // Fetch linked accounts to return to client
    const accounts = await getAccounts(accessToken);

    await recordUserEvent(supabase, {
      user_id: user.id,
      event_type: 'plaid_connected',
      event_metadata: {
        institution_id: institutionId ?? null,
        accounts_linked: accounts.length,
      },
      subject_kind: 'plaid_item',
      subject_id: itemId,
    });

    return NextResponse.json({
      success: true,
      accountsLinked: accounts.length,
      accounts,
    });
  } catch (err) {
    console.error('Plaid exchange error:', err);
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
