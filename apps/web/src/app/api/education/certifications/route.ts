import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
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
    return safeApiError({ code: 'internal_error', internal: err });
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
    if (!body?.title || String(body.title).trim() === '') {
      return NextResponse.json(
        { error: 'A certification title is required.', code: 'missing_title' },
        { status: 400 }
      );
    }
    // Friendly names — createCourse()/toCourseRow() aliases them to the real columns
    // (title→course_name, certificateUrl→certificate_url, certificateDate→completion_date,
    // skills→skills_learned) and drops anything unknown (e.g. platform, credentialId).
    const courseData = {
      title: body.title,
      provider: body.provider,
      certificateUrl: body.certificateUrl ?? null,
      status: 'completed',
      // a cert without an explicit date is treated as earned today
      certificateDate: body.certificateDate || new Date().toISOString().slice(0, 10),
      skills: body.skills || [],
    };
    const course = await createCourse(supabase, user.id, courseData);
    return NextResponse.json({ certification: mapCourseToCertification(course) }, { status: 201 });
  } catch (err) {
    return safeApiError({ code: 'bad_request', internal: err });
  }
}
