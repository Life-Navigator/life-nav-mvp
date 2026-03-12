// ==========================================================================
// Email Sync Worker
// Fetches new emails from Gmail / Outlook for a given user,
// stores them in public.email_messages, and updates sync state.
// Triggered by cron or after webhook push notification.
// ==========================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenInfo = {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string;
  external_email: string;
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GRAPH_API = 'https://graph.microsoft.com/v1.0/me';
const MAX_MESSAGES_PER_SYNC = 100;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  if (ae.length !== be.length) return false;
  let diff = 0;
  for (let i = 0; i < ae.length; i++) diff |= ae[i] ^ be[i];
  return diff === 0;
}

function safeError(v: unknown): string {
  const raw = v instanceof Error ? v.message : String(v);
  return raw.length > 2000 ? raw.slice(0, 2000) : raw;
}

function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; expires_in: number }> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Google token refresh failed (${resp.status}): ${t}`);
  }
  return resp.json();
}

async function refreshMicrosoftToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenantId: string,
): Promise<{ access_token: string; expires_in: number }> {
  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'Mail.Read Mail.Send offline_access',
      }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Microsoft token refresh failed (${resp.status}): ${t}`);
  }
  return resp.json();
}

async function getValidAccessToken(
  token: TokenInfo,
  provider: string,
  supabase: ReturnType<typeof createClient>,
  encryptionKey: string,
): Promise<string> {
  // Check if token is still valid (with 5-min buffer)
  if (token.expires_at) {
    const expiresAt = new Date(token.expires_at).getTime();
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return token.access_token;
    }
  }

  // Need refresh
  if (!token.refresh_token) {
    throw new Error('Token expired and no refresh token available');
  }

  let refreshed: { access_token: string; expires_in: number };

  if (provider === 'google') {
    refreshed = await refreshGoogleToken(
      token.refresh_token,
      Deno.env.get('GOOGLE_CLIENT_ID')!,
      Deno.env.get('GOOGLE_CLIENT_SECRET')!,
    );
  } else {
    refreshed = await refreshMicrosoftToken(
      token.refresh_token,
      Deno.env.get('MICROSOFT_CLIENT_ID')!,
      Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
      Deno.env.get('MICROSOFT_TENANT_ID') || 'common',
    );
  }

  // Update token in vault
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString();

  await supabase.schema('core').rpc('upsert_integration_token', {
    p_user_id: token.id, // This is actually from the row, we need user_id
    p_provider: provider,
    p_access_token: refreshed.access_token,
    p_refresh_token: token.refresh_token,
    p_expires_at: newExpiresAt,
    p_encryption_key: encryptionKey,
  });

  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Gmail sync
// ---------------------------------------------------------------------------

async function syncGmail(
  accessToken: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; errors: number }> {
  // Get sync state
  const { data: syncState } = await supabase
    .from('email_sync_state')
    .select('history_id, last_synced_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  let messageIds: string[] = [];

  if (syncState?.history_id) {
    // Incremental sync via history
    try {
      const histResp = await fetch(
        `${GMAIL_API}/history?startHistoryId=${syncState.history_id}&historyTypes=messageAdded&maxResults=${MAX_MESSAGES_PER_SYNC}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (histResp.ok) {
        const histData = await histResp.json();
        const newHistoryId = histData.historyId;

        for (const entry of histData.history || []) {
          for (const msg of entry.messagesAdded || []) {
            messageIds.push(msg.message.id);
          }
        }

        // Update history ID even if no new messages
        await supabase
          .from('email_sync_state')
          .upsert(
            {
              user_id: userId,
              provider: 'google',
              history_id: newHistoryId,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,provider' },
          );

        if (messageIds.length === 0) {
          return { synced: 0, errors: 0 };
        }
      } else {
        // History expired — fall back to full sync
        messageIds = [];
      }
    } catch {
      messageIds = [];
    }
  }

  // Full sync (or fallback)
  if (messageIds.length === 0) {
    const listResp = await fetch(
      `${GMAIL_API}/messages?maxResults=${MAX_MESSAGES_PER_SYNC}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!listResp.ok) {
      throw new Error(`Gmail list failed: ${listResp.status}`);
    }

    const listData = await listResp.json();
    messageIds = (listData.messages || []).map(
      (m: { id: string }) => m.id,
    );

    // Get current history ID for future incremental syncs
    const profileResp = await fetch(`${GMAIL_API}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (profileResp.ok) {
      const profile = await profileResp.json();
      await supabase
        .from('email_sync_state')
        .upsert(
          {
            user_id: userId,
            provider: 'google',
            history_id: profile.historyId,
            total_messages: profile.messagesTotal,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' },
        );
    }
  }

  // Fetch and store messages
  let synced = 0;
  let errors = 0;

  for (const msgId of messageIds.slice(0, MAX_MESSAGES_PER_SYNC)) {
    try {
      const msgResp = await fetch(
        `${GMAIL_API}/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!msgResp.ok) continue;
      const msg: GmailMessage = await msgResp.json();

      const headers = msg.payload?.headers;
      const fromFull = getHeader(headers, 'From');
      const fromMatch = fromFull.match(/<(.+?)>/);

      await supabase.from('email_messages').upsert(
        {
          user_id: userId,
          provider: 'google',
          external_id: msg.id,
          thread_id: msg.threadId,
          subject: getHeader(headers, 'Subject'),
          from_address: fromMatch ? fromMatch[1] : fromFull,
          from_name: fromFull.replace(/<.+?>/, '').trim(),
          to_addresses: getHeader(headers, 'To')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          cc_addresses: getHeader(headers, 'Cc')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          snippet: msg.snippet || '',
          labels: msg.labelIds || [],
          is_read: !(msg.labelIds || []).includes('UNREAD'),
          is_starred: (msg.labelIds || []).includes('STARRED'),
          is_draft: (msg.labelIds || []).includes('DRAFT'),
          has_attachments: false, // Would need body scan
          date: msg.internalDate
            ? new Date(parseInt(msg.internalDate)).toISOString()
            : new Date().toISOString(),
        },
        { onConflict: 'user_id,provider,external_id' },
      );

      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Microsoft Outlook sync
// ---------------------------------------------------------------------------

async function syncOutlook(
  accessToken: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; errors: number }> {
  // Get sync state (deltaLink)
  const { data: syncState } = await supabase
    .from('email_sync_state')
    .select('history_id, last_synced_at')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .maybeSingle();

  let fetchUrl: string;

  if (syncState?.history_id) {
    // Incremental sync via delta
    fetchUrl = syncState.history_id;
  } else {
    // Full sync
    fetchUrl = `${GRAPH_API}/messages?$top=${MAX_MESSAGES_PER_SYNC}&$select=id,conversationId,subject,from,toRecipients,ccRecipients,bodyPreview,isRead,flag,isDraft,hasAttachments,receivedDateTime&$orderby=receivedDateTime desc`;
  }

  let synced = 0;
  let errors = 0;
  let deltaLink: string | null = null;

  try {
    const resp = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      // Delta link expired — full sync
      if (resp.status === 410 && syncState?.history_id) {
        const freshUrl = `${GRAPH_API}/messages?$top=${MAX_MESSAGES_PER_SYNC}&$select=id,conversationId,subject,from,toRecipients,ccRecipients,bodyPreview,isRead,flag,isDraft,hasAttachments,receivedDateTime&$orderby=receivedDateTime desc`;
        const freshResp = await fetch(freshUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!freshResp.ok) throw new Error(`Outlook list failed: ${freshResp.status}`);
        const data = await freshResp.json();
        return processOutlookMessages(data, userId, supabase);
      }
      throw new Error(`Outlook sync failed: ${resp.status}`);
    }

    const data = await resp.json();
    const result = await processOutlookMessages(data, userId, supabase);
    synced = result.synced;
    errors = result.errors;
    deltaLink = data['@odata.deltaLink'] || null;
  } catch (err) {
    throw err;
  }

  // Save sync state
  await supabase.from('email_sync_state').upsert(
    {
      user_id: userId,
      provider: 'microsoft',
      history_id: deltaLink || syncState?.history_id,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );

  return { synced, errors };
}

async function processOutlookMessages(
  data: { value: Array<Record<string, unknown>> },
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  for (const msg of data.value || []) {
    try {
      const from = msg.from as
        | { emailAddress: { address: string; name: string } }
        | undefined;

      const toRecipients = (
        msg.toRecipients as Array<{
          emailAddress: { address: string; name: string };
        }> || []
      ).map((r) => r.emailAddress.address);

      const ccRecipients = (
        msg.ccRecipients as Array<{
          emailAddress: { address: string; name: string };
        }> || []
      ).map((r) => r.emailAddress.address);

      await supabase.from('email_messages').upsert(
        {
          user_id: userId,
          provider: 'microsoft',
          external_id: msg.id as string,
          thread_id: msg.conversationId as string,
          subject: msg.subject as string,
          from_address: from?.emailAddress?.address || '',
          from_name: from?.emailAddress?.name || '',
          to_addresses: toRecipients,
          cc_addresses: ccRecipients,
          snippet: (msg.bodyPreview as string) || '',
          labels: [],
          is_read: (msg.isRead as boolean) || false,
          is_starred:
            (msg.flag as { flagStatus?: string })?.flagStatus === 'flagged',
          is_draft: (msg.isDraft as boolean) || false,
          has_attachments: (msg.hasAttachments as boolean) || false,
          date: (msg.receivedDateTime as string) || new Date().toISOString(),
        },
        { onConflict: 'user_id,provider,external_id' },
      );

      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // Auth
    const workerSecret = Deno.env.get('EMAIL_SYNC_WORKER_SECRET') || Deno.env.get('GRAPHRAG_WORKER_SECRET');
    if (workerSecret) {
      const provided = req.headers.get('x-worker-secret');
      if (!provided || !constantTimeEqual(provided, workerSecret)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('INTEGRATION_ENCRYPTION_KEY')!;

    if (!encryptionKey) {
      throw new Error('Missing INTEGRATION_ENCRYPTION_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const { user_id, provider } = body as {
      user_id?: string;
      provider?: string;
    };

    // If specific user provided, sync just that user
    if (user_id && provider) {
      const result = await syncUser(
        supabase,
        user_id,
        provider,
        encryptionKey,
      );
      return new Response(JSON.stringify(result), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Otherwise batch sync: get eligible users
    const limit = Math.min(Number(body?.limit) || 10, 50);
    const results: Array<Record<string, unknown>> = [];

    for (const p of ['google', 'microsoft']) {
      const { data: users } = await supabase
        .schema('core')
        .rpc('get_sync_eligible_users', { p_provider: p, p_limit: limit });

      for (const u of users || []) {
        try {
          const r = await syncUser(supabase, u.user_id, p, encryptionKey);
          results.push(r);
        } catch (err) {
          results.push({
            user_id: u.user_id,
            provider: p,
            status: 'error',
            error: safeError(err),
          });
        }
      }
    }

    return new Response(JSON.stringify({ synced_users: results.length, results }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: safeError(error) }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function syncUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  provider: string,
  encryptionKey: string,
): Promise<Record<string, unknown>> {
  // Get decrypted token
  const { data: tokens, error: tokenErr } = await supabase
    .schema('core')
    .rpc('get_integration_token', {
      p_user_id: userId,
      p_provider: provider,
      p_encryption_key: encryptionKey,
    });

  if (tokenErr || !tokens?.length) {
    return {
      user_id: userId,
      provider,
      status: 'skipped',
      reason: 'No token found',
    };
  }

  const token = tokens[0] as TokenInfo;

  // Get valid access token (refresh if needed)
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(
      { ...token, id: userId },
      provider,
      supabase,
      encryptionKey,
    );
  } catch (err) {
    return {
      user_id: userId,
      provider,
      status: 'error',
      error: `Token refresh failed: ${safeError(err)}`,
    };
  }

  // Sync based on provider
  const result =
    provider === 'google'
      ? await syncGmail(accessToken, userId, supabase)
      : await syncOutlook(accessToken, userId, supabase);

  return {
    user_id: userId,
    provider,
    status: 'completed',
    ...result,
  };
}
