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

    // Query documents table for linked certificate images
    const { data: docs } = (await supabase
      .from('documents')
      .select('storage_path, metadata')
      .eq('user_id', user.id)
      .in('document_type', ['certificate', 'transcript'])) as {
      data: Array<{ storage_path: string; metadata: Record<string, unknown> }> | null;
    };

    const imageMap = new Map<string, string>();
    for (const doc of docs || []) {
      const linkedId = doc.metadata?.linked_course_id;
      if (typeof linkedId === 'string') {
        imageMap.set(linkedId, doc.storage_path);
      }
    }

    const certsWithImages = certifications.map((c: Record<string, unknown>) => ({
      ...c,
      certificateImagePath: imageMap.get(c.id as string) || null,
    }));

    return NextResponse.json({ certifications: certsWithImages, stats });
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
      course_name: body.title || body.courseName || body.name,
      provider: body.provider,
      url: body.platform || null,
      certificate_url: body.certificateUrl || null,
      status: 'completed',
      completion_date: body.certificateDate || new Date().toISOString(),
      skills_learned: body.skills || [],
    };
    const course = await createCourse(supabase, user.id, courseData);
    const certification = mapCourseToCertification(course);

    // If a document was uploaded, link it to the newly created course
    if (body.documentId) {
      await (supabase.from('documents') as any)
        .update({
          metadata: { linked_course_id: course.id },
        })
        .eq('id', body.documentId)
        .eq('user_id', user.id);
    }

    return NextResponse.json(
      {
        certification: {
          ...certification,
          certificateImagePath: body.storagePath || null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
