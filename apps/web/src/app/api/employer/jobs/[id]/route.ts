import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const UpdateBody = z.object({
  title: z.string().trim().min(1).max(256).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  industry: z.string().trim().max(128).optional().nullable(),
  employment_type: z
    .enum(['full_time', 'part_time', 'contract', 'internship', 'apprenticeship', 'temporary'])
    .optional()
    .nullable(),
  remote_mode: z.enum(['remote', 'hybrid', 'on_site']).optional().nullable(),
  experience_level: z
    .enum(['intern', 'entry', 'mid', 'senior', 'lead', 'principal', 'executive'])
    .optional()
    .nullable(),
  salary_min: z.number().finite().min(0).optional().nullable(),
  salary_max: z.number().finite().min(0).optional().nullable(),
  apply_instructions: z.string().trim().max(4000).optional().nullable(),
  apply_url: z.string().trim().max(1024).optional().nullable(),
  veteran_friendly: z.boolean().optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const sb: any = supabase;
  const [{ data: post }, { data: reqs }, { data: locs }, { data: bens }] = await Promise.all([
    sb.from('employer_job_posts').select('*').eq('id', id).maybeSingle(),
    sb
      .from('employer_job_post_requirements')
      .select('requirement_kind, value, weight')
      .eq('job_post_id', id),
    sb
      .from('employer_job_post_locations')
      .select('city, state, country, is_primary')
      .eq('job_post_id', id),
    sb.from('employer_job_post_benefits').select('benefit_key, details').eq('job_post_id', id),
  ]);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    job: post,
    requirements: reqs ?? [],
    locations: locs ?? [],
    benefits: bens ?? [],
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = UpdateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb: any = supabase;
  // RLS already restricts updates to employer members.
  const { error } = await sb.from('employer_job_posts').update(parsed.data).eq('id', id);
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ success: true });
}
