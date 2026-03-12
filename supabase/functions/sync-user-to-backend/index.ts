/**
 * Supabase Edge Function: Sync User to Backend
 *
 * This function is triggered when a new user signs up in Supabase Auth.
 * It creates the corresponding user record in the backend Cloud SQL database.
 *
 * Trigger: auth.users INSERT (via Database Webhook)
 *
 * Setup:
 * 1. Deploy this function: supabase functions deploy sync-user-to-backend
 * 2. Create a Database Webhook in Supabase Dashboard:
 *    - Table: auth.users
 *    - Events: INSERT
 *    - Webhook URL: https://<project-ref>.supabase.co/functions/v1/sync-user-to-backend
 * 3. Set the BACKEND_URL secret:
 *    supabase secrets set BACKEND_URL=https://your-backend-url.com
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      display_name?: string;
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      user_type?: string;
    };
    created_at: string;
  };
  old_record?: any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BACKEND_URL = Deno.env.get('BACKEND_URL');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!BACKEND_URL) {
      throw new Error('BACKEND_URL not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    // Parse the webhook payload
    const payload: WebhookPayload = await req.json();

    // Only process INSERT events
    if (payload.type !== 'INSERT') {
      return new Response(
        JSON.stringify({ message: 'Ignored non-INSERT event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { record } = payload;
    const metadata = record.raw_user_meta_data || {};

    console.log(`Syncing user ${record.id} (${record.email}) to backend...`);

    // Call backend sync endpoint
    const syncResponse = await fetch(`${BACKEND_URL}/api/v1/user-sync/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use service-to-service authentication if needed
        'X-Service-Key': Deno.env.get('BACKEND_SERVICE_KEY') || '',
      },
      body: JSON.stringify({
        supabase_user_id: record.id,
        email: record.email,
        display_name: metadata.display_name,
        first_name: metadata.first_name,
        last_name: metadata.last_name,
        avatar_url: metadata.avatar_url,
        auth_provider: 'EMAIL',
        user_type: metadata.user_type || 'CIVILIAN',
        timezone: 'America/New_York',
        locale: 'en-US',
      }),
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      console.error(`Backend sync failed: ${errorText}`);
      throw new Error(`Backend sync failed: ${syncResponse.status}`);
    }

    const syncData = await syncResponse.json();
    console.log(`User synced successfully. Backend ID: ${syncData.backend_user_id}`);

    // Update the Supabase profile with the backend user ID
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ dgx_user_id: syncData.backend_user_id })
      .eq('id', record.id);

    if (updateError) {
      console.error(`Failed to update profile with backend ID: ${updateError.message}`);
      // Don't throw - the sync still succeeded
    } else {
      console.log(`Profile updated with backend user ID`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User synced to backend',
        backend_user_id: syncData.backend_user_id,
        tenant_id: syncData.tenant_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error syncing user:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
