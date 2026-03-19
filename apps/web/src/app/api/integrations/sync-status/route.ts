import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Fetch integration connections
    const { data: integrations } = await (supabase as any)
      .from('integrations')
      .select('provider, status, last_sync_at, metadata')
      .eq('user_id', user.id);

    // Fetch email count
    const { count: emailCount } = await (supabase as any)
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Fetch calendar event count
    const { count: calendarCount } = await (supabase as any)
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Build sources from integrations
    const sources: Array<{
      provider: string;
      type: string;
      status: string;
      lastSyncAt: string | null;
      recordCount: number;
    }> = [];

    for (const integration of integrations ?? []) {
      const scopes = integration.metadata?.scopes ?? [];
      const hasEmail =
        scopes.includes('https://www.googleapis.com/auth/gmail.readonly') ||
        scopes.includes('Mail.Read') ||
        integration.metadata?.email_enabled;
      const hasCalendar =
        scopes.includes('https://www.googleapis.com/auth/calendar.readonly') ||
        scopes.includes('Calendars.Read') ||
        integration.metadata?.calendar_enabled;

      if (hasEmail) {
        sources.push({
          provider: integration.provider,
          type: 'email',
          status: integration.status ?? 'connected',
          lastSyncAt: integration.last_sync_at,
          recordCount: emailCount ?? 0,
        });
      }
      if (hasCalendar) {
        sources.push({
          provider: integration.provider,
          type: 'calendar',
          status: integration.status ?? 'connected',
          lastSyncAt: integration.last_sync_at,
          recordCount: calendarCount ?? 0,
        });
      }
    }

    // Fetch GraphRAG queue stats (requires service role to bypass RLS on graphrag schema)
    let graphrag = { pendingJobs: 0, failedJobs: 0, lastProcessedAt: null as string | null };
    const serviceClient = createServiceRoleClient();
    if (serviceClient) {
      const { data: queueStats, error: rpcError } = await (serviceClient as any).rpc(
        'get_sync_queue_stats',
        { p_user_id: user.id }
      );

      if (rpcError) {
        Sentry.captureMessage('GraphRAG queue stats RPC failed', {
          level: 'warning',
          extra: {
            userId: user.id,
            error: rpcError.message,
            code: rpcError.code,
          },
        });
      } else if (queueStats) {
        graphrag = {
          pendingJobs: queueStats.pending_count ?? 0,
          failedJobs: queueStats.failed_count ?? 0,
          lastProcessedAt: queueStats.last_processed_at ?? null,
        };

        // Alert on accumulated failures
        if (graphrag.failedJobs > 10) {
          Sentry.captureMessage('High GraphRAG sync failure count', {
            level: 'warning',
            extra: {
              userId: user.id,
              failedJobs: graphrag.failedJobs,
              pendingJobs: graphrag.pendingJobs,
            },
          });
        }
      }
    }

    return NextResponse.json({ sources, graphrag });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        route: '/api/integrations/sync-status',
        userId: user.id,
      },
    });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
