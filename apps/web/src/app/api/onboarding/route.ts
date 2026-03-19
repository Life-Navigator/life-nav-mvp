import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Unified onboarding endpoint.
 * POST /api/onboarding?step=education-goals|career-goals|financial-goals|health-goals|risk-profile|complete|profile
 *
 * Also serves the individual routes via rewrite or direct call.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const step = new URL(request.url).searchParams.get('step') || body.step;

    switch (step) {
      case 'profile':
      case 'basic_profile':
        return handleProfile(supabase, user.id, body.data || body);
      case 'education-goals':
        return handleGoals(supabase, user.id, body, 'education');
      case 'career-goals':
        return handleGoals(supabase, user.id, body, 'career');
      case 'financial-goals':
        return handleGoals(supabase, user.id, body, 'finance');
      case 'health-goals':
        return handleGoals(supabase, user.id, body, 'health');
      case 'risk-profile':
        return handleRiskProfile(supabase, user.id, body);
      case 'complete':
        return handleComplete(supabase, user.id);
      default:
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
    }
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleProfile(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  userId: string,
  body: Record<string, unknown>
) {
  // Update display_name in profiles table
  const { error: profileError } = await (supabase as any)
    .from('profiles')
    .update({
      display_name: body.name as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // Store additional profile fields (PII) in auth user_metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      full_name: body.name as string,
      date_of_birth: body.dateOfBirth as string,
      phone_number: body.phoneNumber as string,
      city: body.city as string,
      state: body.state as string,
      country: body.country as string,
    },
  });

  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

async function handleGoals(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  userId: string,
  body: Record<string, unknown>,
  category: string
) {
  const goals = body.goals as Record<string, unknown> | undefined;
  if (!goals || typeof goals !== 'object') {
    return NextResponse.json({ success: true, message: 'No goals provided' });
  }

  // Extract goal data — the components send different shaped data
  const goalsToInsert: Array<Record<string, unknown>> = [];

  // Handle array format
  if (Array.isArray(goals)) {
    for (const goal of goals) {
      if (goal && typeof goal === 'object' && (goal as Record<string, unknown>).title) {
        goalsToInsert.push({
          user_id: userId,
          title: (goal as Record<string, unknown>).title,
          category,
          description: (goal as Record<string, unknown>).description || '',
          target_value: (goal as Record<string, unknown>).targetValue || null,
          unit: (goal as Record<string, unknown>).targetUnit || null,
          priority: (goal as Record<string, unknown>).priority || 'medium',
          status: 'active',
        });
      }
    }
  } else {
    // Handle object format (common from form data)
    const title =
      (goals as Record<string, unknown>).title ||
      (goals as Record<string, unknown>).primaryGoal ||
      (goals as Record<string, unknown>).goal;
    if (title) {
      goalsToInsert.push({
        user_id: userId,
        title: String(title),
        category,
        description: String((goals as Record<string, unknown>).description || ''),
        target_value: (goals as Record<string, unknown>).targetValue || null,
        unit: (goals as Record<string, unknown>).targetUnit || null,
        priority: String((goals as Record<string, unknown>).priority || 'medium'),
        status: 'active',
      });
    }
  }

  if (goalsToInsert.length > 0) {
    const { error } = await (supabase as any).from('goals').insert(goalsToInsert);
    if (error) {
      console.error(`Failed to insert ${category} goals:`, error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true, goals_created: goalsToInsert.length });
}

async function handleRiskProfile(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  userId: string,
  body: Record<string, unknown>
) {
  // Calculate overall risk score from individual tolerances
  const financialRisk = Number(body.financialRiskTolerance) || 50;
  const careerRisk = Number(body.careerRiskTolerance) || 50;
  const educationRisk = Number(body.educationRiskTolerance) || 50;
  const overallScore = Math.round((financialRisk + careerRisk + educationRisk) / 3);

  const riskLevel =
    overallScore >= 70 ? 'aggressive' : overallScore >= 40 ? 'moderate' : 'conservative';

  const { error } = await (supabase as any).from('risk_assessments').insert({
    user_id: userId,
    assessment_type: 'onboarding',
    overall_risk_score: overallScore,
    risk_tolerance: riskLevel,
    completed_at: new Date().toISOString(),
    metadata: {
      financialRiskTolerance: financialRisk,
      careerRiskTolerance: careerRisk,
      educationRiskTolerance: educationRisk,
      riskTheta: body.riskTheta,
      assessmentResponses: body.assessmentResponses || body.responses || {},
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, risk_level: riskLevel, overall_score: overallScore });
}

async function handleComplete(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  userId: string
) {
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      setup_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
