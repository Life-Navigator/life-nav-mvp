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

  // Fetch all user data for GDPR-compliant export
  const [
    { data: profile },
    { data: goals },
    { data: courses },
    { data: applications },
    { data: documents },
    { data: riskAssessments },
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single(),
    sb.from('goals').select('*').eq('user_id', user.id),
    sb.from('courses').select('*').eq('user_id', user.id),
    sb.from('job_applications').select('*').eq('user_id', user.id),
    sb.from('documents').select('id, name, document_type, created_at').eq('user_id', user.id),
    sb.from('risk_assessments').select('*').eq('user_id', user.id),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      metadata: user.user_metadata,
      createdAt: user.created_at,
    },
    profile: profile || null,
    goals: goals || [],
    courses: courses || [],
    jobApplications: applications || [],
    documents: documents || [],
    riskAssessments: riskAssessments || [],
  });
}
