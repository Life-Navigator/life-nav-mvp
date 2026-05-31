import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status') ?? 'pending';
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '50') || 50, 200);

  const sb: any = supabase;
  let q = sb
    .schema('health_meta')
    .from('health_alert_events')
    .select(
      'id, rule_id, rule_key, severity, observed_at, headline, body, recommended_next_step, trigger_metrics, acknowledged_at, dismissed_at, shared_with_physician_at'
    )
    .eq('user_id', user.id)
    .order('observed_at', { ascending: false })
    .limit(limit);

  if (status === 'pending') {
    q = q.is('acknowledged_at', null).is('dismissed_at', null);
  } else if (status === 'acknowledged') {
    q = q.not('acknowledged_at', 'is', null);
  } else if (status === 'dismissed') {
    q = q.not('dismissed_at', 'is', null);
  }
  // 'all' falls through.

  const { data, error } = await q;
  if (error) {
    if (/permission|policy|locked/i.test(error.message)) {
      return NextResponse.json({ alerts: [], feature_locked: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ alerts: data ?? [] });
}
