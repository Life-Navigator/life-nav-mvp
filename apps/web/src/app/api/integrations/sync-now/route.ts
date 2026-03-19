import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['email', 'calendar'] as const;
type SyncType = (typeof VALID_TYPES)[number];

const EDGE_FUNCTION_MAP: Record<SyncType, string> = {
  email: 'email-sync',
  calendar: 'calendar-sync',
};

const COOLDOWN_SECONDS = 60;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { provider, type } = body as { provider?: string; type?: string };

    if (!provider || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, type' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type as SyncType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify user has this integration connected
    const { data: integration } = await (supabase as any)
      .from('integrations')
      .select('id, status, last_sync_at')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (!integration) {
      return NextResponse.json({ error: `No ${provider} integration found` }, { status: 404 });
    }

    if (integration.status === 'disconnected') {
      return NextResponse.json(
        { error: `${provider} integration is disconnected` },
        { status: 400 }
      );
    }

    // --- Cooldown check ---
    const lastSyncAt = await getLastSyncTime(supabase, user.id, provider, type as SyncType);

    if (lastSyncAt) {
      const secondsSinceLastSync = (Date.now() - new Date(lastSyncAt).getTime()) / 1000;
      if (secondsSinceLastSync < COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(COOLDOWN_SECONDS - secondsSinceLastSync);
        return NextResponse.json(
          {
            error: 'Sync already triggered recently. Please wait before retrying.',
            retryAfterSeconds: retryAfter,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfter) },
          }
        );
      }
    }

    // Invoke the Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const workerSecret = process.env.WORKER_SECRET;

    if (!supabaseUrl || !workerSecret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    const edgeFunctionName = EDGE_FUNCTION_MAP[type as SyncType];

    return await Sentry.startSpan(
      {
        op: 'sync.trigger',
        name: `sync-now ${provider}/${type}`,
        attributes: {
          'sync.provider': provider,
          'sync.type': type,
          'sync.trigger_source': 'manual',
          'sync.user_id': user.id,
          'sync.edge_function': edgeFunctionName,
        },
      },
      async (span) => {
        const response = await fetch(`${supabaseUrl}/functions/v1/${edgeFunctionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': workerSecret,
          },
          body: JSON.stringify({ user_id: user.id, provider }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          span.setAttributes({
            'sync.result': 'edge_function_failed',
            'sync.edge_function_status': response.status,
          });
          Sentry.captureMessage('Sync edge function failed', {
            level: 'warning',
            extra: {
              provider,
              type,
              userId: user.id,
              edgeFunction: edgeFunctionName,
              status: response.status,
              errorText: errorText.slice(0, 500),
            },
          });
          return NextResponse.json(
            { error: `Sync failed: ${errorText}` },
            { status: response.status }
          );
        }

        const result = await response.json();
        span.setAttributes({
          'sync.result': 'success',
          'sync.synced_count': result.synced ?? result.count ?? 0,
        });
        return NextResponse.json({ success: true, ...result });
      }
    );
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        route: '/api/integrations/sync-now',
        userId: user.id,
      },
    });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * Get the last sync timestamp for a specific sync type.
 * Uses email_sync_state for email, calendar_connections for calendar.
 */
async function getLastSyncTime(
  supabase: any,
  userId: string,
  provider: string,
  type: SyncType
): Promise<string | null> {
  if (type === 'email') {
    const { data } = await (supabase as any)
      .from('email_sync_state')
      .select('last_synced_at')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();
    return data?.last_synced_at ?? null;
  }

  if (type === 'calendar') {
    const { data } = await (supabase as any)
      .from('calendar_connections')
      .select('last_synced_at')
      .eq('user_id', userId)
      .eq('provider', provider)
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.last_synced_at ?? null;
  }

  return null;
}
