import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';

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
    const { id: _id, user_id: _uid, created_at: _ca, ...updateData } = body;

    const { data: goal, error } = await (supabase as any)
      .from('goals')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return safeApiError({ code: 'validation_failed', internal: error });
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    await recordUserEvent(supabase, {
      user_id: user.id,
      event_type: 'goal_updated',
      event_metadata: { fields: Object.keys(updateData) },
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
