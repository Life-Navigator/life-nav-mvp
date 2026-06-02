/**
 * POST /api/optimizer/run
 *
 * Body:
 *   {
 *     monthly_surplus: number,
 *     stated_goal?: string,
 *     goal_id?: uuid,
 *   }
 *
 * Loads the user's inputs under RLS, runs the deterministic optimizer,
 * and persists the full run (goal interpretation + run row + inputs
 * snapshot + assumptions + allocations + tradeoffs + recommendations).
 *
 * Returns the run id and the rendered output so the UI can display it
 * without a second round-trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadInputs, run } from '@/lib/optimizer/engine';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const Body = z.object({
  monthly_surplus: z.number().finite().min(0).max(1_000_000),
  stated_goal: z.string().trim().max(2000).optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
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

  const inputs = await loadInputs(supabase, user.id, parsed.data.monthly_surplus, {
    goal_id: parsed.data.goal_id ?? null,
    stated_goal: parsed.data.stated_goal ?? null,
  });
  const output = run(inputs);

  const sb: any = supabase;

  // 1. Goal interpretation (always insert a fresh row — these are cheap
  //    and we want the engine_version stamp + audit trail.)
  const { data: interp, error: interpErr } = await sb
    .from('goal_interpretations')
    .insert({
      user_id: user.id,
      goal_id: parsed.data.goal_id ?? null,
      stated_goal: output.stated_goal,
      inferred_true_goal: output.inferred_true_goal,
      confidence_score: output.confidence,
      source: 'engine',
    })
    .select('id')
    .single();
  if (interpErr) return safeApiError({ code: 'validation_failed', internal: interpErr });
  const interpretation_id = interp?.id ?? null;

  // 2. Run header.
  const totalAlloc = output.allocations.reduce((a, b) => a + b.amount_usd, 0);
  const { data: runRow, error: runErr } = await sb
    .from('goal_optimizer_runs')
    .insert({
      user_id: user.id,
      goal_id: parsed.data.goal_id ?? null,
      interpretation_id,
      status: 'completed',
      engine_version: output.engine_version,
      monthly_surplus: output.monthly_surplus,
      total_allocation: totalAlloc,
      next_best_action: output.next_best_action,
      summary: output.summary,
      confidence_score: output.confidence,
      source: 'engine',
    })
    .select('id')
    .single();
  if (runErr) return safeApiError({ code: 'validation_failed', internal: runErr });
  const run_id: string = runRow.id;

  // 3. Inputs snapshot — write what we read so future re-runs can replay.
  await sb.from('goal_optimizer_inputs').insert({
    user_id: user.id,
    run_id,
    inputs: {
      profile: inputs.profile,
      debts: inputs.debts,
      insurance: inputs.insurance,
      risk: inputs.risk,
      decision_preferences: inputs.decision_preferences,
      career: inputs.career,
      education: inputs.education,
      goals: inputs.goals.map((g) => ({ id: g.id, category: g.category, title: g.title })),
      monthly_surplus: inputs.monthly_surplus,
      goal_id: inputs.user_goal_id ?? null,
      stated_goal: inputs.stated_goal ?? null,
    },
    source: 'engine',
  });

  // 4. Assumptions.
  if (output.assumptions.length > 0) {
    await sb.from('goal_optimizer_assumptions').insert(
      output.assumptions.map((a) => ({
        user_id: user.id,
        run_id,
        assumption_key: a.key,
        assumption_value: a.value,
        rationale: a.rationale,
        source: 'engine',
      }))
    );
  }

  // 5. Allocations.
  if (output.allocations.length > 0) {
    await sb.from('goal_optimizer_allocations').insert(
      output.allocations.map((a) => ({
        user_id: user.id,
        run_id,
        category: a.category,
        amount_usd: a.amount_usd,
        share_pct: a.share_pct,
        priority: a.priority,
        rationale: a.rationale,
        category_score: a.category_score,
        source: 'engine',
        confidence_score: output.confidence,
      }))
    );
  }

  // 6. Tradeoffs.
  if (output.tradeoffs.length > 0) {
    await sb.from('goal_optimizer_tradeoffs').insert(
      output.tradeoffs.map((t) => ({
        user_id: user.id,
        run_id,
        axis_a: t.axis_a,
        axis_b: t.axis_b,
        tradeoff_summary: t.summary,
        favored_axis: t.favored_axis,
        source: 'engine',
      }))
    );
  }

  // 7. The user-facing recommendation row.
  await sb.from('goal_optimizer_recommendations').insert({
    user_id: user.id,
    run_id,
    title: output.next_best_action,
    body: `${output.summary}\n\nNext-best action: ${output.next_best_action}`,
    status: 'pending',
    source: 'engine',
    confidence_score: output.confidence,
  });

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: {
      kind: 'optimizer_recommendation',
      id: run_id,
      text: subjectTextFromPayload(output),
    },
    emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({
    success: true,
    run_id,
    output,
    governance: { verdict: g.decision.verdict },
  });
}
