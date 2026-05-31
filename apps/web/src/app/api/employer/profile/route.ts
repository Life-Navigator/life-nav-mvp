/**
 * Employer profile management. The first call by an authenticated user
 * creates an employer_profiles row AND inserts an employer_users row
 * (under the calling user) with role='owner'. Subsequent calls upsert
 * the profile.
 *
 * Note: insert-as-owner requires service_role because RLS on
 * employer_profiles is public-read-only for verified rows and
 * service-role-bypass for writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  legal_name: z.string().trim().min(1).max(256),
  display_name: z.string().trim().max(256).optional().nullable(),
  industry: z.string().trim().max(128).optional().nullable(),
  size_band: z
    .enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'])
    .optional()
    .nullable(),
  website: z.string().trim().max(512).optional().nullable(),
  hq_city: z.string().trim().max(128).optional().nullable(),
  hq_country: z.string().trim().max(64).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  veteran_friendly: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const service = createServiceRoleClient();
  if (!supabase || !service) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb: any = supabase;
  const svc: any = service;

  // Look up existing membership for this user.
  const { data: membership } = await sb
    .from('employer_users')
    .select('employer_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (membership) {
    // Update the linked employer profile.
    const { error } = await svc
      .from('employer_profiles')
      .update(parsed.data)
      .eq('id', membership.employer_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, employer_id: membership.employer_id });
  }

  // Create a new employer profile under service_role and link this user
  // as owner. Profile starts in pending_verification.
  const { data: profile, error: profileErr } = await svc
    .from('employer_profiles')
    .insert({ ...parsed.data, status: 'pending_verification' })
    .select('id')
    .single();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 });

  const { error: linkErr } = await svc.from('employer_users').insert({
    employer_id: profile.id,
    user_id: user.id,
    role: 'owner',
    is_active: true,
  });
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

  return NextResponse.json({ success: true, employer_id: profile.id });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb: any = supabase;
  const { data: membership } = await sb
    .from('employer_users')
    .select('employer_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership) return NextResponse.json({ employer: null });

  const { data: profile } = await sb
    .from('employer_profiles')
    .select('*')
    .eq('id', membership.employer_id)
    .maybeSingle();
  return NextResponse.json({ employer: profile, role: membership.role });
}
