import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const financialRisk = Number(body.financialRiskTolerance) || 50;
  const careerRisk = Number(body.careerRiskTolerance) || 50;
  const educationRisk = Number(body.educationRiskTolerance) || 50;
  const overallScore = Math.round((financialRisk + careerRisk + educationRisk) / 3);

  const riskLevel =
    overallScore >= 70 ? 'aggressive' : overallScore >= 40 ? 'moderate' : 'conservative';

  const { error } = await (supabase as any).from('risk_assessments').insert({
    user_id: user.id,
    assessment_type: 'onboarding',
    overall_score: overallScore,
    risk_level: riskLevel,
    status: 'completed',
    responses: body.assessmentResponses || body.responses || {},
    metadata: {
      financialRiskTolerance: financialRisk,
      careerRiskTolerance: careerRisk,
      educationRiskTolerance: educationRisk,
      riskTheta: body.riskTheta,
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, risk_level: riskLevel, overall_score: overallScore });
}
