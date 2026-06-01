/**
 * POST /api/explainers/tradeoff
 *
 * Body: { recommendation: RecommendationOutput, dominant_driver? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { explainTradeoff } from '@/lib/conversation/conversation-explainers';
import type { RecommendationOutput } from '@/types/advisor';
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
    recommendation: RecommendationOutput;
    dominant_driver?: DominantDriver;
  };
  if (!body?.recommendation) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const explanation = explainTradeoff({
    recommendation: body.recommendation,
    dominant_driver: body.dominant_driver,
  });
  return NextResponse.json({ explanation });
}
