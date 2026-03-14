import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  listCertifications,
  mapCourseToCertification,
  computeCertificationStats,
  createCourse,
} from '@/lib/services/educationService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const raw = await listCertifications(supabase, user.id);
    const certifications = raw.map(mapCourseToCertification);
    const stats = computeCertificationStats(raw);
    return NextResponse.json({ certifications, stats });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const courseData = {
      title: body.title,
      provider: body.provider,
      platform: body.platform || null,
      certificate_url: body.certificateUrl || null,
      status: 'completed',
      completed_at: body.certificateDate || new Date().toISOString(),
      skills_learned: body.skills || [],
    };
    const course = await createCourse(supabase, user.id, courseData);
    return NextResponse.json({ certification: mapCourseToCertification(course) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
