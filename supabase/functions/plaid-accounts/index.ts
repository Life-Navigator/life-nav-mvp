// Plaid Accounts — fetches linked bank accounts for the authenticated user
// Decrypts access tokens server-side, calls Plaid, returns sanitized data

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAccounts } from '../_shared/plaid.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  if (req.method !== 'GET' && req.method !== 'POST') {
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

    // Service client for encrypted data access
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Fetch user's Plaid items
    const { data: items, error: fetchError } = await serviceClient
      .schema('finance')
      .from('plaid_items')
      .select('plaid_item_id, access_token_encrypted, institution_name, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ accounts: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const encryptionKey = Deno.env.get('INTEGRATION_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('INTEGRATION_ENCRYPTION_KEY not configured');

    const allAccounts: Record<string, unknown>[] = [];

    for (const item of items) {
      try {
        // Decrypt access token
        const { data: accessToken, error: decryptError } = await serviceClient
          .schema('core')
          .rpc('decrypt_text', {
            p_ciphertext: item.access_token_encrypted,
            p_key: encryptionKey,
          });

        if (decryptError || !accessToken) continue;

        // Fetch accounts from Plaid
        const accounts = await getAccounts(accessToken);
        allAccounts.push(
          ...accounts.map((a: Record<string, unknown>) => ({
            account_id: a.account_id,
            name: a.name,
            official_name: a.official_name,
            type: a.type,
            subtype: a.subtype,
            mask: a.mask,
            balances: a.balances,
            institution_name: item.institution_name,
            item_id: item.plaid_item_id,
          })),
        );
      } catch {
        // Skip items with expired/invalid tokens
      }
    }

    return new Response(JSON.stringify({ accounts: allAccounts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
