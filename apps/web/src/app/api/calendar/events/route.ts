/**
 * Calendar Events API Route
 *
 * Server-side aggregation of upcoming calendar events for the authenticated
 * user across BOTH Google Calendar and Microsoft (Outlook) Calendar.
 *
 * SECURITY INVARIANTS:
 *  - Provider access/refresh tokens are read server-side ONLY (via the
 *    service-role `get_integration_token` RPC) and are NEVER returned to the
 *    client. Only a curated set of safe display fields leaves this route.
 *  - When a provider is not connected (no stored token) the response reports
 *    `connected: false` with an empty event list — it never fabricates data.
 *  - Per-provider failures are isolated: a Google error cannot hide Microsoft
 *    events and vice-versa. Each provider carries its own `error` flag.
 *
 * NOTE: Google tokens written by the OAuth callback are persisted ENCRYPTED in
 * Supabase `core.integration_tokens` (same store as Microsoft) and read back
 * here via the service-role `get_integration_token` RPC. If a Google token is
 * not present this route reports Google as disconnected (honest empty state)
 * rather than guessing. See
 * docs/integration-completion/GOOGLE_TOKEN_PERSISTENCE_REPORT.md.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GoogleCalendarClient } from '@/lib/integrations/google/calendar';
import { GoogleOAuthService, isTokenExpired } from '@/lib/integrations/google/oauth';
import { safeApiError } from '@/lib/security/safe-error';
import { logIntegrationEvent, classifyError } from '@/lib/integrations/auditLog';
import type { GoogleCalendarEvent } from '@/lib/integrations/google/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Public response shape — ONLY safe fields. No tokens, no raw provider payload.
// ---------------------------------------------------------------------------

export type CalendarProvider = 'google' | 'microsoft';

export interface SafeAttendee {
  /** Display name when available, otherwise the email local part. */
  name: string;
  /** Free-form response status (accepted / tentative / declined / unknown). */
  responseStatus?: string;
}

export interface SafeCalendarEvent {
  id: string;
  provider: CalendarProvider;
  title: string;
  /** ISO string; for all-day events this is the date at local midnight. */
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  /** Names only — raw attendee emails are not exposed. */
  attendees: SafeAttendee[];
  /** Conferencing / meeting join link when present. */
  meetingUrl?: string;
}

export interface ProviderEvents {
  provider: CalendarProvider;
  connected: boolean;
  /** Human-safe error label when the provider failed; never the raw message. */
  error?: string;
  events: SafeCalendarEvent[];
}

export interface CalendarEventsResponse {
  providers: ProviderEvents[];
}

const MAX_EVENTS_PER_PROVIDER = 25;
const LOOKAHEAD_DAYS = 30;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface StoredToken {
  id?: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
}

/**
 * Read a decrypted integration token for the user server-side.
 * Returns null when the provider is not connected. Never throws on
 * "not connected" — only on a hard infrastructure failure.
 */
async function readToken(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  provider: CalendarProvider,
  encryptionKey: string
): Promise<StoredToken | null> {
  if (!admin) return null;
  const { data, error } = await admin.rpc('get_integration_token', {
    p_user_id: userId,
    p_provider: provider,
    p_encryption_key: encryptionKey,
  });
  if (error) {
    // Surface as a provider error, not a global failure.
    throw new Error(`token_read_failed:${provider}`);
  }
  // RPC returns a set; take the first row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.access_token) return null;
  return {
    id: row.id,
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? null,
    expires_at: row.expires_at ?? null,
    scope: row.scope ?? null,
  };
}

function localName(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

// ---------------------------------------------------------------------------
// Google → safe events
// ---------------------------------------------------------------------------

function mapGoogleEvent(e: GoogleCalendarEvent): SafeCalendarEvent {
  const allDay = Boolean(e.start?.date && !e.start?.dateTime);
  const start = e.start?.dateTime || e.start?.date || '';
  const end = e.end?.dateTime || e.end?.date || '';
  const meetingUrl =
    e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || e.htmlLink;
  return {
    id: e.id,
    provider: 'google',
    title: e.summary || '(no title)',
    start,
    end,
    allDay,
    location: e.location || undefined,
    attendees: (e.attendees || []).map((a) => ({
      name: a.displayName || (a.email ? localName(a.email) : 'Guest'),
      responseStatus: a.responseStatus,
    })),
    meetingUrl: meetingUrl || undefined,
  };
}

async function fetchGoogle(
  token: StoredToken,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  encryptionKey: string
): Promise<SafeCalendarEvent[]> {
  let accessToken = token.access_token;

  // Refresh if expired and a refresh token is available.
  const expired = token.expires_at ? isTokenExpired(new Date(token.expires_at)) : false;
  if (expired && token.refresh_token) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (clientId && clientSecret) {
      const oauth = new GoogleOAuthService(clientId, clientSecret);
      try {
        const refreshed = await oauth.refreshToken(token.refresh_token);
        accessToken = refreshed.accessToken;
        // Persist the refreshed token (best-effort; do not fail the request).
        if (admin) {
          await admin
            .rpc('upsert_integration_token', {
              p_user_id: userId,
              p_provider: 'google',
              p_access_token: refreshed.accessToken,
              p_refresh_token: token.refresh_token,
              p_expires_at: refreshed.expiresAt.toISOString(),
              p_scope: refreshed.scope || token.scope,
              p_external_account_id: null,
              p_external_email: null,
              p_metadata: { provider: 'google', refreshed_via: 'calendar_events' },
              p_encryption_key: encryptionKey,
            })
            .then(undefined, () => undefined);
        }
        await logIntegrationEvent({
          userId,
          provider: 'google',
          action: 'token_refresh_success',
          success: true,
          integrationId: token.id ?? null,
          context: { route: 'calendar/events' },
        });
      } catch (refreshErr) {
        await logIntegrationEvent({
          userId,
          provider: 'google',
          action: 'token_refresh_failure',
          success: false,
          errorClass: classifyError(refreshErr),
          integrationId: token.id ?? null,
          context: { route: 'calendar/events' },
        });
        throw refreshErr;
      }
    }
  }

  const client = new GoogleCalendarClient(accessToken);
  const now = new Date();
  const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const res = await client.listEvents('primary', {
    timeMin: now,
    timeMax,
    maxResults: MAX_EVENTS_PER_PROVIDER,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.map(mapGoogleEvent);
}

// ---------------------------------------------------------------------------
// Microsoft Graph → safe events
// ---------------------------------------------------------------------------

interface GraphEvent {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string };
  attendees?: Array<{
    emailAddress?: { name?: string; address?: string };
    status?: { response?: string };
  }>;
}

function mapGraphEvent(e: GraphEvent): SafeCalendarEvent {
  const start = e.start?.dateTime || '';
  const end = e.end?.dateTime || '';
  return {
    id: e.id,
    provider: 'microsoft',
    title: e.subject || '(no title)',
    start,
    end,
    allDay: Boolean(e.isAllDay),
    location: e.location?.displayName || undefined,
    attendees: (e.attendees || []).map((a) => ({
      name:
        a.emailAddress?.name ||
        (a.emailAddress?.address ? localName(a.emailAddress.address) : 'Guest'),
      responseStatus: a.status?.response,
    })),
    meetingUrl: e.onlineMeeting?.joinUrl || undefined,
  };
}

async function refreshMicrosoftToken(
  token: StoredToken,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  encryptionKey: string
): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  if (!clientId || !clientSecret || !token.refresh_token) {
    return token.access_token;
  }
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }).toString(),
  });
  if (!res.ok) {
    await logIntegrationEvent({
      userId,
      provider: 'microsoft',
      action: 'token_refresh_failure',
      success: false,
      errorClass: `graph_token_${res.status}`,
      integrationId: token.id ?? null,
      context: { route: 'calendar/events', status: res.status },
    });
    return token.access_token;
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  if (admin) {
    await admin
      .rpc('upsert_integration_token', {
        p_user_id: userId,
        p_provider: 'microsoft',
        p_access_token: data.access_token,
        p_refresh_token: data.refresh_token || token.refresh_token,
        p_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        p_scope: data.scope || token.scope,
        p_external_account_id: null,
        p_external_email: null,
        p_metadata: { provider: 'microsoft', refreshed_via: 'calendar_events' },
        p_encryption_key: encryptionKey,
      })
      .then(undefined, () => undefined);
  }
  await logIntegrationEvent({
    userId,
    provider: 'microsoft',
    action: 'token_refresh_success',
    success: true,
    integrationId: token.id ?? null,
    context: { route: 'calendar/events' },
  });
  return data.access_token;
}

async function fetchMicrosoft(
  token: StoredToken,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  encryptionKey: string
): Promise<SafeCalendarEvent[]> {
  let accessToken = token.access_token;
  const expired = token.expires_at ? isTokenExpired(new Date(token.expires_at)) : false;
  if (expired) {
    accessToken = await refreshMicrosoftToken(token, admin, userId, encryptionKey);
  }

  const now = new Date();
  const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: timeMax.toISOString(),
    $orderby: 'start/dateTime',
    $top: String(MAX_EVENTS_PER_PROVIDER),
    $select: 'id,subject,start,end,location,isAllDay,onlineMeeting,attendees',
  });
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!res.ok) {
    throw new Error(`graph_error:${res.status}`);
  }
  const data = (await res.json()) as { value?: GraphEvent[] };
  return (data.value || []).map(mapGraphEvent);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function resolveProvider(
  provider: CalendarProvider,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  encryptionKey: string
): Promise<ProviderEvents> {
  try {
    const token = await readToken(admin, userId, provider, encryptionKey);
    if (!token) {
      return { provider, connected: false, events: [] };
    }
    const events =
      provider === 'google'
        ? await fetchGoogle(token, admin, userId, encryptionKey)
        : await fetchMicrosoft(token, admin, userId, encryptionKey);
    await logIntegrationEvent({
      userId,
      provider,
      action: 'calendar_list',
      success: true,
      integrationId: token.id ?? null,
      context: { route: 'calendar/events', count: events.length },
    });
    return { provider, connected: true, events };
  } catch (err) {
    await logIntegrationEvent({
      userId,
      provider,
      action: 'calendar_list',
      success: false,
      errorClass: classifyError(err),
      context: { route: 'calendar/events' },
    });
    // Connected but failed to sync — honest error state, no fabricated events.
    return {
      provider,
      connected: true,
      error: 'Could not load events from this provider.',
      events: [],
    };
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encryptionKey) {
    return safeApiError({ code: 'upstream_unavailable' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return safeApiError({ code: 'upstream_unavailable' });

  const [google, microsoft] = await Promise.all([
    resolveProvider('google', admin, user.id, encryptionKey),
    resolveProvider('microsoft', admin, user.id, encryptionKey),
  ]);

  const body: CalendarEventsResponse = { providers: [google, microsoft] };
  return NextResponse.json(body);
}
