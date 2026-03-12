// ==========================================================================
// Calendar Sync Worker
// Fetches events from Google Calendar / Outlook Calendar for a given user,
// stores them in public.calendar_events, and updates calendar_connections.
// Triggered by cron or after webhook push notification.
// ==========================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenInfo = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string;
  external_email: string;
};

type CalendarConnection = {
  id: string;
  user_id: string;
  provider: string;
  calendar_id: string;
  calendar_name: string;
  is_primary: boolean;
  sync_token: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

const GOOGLE_CAL_API = 'https://www.googleapis.com/calendar/v3';
const GRAPH_API = 'https://graph.microsoft.com/v1.0/me';
const MAX_EVENTS_PER_SYNC = 250;
const SYNC_WINDOW_DAYS = 90; // Sync events within this window

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

// ---------------------------------------------------------------------------
// Token refresh (same as email-sync)
// ---------------------------------------------------------------------------

async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
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
): Promise<{ access_token: string; expires_in: number }> {
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || 'common';
  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
        client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
        scope: 'Calendars.ReadWrite offline_access',
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
  userId: string,
  supabase: ReturnType<typeof createClient>,
  encryptionKey: string,
): Promise<string> {
  if (token.expires_at) {
    const expiresAt = new Date(token.expires_at).getTime();
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return token.access_token;
    }
  }

  if (!token.refresh_token) {
    throw new Error('Token expired and no refresh token available');
  }

  const refreshed =
    provider === 'google'
      ? await refreshGoogleToken(token.refresh_token)
      : await refreshMicrosoftToken(token.refresh_token);

  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString();

  await supabase.schema('core').rpc('upsert_integration_token', {
    p_user_id: userId,
    p_provider: provider,
    p_access_token: refreshed.access_token,
    p_refresh_token: token.refresh_token,
    p_expires_at: newExpiresAt,
    p_encryption_key: encryptionKey,
  });

  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Google Calendar sync
// ---------------------------------------------------------------------------

async function syncGoogleCalendar(
  accessToken: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; errors: number; calendars: number }> {
  // Step 1: Sync calendar list
  const calResp = await fetch(`${GOOGLE_CAL_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!calResp.ok) throw new Error(`Calendar list failed: ${calResp.status}`);

  const calData = await calResp.json();
  const calendars = calData.items || [];

  for (const cal of calendars) {
    await supabase.from('calendar_connections').upsert(
      {
        user_id: userId,
        provider: 'google',
        calendar_id: cal.id,
        calendar_name: cal.summary || cal.id,
        color: cal.backgroundColor || null,
        is_primary: cal.primary === true,
        is_synced: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,calendar_id' },
    );
  }

  // Step 2: Get connections with sync tokens
  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('id, calendar_id, sync_token, is_primary')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_synced', true);

  let totalSynced = 0;
  let totalErrors = 0;

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7); // 1 week back
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + SYNC_WINDOW_DAYS);

  for (const conn of connections || []) {
    try {
      let eventsUrl: string;

      if (conn.sync_token) {
        // Incremental sync
        eventsUrl = `${GOOGLE_CAL_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?syncToken=${conn.sync_token}&maxResults=${MAX_EVENTS_PER_SYNC}`;
      } else {
        // Full sync
        eventsUrl = `${GOOGLE_CAL_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&maxResults=${MAX_EVENTS_PER_SYNC}&singleEvents=true&orderBy=startTime`;
      }

      const evResp = await fetch(eventsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!evResp.ok) {
        // Sync token expired — full sync
        if (evResp.status === 410 && conn.sync_token) {
          const freshUrl = `${GOOGLE_CAL_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&maxResults=${MAX_EVENTS_PER_SYNC}&singleEvents=true&orderBy=startTime`;
          const freshResp = await fetch(freshUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!freshResp.ok) continue;
          const freshData = await freshResp.json();
          const r = await processGoogleEvents(
            freshData,
            userId,
            conn.id,
            supabase,
          );
          totalSynced += r.synced;
          totalErrors += r.errors;

          if (freshData.nextSyncToken) {
            await supabase
              .from('calendar_connections')
              .update({ sync_token: freshData.nextSyncToken })
              .eq('id', conn.id);
          }
          continue;
        }
        continue;
      }

      const evData = await evResp.json();
      const r = await processGoogleEvents(
        evData,
        userId,
        conn.id,
        supabase,
      );
      totalSynced += r.synced;
      totalErrors += r.errors;

      // Save sync token for incremental sync
      if (evData.nextSyncToken) {
        await supabase
          .from('calendar_connections')
          .update({
            sync_token: evData.nextSyncToken,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', conn.id);
      }
    } catch {
      totalErrors++;
    }
  }

  return {
    synced: totalSynced,
    errors: totalErrors,
    calendars: calendars.length,
  };
}

async function processGoogleEvents(
  data: { items?: Array<Record<string, unknown>> },
  userId: string,
  connectionId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  for (const ev of data.items || []) {
    if (ev.status === 'cancelled') {
      // Delete cancelled events
      await supabase
        .from('calendar_events')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'google')
        .eq('external_id', ev.id as string);
      synced++;
      continue;
    }

    try {
      const start = ev.start as
        | { dateTime?: string; date?: string }
        | undefined;
      const end = ev.end as
        | { dateTime?: string; date?: string }
        | undefined;
      const allDay = !start?.dateTime;
      const attendees = (
        ev.attendees as Array<{
          email: string;
          displayName?: string;
          responseStatus?: string;
        }> || []
      ).map((a) => ({
        email: a.email,
        name: a.displayName,
        status: a.responseStatus,
      }));

      const conferenceData = ev.conferenceData as
        | { entryPoints?: Array<{ entryPointType: string; uri: string }> }
        | undefined;
      const conferenceUrl =
        conferenceData?.entryPoints?.find(
          (e) => e.entryPointType === 'video',
        )?.uri || null;

      await supabase.from('calendar_events').upsert(
        {
          user_id: userId,
          connection_id: connectionId,
          provider: 'google',
          external_id: ev.id as string,
          calendar_id: ev.calendarId || 'primary',
          summary: (ev.summary as string) || '',
          description: (ev.description as string) || null,
          location: (ev.location as string) || null,
          start_time: start?.dateTime || start?.date || null,
          end_time: end?.dateTime || end?.date || null,
          all_day: allDay,
          status: (ev.status as string) || 'confirmed',
          attendees,
          recurrence: ev.recurrence || null,
          conference_url: conferenceUrl,
          is_organizer: (ev.organizer as { self?: boolean })?.self === true,
          metadata: {
            etag: ev.etag,
            htmlLink: ev.htmlLink,
            colorId: ev.colorId,
          },
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
// Microsoft Outlook Calendar sync
// ---------------------------------------------------------------------------

async function syncOutlookCalendar(
  accessToken: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; errors: number; calendars: number }> {
  // Step 1: List calendars
  const calResp = await fetch(`${GRAPH_API}/calendars`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!calResp.ok) throw new Error(`Outlook calendars failed: ${calResp.status}`);

  const calData = await calResp.json();
  const calendars = calData.value || [];

  for (const cal of calendars) {
    await supabase.from('calendar_connections').upsert(
      {
        user_id: userId,
        provider: 'microsoft',
        calendar_id: cal.id,
        calendar_name: cal.name || cal.id,
        color: cal.hexColor || null,
        is_primary: cal.isDefaultCalendar === true,
        is_synced: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,calendar_id' },
    );
  }

  // Step 2: Fetch events
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + SYNC_WINDOW_DAYS);

  let totalSynced = 0;
  let totalErrors = 0;

  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('id, calendar_id')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .eq('is_synced', true);

  for (const conn of connections || []) {
    try {
      const evUrl = `${GRAPH_API}/calendars/${conn.calendar_id}/calendarView?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$top=${MAX_EVENTS_PER_SYNC}&$select=id,subject,bodyPreview,start,end,isAllDay,location,attendees,isOrganizer,onlineMeeting,recurrence,showAs`;

      const evResp = await fetch(evUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!evResp.ok) continue;
      const evData = await evResp.json();

      for (const ev of evData.value || []) {
        try {
          const attendees = (
            ev.attendees as Array<{
              emailAddress: { address: string; name: string };
              status: { response: string };
            }> || []
          ).map((a) => ({
            email: a.emailAddress.address,
            name: a.emailAddress.name,
            status: a.status?.response,
          }));

          const loc = ev.location as
            | { displayName?: string }
            | undefined;

          await supabase.from('calendar_events').upsert(
            {
              user_id: userId,
              connection_id: conn.id,
              provider: 'microsoft',
              external_id: ev.id,
              calendar_id: conn.calendar_id,
              summary: ev.subject || '',
              description: ev.bodyPreview || null,
              location: loc?.displayName || null,
              start_time: ev.start?.dateTime
                ? `${ev.start.dateTime}Z`
                : null,
              end_time: ev.end?.dateTime ? `${ev.end.dateTime}Z` : null,
              all_day: ev.isAllDay || false,
              status: ev.showAs || 'busy',
              attendees,
              recurrence: ev.recurrence || null,
              conference_url: ev.onlineMeeting?.joinUrl || null,
              is_organizer: ev.isOrganizer || false,
            },
            { onConflict: 'user_id,provider,external_id' },
          );

          totalSynced++;
        } catch {
          totalErrors++;
        }
      }

      // Update connection sync timestamp
      await supabase
        .from('calendar_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', conn.id);
    } catch {
      totalErrors++;
    }
  }

  return {
    synced: totalSynced,
    errors: totalErrors,
    calendars: calendars.length,
  };
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
    const workerSecret =
      Deno.env.get('CALENDAR_SYNC_WORKER_SECRET') ||
      Deno.env.get('GRAPHRAG_WORKER_SECRET');
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

    if (!encryptionKey) throw new Error('Missing INTEGRATION_ENCRYPTION_KEY');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const { user_id, provider } = body as {
      user_id?: string;
      provider?: string;
    };

    if (user_id && provider) {
      const result = await syncUserCalendar(
        supabase,
        user_id,
        provider,
        encryptionKey,
      );
      return new Response(JSON.stringify(result), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Batch sync
    const limit = Math.min(Number(body?.limit) || 10, 50);
    const results: Array<Record<string, unknown>> = [];

    for (const p of ['google', 'microsoft']) {
      const { data: users } = await supabase
        .schema('core')
        .rpc('get_sync_eligible_users', { p_provider: p, p_limit: limit });

      for (const u of users || []) {
        try {
          const r = await syncUserCalendar(
            supabase,
            u.user_id,
            p,
            encryptionKey,
          );
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

    return new Response(
      JSON.stringify({ synced_users: results.length, results }),
      {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: safeError(error) }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function syncUserCalendar(
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

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(
      token,
      provider,
      userId,
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

  const result =
    provider === 'google'
      ? await syncGoogleCalendar(accessToken, userId, supabase)
      : await syncOutlookCalendar(accessToken, userId, supabase);

  return {
    user_id: userId,
    provider,
    status: 'completed',
    ...result,
  };
}
