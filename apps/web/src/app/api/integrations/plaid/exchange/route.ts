import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangePublicToken, getAccounts } from '@/lib/integrations/plaid/client';

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

    return NextResponse.json({
      success: true,
      accountsLinked: accounts.length,
      accounts,
    });
  } catch (err) {
    console.error('Plaid exchange error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
