/**
 * Recent email messages — live fetch from Gmail / Microsoft Graph.
 *
 * Flow:
 *   1. Authenticate the Supabase user.
 *   2. Decrypt the user's stored provider token server-side (get_integration_token,
 *      service-role only). The token NEVER leaves the server.
 *   3. Call the provider API (Gmail or Graph) with that token.
 *   4. Map to a SAFE shape — sender, subject, date, snippet, read/unread — with
 *      no tokens and no raw provider message IDs.
 *
 * No mock data: when the provider is not connected we return connected:false and
 * an empty list. When the provider call fails (e.g. expired token) we return a
 * machine error code; the client renders an honest error state.
 *
 * Query: ?provider=google|microsoft  (&limit=10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createGmailClient } from '@/lib/integrations/google/gmail';
import { safeApiError } from '@/lib/security/safe-error';
import { logIntegrationEvent, classifyError } from '@/lib/integrations/auditLog';

export const dynamic = 'force-dynamic';

type EmailProviderId = 'google' | 'microsoft';

/** The ONLY shape sent to the client. No tokens, no raw provider message IDs. */
export interface SafeEmailMessage {
  /** Opaque, non-reversible reference (sha256 of provider id, truncated). */
  ref: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  /** ISO 8601 */
  date: string | null;
  snippet: string;
  unread: boolean;
}

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 10;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Stable opaque ref — never the raw provider id. */
function opaqueRef(providerId: string): string {
  return createHash('sha256').update(providerId).digest('hex').slice(0, 16);
}

/** "Display Name <a@b.com>" -> {name, email}; bare address falls back to email. */
function parseFrom(raw: string | undefined | null): { name: string; email: string } {
  if (!raw) return { name: '', email: '' };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: raw.trim() };
}

async function fetchGoogle(accessToken: string, limit: number): Promise<SafeEmailMessage[]> {
  const client = createGmailClient(accessToken);
  const list = await client.listMessages({ maxResults: limit, labelIds: ['INBOX'] });
  const ids = list.data.map((m) => m.id);

  const messages = await Promise.all(
    ids.map(async (id) => {
      const msg = await client.getMessage(id, 'metadata');
      const from = parseFrom(client.getHeader(msg, 'From'));
      const subject = client.getHeader(msg, 'Subject') ?? '(no subject)';
      const dateHeader = client.getHeader(msg, 'Date');
      const date = dateHeader ? new Date(dateHeader).toISOString() : null;
      const unread = Array.isArray(msg.labelIds) ? msg.labelIds.includes('UNREAD') : false;
      return {
        ref: opaqueRef(id),
        fromName: from.name,
        fromEmail: from.email,
        subject,
        date,
        snippet: msg.snippet ?? '',
        unread,
      } satisfies SafeEmailMessage;
    })
  );

  return messages;
}

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  from?: { emailAddress?: { name?: string; address?: string } };
}

async function fetchMicrosoft(accessToken: string, limit: number): Promise<SafeEmailMessage[]> {
  const params = new URLSearchParams({
    $top: String(limit),
    $select: 'id,subject,bodyPreview,receivedDateTime,isRead,from',
    $orderby: 'receivedDateTime desc',
  });
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    // Surface a typed failure; never echo the Graph error body (may contain internals).
    throw new Error(`graph_messages_${res.status}`);
  }

  const json = (await res.json()) as { value?: GraphMessage[] };
  const value = Array.isArray(json.value) ? json.value : [];

  return value.map((m) => ({
    ref: opaqueRef(m.id),
    fromName: m.from?.emailAddress?.name ?? '',
    fromEmail: m.from?.emailAddress?.address ?? '',
    subject: m.subject || '(no subject)',
    date: m.receivedDateTime ? new Date(m.receivedDateTime).toISOString() : null,
    snippet: m.bodyPreview ?? '',
    unread: m.isRead === false,
  }));
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const providerParam = request.nextUrl.searchParams.get('provider');
  if (providerParam !== 'google' && providerParam !== 'microsoft') {
    return safeApiError({ code: 'bad_request', publicMessage: 'Unknown email provider.' });
  }
  const provider = providerParam as EmailProviderId;

  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const admin = getSupabaseAdmin();
  if (!encryptionKey || !admin) {
    // Cannot read tokens at all — honest "not connected", not an error wall.
    return NextResponse.json({ provider, connected: false, messages: [] });
  }

  // get_integration_token RETURNS TABLE -> array of rows.
  const { data, error } = await admin.rpc('get_integration_token', {
    p_user_id: user.id,
    p_provider: provider,
    p_encryption_key: encryptionKey,
  });

  if (error) {
    return safeApiError({
      code: 'internal_error',
      internal: error,
      context: { route: 'email/messages', step: 'token_lookup', provider },
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const accessToken: string | undefined = row?.access_token;
  if (!row || !accessToken) {
    return NextResponse.json({ provider, connected: false, messages: [] });
  }

  try {
    const messages =
      provider === 'google'
        ? await fetchGoogle(accessToken, limit)
        : await fetchMicrosoft(accessToken, limit);

    await logIntegrationEvent({
      userId: user.id,
      provider,
      action: 'email_list',
      success: true,
      integrationId: row?.id ?? null,
      context: { route: 'email/messages', count: messages.length, limit },
    });

    return NextResponse.json({ provider, connected: true, messages });
  } catch (err) {
    await logIntegrationEvent({
      userId: user.id,
      provider,
      action: 'email_list',
      success: false,
      errorClass: classifyError(err),
      integrationId: row?.id ?? null,
      context: { route: 'email/messages' },
    });
    // Likely an expired/revoked token (no web-side refresh yet) or provider 5xx.
    return safeApiError({
      code: 'upstream_unavailable',
      internal: err,
      context: { route: 'email/messages', step: 'provider_fetch', provider },
      publicMessage: 'Could not load messages from your email provider. Try reconnecting.',
    });
  }
}
