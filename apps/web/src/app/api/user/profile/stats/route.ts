import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;

  // Count goals
  const { count: goalsCount } = await sb
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Count completed goals
  const { count: goalsCompleted } = await sb
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed');

  // Count courses
  const { count: coursesCount } = await sb
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Count applications
  const { count: applicationsCount } = await sb
    .from('job_applications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return NextResponse.json({
    goalsCount: goalsCount ?? 0,
    goalsCompleted: goalsCompleted ?? 0,
    coursesCount: coursesCount ?? 0,
    applicationsCount: applicationsCount ?? 0,
    profileCompleteness: 50, // Placeholder
  });
}
