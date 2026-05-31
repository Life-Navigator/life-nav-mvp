/**
 * POST /api/simulations/create
 *
 * Creates a life_scenarios row + an initial set of life_scenario_versions
 * (defaulting to the 5 canonical labels). Does NOT run the projector —
 * call POST /api/simulations/[id]/run when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ALL_LABELS } from '@/types/trajectory';

export const dynamic = 'force-dynamic';

const Body = z.object({
  title: z.string().trim().min(1).max(256),
  description: z.string().trim().max(4000).optional().nullable(),
  primary_goal_id: z.string().uuid().optional().nullable(),
  horizon_years: z.number().int().min(1).max(60),
  versions: z
    .array(z.enum(ALL_LABELS as [string, ...string[]]))
    .min(1)
    .max(ALL_LABELS.length)
    .optional(),
  stated_goal: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
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
  const p = parsed.data;
  const labels = p.versions ?? ALL_LABELS;
  const sb: any = supabase;

  const { data: scenario, error: sErr } = await sb
    .from('life_scenarios')
    .insert({
      user_id: user.id,
      title: p.title,
      description: p.description ?? null,
      domain: 'multi',
      primary_goal_id: p.primary_goal_id ?? null,
      status: 'draft',
      source: 'user',
      metadata: { stated_goal: p.stated_goal ?? null },
    })
    .select('id')
    .single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  const versionRows = labels.map((label, i) => ({
    user_id: user.id,
    scenario_id: scenario.id,
    version_index: i,
    label,
    horizon_years: p.horizon_years,
    status: 'created',
    source: 'engine',
  }));
  const { data: versions, error: vErr } = await sb
    .from('life_scenario_versions')
    .insert(versionRows)
    .select('id, label, version_index, horizon_years, status');
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });

  return NextResponse.json({ success: true, scenario_id: scenario.id, versions });
}
