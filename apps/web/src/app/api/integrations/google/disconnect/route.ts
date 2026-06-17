/**
 * Google Disconnect API Route
 *
 * Disconnects the user's Google integration the SAME way Microsoft does:
 * via the service-role `disconnect_integration` RPC, which deletes the
 * encrypted token row from `core.integration_tokens` and flips the
 * public.integrations status to 'disconnected'.
 *
 * Best-effort token revocation at Google is attempted first (server-side; the
 * token is never returned to the browser). Revocation failure does not block
 * local disconnect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GoogleOAuthService } from '@/lib/integrations/google/oauth';
import { safeApiError } from '@/lib/security/safe-error';
import { logIntegrationEvent, classifyError } from '@/lib/integrations/auditLog';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const admin = getSupabaseAdmin();
  if (!admin) return safeApiError({ code: 'upstream_unavailable' });

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // Best-effort revoke at Google before clearing the local row. The token is
    // read server-side and never exposed; revocation failure is non-fatal.
    if (encryptionKey && clientId && clientSecret) {
      const { data: tokenData } = await admin.rpc('get_integration_token', {
        p_user_id: user.id,
        p_provider: 'google',
        p_encryption_key: encryptionKey,
      });
      const row = Array.isArray(tokenData) ? tokenData[0] : tokenData;
      const accessToken: string | undefined = row?.access_token;
      if (accessToken) {
        try {
          await new GoogleOAuthService(clientId, clientSecret).revokeToken(accessToken);
        } catch {
          // Non-fatal — proceed with local disconnect.
        }
      }
    }

    const { error } = await admin.rpc('disconnect_integration', {
      p_user_id: user.id,
      p_provider: 'google',
    });

    if (error) {
      await logIntegrationEvent({
        userId: user.id,
        provider: 'google',
        action: 'disconnect_failure',
        success: false,
        errorClass: classifyError(error),
        context: { route: 'integrations/google/disconnect' },
      });
      return safeApiError({ code: 'db_persistence_error', internal: error });
    }

    await logIntegrationEvent({
      userId: user.id,
      provider: 'google',
      action: 'disconnect_success',
      success: true,
      context: { route: 'integrations/google/disconnect' },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    await logIntegrationEvent({
      userId: user.id,
      provider: 'google',
      action: 'disconnect_failure',
      success: false,
      errorClass: classifyError(err),
      context: { route: 'integrations/google/disconnect' },
    });
    return safeApiError({
      code: 'internal_error',
      internal: err,
      context: { route: 'google/disconnect' },
    });
  }
}
