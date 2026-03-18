// Plaid Disconnect — removes a linked bank account
// Decrypts access token, calls Plaid to remove the item, deletes from DB

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { removeItem } from '../_shared/plaid.ts';

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
    const { itemId } = body;
    if (!itemId) {
      return new Response(JSON.stringify({ error: 'Missing itemId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Service client for encrypted data access
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Fetch the item (verify ownership)
    const { data: item, error: fetchError } = await serviceClient
      .schema('finance')
      .from('plaid_items')
      .select('id, access_token_encrypted')
      .eq('user_id', user.id)
      .eq('plaid_item_id', itemId)
      .single();

    if (fetchError || !item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const encryptionKey = Deno.env.get('INTEGRATION_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('INTEGRATION_ENCRYPTION_KEY not configured');

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await serviceClient
      .schema('core')
      .rpc('decrypt_text', {
        p_ciphertext: item.access_token_encrypted,
        p_key: encryptionKey,
      });

    if (decryptError) throw new Error(`Decryption failed: ${decryptError.message}`);

    // Remove from Plaid
    if (accessToken) {
      try {
        await removeItem(accessToken);
      } catch {
        // Continue even if Plaid removal fails (token may already be invalid)
      }
    }

    // Delete from DB
    const { error: deleteError } = await serviceClient
      .schema('finance')
      .from('plaid_items')
      .delete()
      .eq('user_id', user.id)
      .eq('plaid_item_id', itemId);

    if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);

    // Also clean up linked financial accounts
    await serviceClient
      .schema('finance')
      .from('financial_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('institution_name', item.institution_name || '');

    return new Response(JSON.stringify({ success: true }), {
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
