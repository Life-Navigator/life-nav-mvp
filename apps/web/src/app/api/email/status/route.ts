/**
 * Email connection status — per provider (google, microsoft).
 *
 * Reports ONLY safe metadata: whether a provider is connected, the connected
 * account email, and when it was last updated. NEVER returns access/refresh
 * tokens or provider-internal IDs.
 *
 * Source of truth is core.integration_tokens (service-role only). We read it
 * through the get_integration_token RPC with the service-role client; the
 * decrypted token is fetched server-side but is NOT included in the response.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

type EmailProviderId = 'google' | 'microsoft';

export interface EmailProviderStatus {
  provider: EmailProviderId;
  connected: boolean;
  /** Connected account email (safe to show). Null when not connected. */
  email: string | null;
  /** ISO timestamp of token row update (last connect/refresh). Null otherwise. */
  connectedAt: string | null;
  /** True when this provider's OAuth client credentials are configured in env. */
  oauthConfigured: boolean;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function googleOauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function microsoftOauthConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

async function readProvider(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  provider: EmailProviderId,
  encryptionKey: string,
  oauthConfigured: boolean
): Promise<EmailProviderStatus> {
  const base: EmailProviderStatus = {
    provider,
    connected: false,
    email: null,
    connectedAt: null,
    oauthConfigured,
  };

  if (!admin) return base;

  // get_integration_token RETURNS TABLE -> rpc resolves to an array of rows.
  const { data, error } = await admin.rpc('get_integration_token', {
    p_user_id: userId,
    p_provider: provider,
    p_encryption_key: encryptionKey,
  });

  if (error) return base;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return base;

  // IMPORTANT: row contains access_token/refresh_token — we deliberately
  // expose ONLY external_email + expires_at. Tokens never leave the server.
  return {
    provider,
    connected: true,
    email: (row.external_email as string) ?? null,
    connectedAt: (row.expires_at as string) ?? null,
    oauthConfigured,
  };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const admin = getSupabaseAdmin();

  const googleConfigured = googleOauthConfigured();
  const microsoftConfigured = microsoftOauthConfigured();

  // If we cannot decrypt (no key) or have no admin client, we can still report
  // an honest "not connected / not configured" status rather than failing hard.
  if (!encryptionKey || !admin) {
    return NextResponse.json({
      providers: [
        {
          provider: 'google',
          connected: false,
          email: null,
          connectedAt: null,
          oauthConfigured: googleConfigured,
        },
        {
          provider: 'microsoft',
          connected: false,
          email: null,
          connectedAt: null,
          oauthConfigured: microsoftConfigured,
        },
      ] satisfies EmailProviderStatus[],
    });
  }

  try {
    const [google, microsoft] = await Promise.all([
      readProvider(admin, user.id, 'google', encryptionKey, googleConfigured),
      readProvider(admin, user.id, 'microsoft', encryptionKey, microsoftConfigured),
    ]);

    return NextResponse.json({ providers: [google, microsoft] satisfies EmailProviderStatus[] });
  } catch (err) {
    return safeApiError({
      code: 'internal_error',
      internal: err,
      context: { route: 'email/status' },
    });
  }
}
