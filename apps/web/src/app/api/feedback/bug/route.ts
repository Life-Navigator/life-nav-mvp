import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateBugReport, type BugReportInput } from '@/lib/feedback/service';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as BugReportInput;
  const v = validateBugReport(body);
  if (!v.ok) return NextResponse.json({ error: 'invalid', errors: v.errors }, { status: 400 });

  const sb = supabase as any;
  const ins = await sb
    .from('feedback_bug_reports')
    .insert({
      user_id: user.id,
      title: body.title,
      body: body.body,
      severity: body.severity ?? 'medium',
      route_path: body.route_path ?? null,
      user_agent: body.user_agent ?? null,
      app_version: body.app_version ?? null,
      metadata: {},
    })
    .select('id')
    .single();
  if (ins.error) return safeApiError({ code: 'db_persistence_error', internal: ins.error });
  return NextResponse.json({ id: ins.data.id });
}
