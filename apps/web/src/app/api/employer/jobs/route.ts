/**
 * POST /api/employer/jobs   — create a draft job for the calling user's
 *                              employer profile.
 * GET  /api/employer/jobs   — list jobs visible to the calling user
 *                              (employer member access via RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const RequirementSchema = z.object({
  requirement_kind: z.enum([
    'skill_required',
    'skill_preferred',
    'certification',
    'education',
    'experience_years',
  ]),
  value: z.string().trim().min(1).max(128),
  weight: z.number().finite().min(0).max(10).optional(),
});

const Body = z.object({
  title: z.string().trim().min(1).max(256),
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
  salary_currency: z.string().trim().length(3).optional(),
  apply_instructions: z.string().trim().max(4000).optional().nullable(),
  apply_url: z.string().trim().max(1024).optional().nullable(),
  veteran_friendly: z.boolean().optional(),
  expires_at: z.string().datetime().optional().nullable(),
  requirements: z.array(RequirementSchema).max(50).optional(),
  locations: z
    .array(
      z.object({
        city: z.string().trim().max(128).optional().nullable(),
        state: z.string().trim().max(64).optional().nullable(),
        country: z.string().trim().max(64).optional().nullable(),
        is_primary: z.boolean().optional(),
      })
    )
    .max(20)
    .optional(),
  benefits: z
    .array(
      z.object({
        benefit_key: z.string().trim().min(1).max(64),
        details: z.string().trim().max(1024).optional().nullable(),
      })
    )
    .max(30)
    .optional(),
});

async function getEmployerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('employer_users')
    .select('employer_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.employer_id ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb: any = supabase;
  const employerId = await getEmployerId(sb, user.id);
  if (!employerId) return NextResponse.json({ error: 'No employer profile' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { requirements, locations, benefits, ...job } = parsed.data;

  const { data: post, error } = await sb
    .from('employer_job_posts')
    .insert({
      ...job,
      employer_id: employerId,
      posted_by: user.id,
      status: 'draft',
      source: 'employer',
    })
    .select('id')
    .single();
  if (error) return safeApiError({ code: 'validation_failed', internal: error });

  if (requirements && requirements.length > 0) {
    await sb
      .from('employer_job_post_requirements')
      .insert(requirements.map((r) => ({ job_post_id: post.id, weight: r.weight ?? 1.0, ...r })));
  }
  if (locations && locations.length > 0) {
    await sb
      .from('employer_job_post_locations')
      .insert(locations.map((l) => ({ job_post_id: post.id, ...l })));
  }
  if (benefits && benefits.length > 0) {
    await sb
      .from('employer_job_post_benefits')
      .insert(benefits.map((b) => ({ job_post_id: post.id, ...b })));
  }

  return NextResponse.json({ success: true, job_post_id: post.id });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb: any = supabase;
  const { data, error } = await sb
    .from('employer_job_posts')
    .select(
      'id, title, employment_type, remote_mode, experience_level, salary_min, salary_max, status, published_at, expires_at, created_at'
    )
    .order('created_at', { ascending: false });
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ jobs: data ?? [] });
}
