import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';
import { updateGoal } from '@/lib/services/goalsService';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data: goal, error } = await (supabase as any)
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    return NextResponse.json({ goal });
  } catch (err) {
    console.error('Goal GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    let goal;
    try {
      // updateGoal aliases + whitelists the payload onto real public.goals columns and stamps
      // updated_at; it scopes the write to (id, user_id) so RLS + ownership both hold.
      goal = await updateGoal(supabase, user.id, id, body);
    } catch (dbErr: any) {
      return safeApiError({
        code: 'db_persistence_error',
        internal: dbErr,
        context: { route: 'PUT /api/goals/[id]', table: 'public.goals' },
      });
    }
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    await recordUserEvent(supabase, {
      user_id: user.id,
      event_type: 'goal_updated',
      event_metadata: { fields: Object.keys(body || {}) },
      subject_kind: 'goal',
      subject_id: id,
    });

    return NextResponse.json({ goal });
  } catch (err) {
    console.error('Goal PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { error } = await (supabase as any)
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return safeApiError({ code: 'validation_failed', internal: error });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Goal DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
