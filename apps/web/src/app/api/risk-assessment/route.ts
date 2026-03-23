import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: assessment, error } = await (supabase as any)
      .from('risk_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assessment: assessment || null });
  } catch (err) {
    console.error('Risk assessment GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { data: assessment, error } = await (supabase as any)
      .from('risk_assessments')
      .insert({
        user_id: user.id,
        assessment_type: body.assessment_type || 'comprehensive',
        overall_score: body.overall_score,
        risk_level: body.risk_level,
        status: 'completed',
        responses: body.responses || {},
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assessment }, { status: 201 });
  } catch (err) {
    console.error('Risk assessment POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
