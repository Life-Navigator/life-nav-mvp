// Plaid Exchange — exchanges a public_token for an access_token
// The access_token is encrypted and stored in finance.plaid_items
// The raw token never reaches the frontend

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { exchangePublicToken, getAccounts } from '../_shared/plaid.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const body = await req.json();
    const { publicToken, institutionId, institutionName } = body;
    if (!publicToken) {
      return new Response(JSON.stringify({ error: 'Missing publicToken' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Exchange public token for access token via Plaid API
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Encrypt and store — use service_role client for DB writes
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const encryptionKey = Deno.env.get('INTEGRATION_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY not configured');
    }

    // Encrypt the access token using the DB-level encryption RPC
    const { data: encrypted, error: encryptError } = await serviceClient
      .schema('core')
      .rpc('encrypt_text', { p_plaintext: accessToken, p_key: encryptionKey });

    if (encryptError) throw new Error(`Encryption failed: ${encryptError.message}`);

    // Upsert into finance.plaid_items
    const { error: insertError } = await serviceClient
      .schema('finance')
      .from('plaid_items')
      .upsert(
        {
          user_id: user.id,
          plaid_item_id: itemId,
          access_token_encrypted: encrypted,
          institution_id: institutionId || null,
          institution_name: institutionName || null,
          status: 'active',
        },
        { onConflict: 'plaid_item_id' },
      );

    if (insertError) throw new Error(`Store failed: ${insertError.message}`);

    // Fetch accounts from Plaid to return to the frontend
    const accounts = await getAccounts(accessToken);

    // Also sync accounts into finance.financial_accounts
    for (const acct of accounts) {
      await serviceClient
        .schema('finance')
        .from('financial_accounts')
        .upsert(
          {
            user_id: user.id,
            plaid_account_id: acct.account_id,
            account_name: acct.name || acct.official_name || 'Account',
            account_type: acct.type || 'unknown',
            account_subtype: acct.subtype || null,
            institution_name: institutionName || null,
            current_balance: acct.balances?.current ?? 0,
            available_balance: acct.balances?.available ?? null,
            currency: acct.balances?.iso_currency_code || 'USD',
            mask: acct.mask || null,
          },
          { onConflict: 'plaid_account_id' },
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountsLinked: accounts.length,
        accounts: accounts.map((a: Record<string, unknown>) => ({
          account_id: a.account_id,
          name: a.name,
          official_name: a.official_name,
          type: a.type,
          subtype: a.subtype,
          mask: a.mask,
          balances: a.balances,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
