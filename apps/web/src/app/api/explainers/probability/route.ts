/**
 * POST /api/explainers/probability
 *
 * Body: { distribution: ProbabilityDistribution, dominant_driver? }
 *
 * Returns the structured ProbabilityExplanation. Determinism contract:
 * same input → same output. Gated by `guardOutgoing` per Sprint M.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { explainProbability } from '@/lib/conversation/conversation-explainers';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';
import type { ProbabilityDistribution } from '@/types/decision-impact';
import type { DominantDriver } from '@/types/conversation-intel';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    distribution: ProbabilityDistribution;
    dominant_driver?: DominantDriver;
  };
  if (!body?.distribution) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const explanation = explainProbability({
    distribution: body.distribution,
    dominant_driver: body.dominant_driver,
  });

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: { kind: 'probability_output', text: subjectTextFromPayload(explanation) },
    emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({ explanation, governance: { verdict: g.decision.verdict } });
}
