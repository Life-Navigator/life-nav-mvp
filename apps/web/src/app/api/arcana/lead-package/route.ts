/**
 * POST /api/arcana/lead-package
 *
 * Generates a frozen lead package given an unexpired, unrevoked consent.
 *
 * Body: {
 *   consent_id: string;
 *   initials: string;
 *   age_band?: string;
 *   sex?: 'male'|'female'|'other'|'prefer_not_to_say';
 *   key_risks?: string[];
 *   recommended_discussion_topics?: string[];
 *   readiness_score?: number;
 *   probability_of_success?: number;
 *   medication_narrative?: Array<{ narrative: string; ongoing: boolean }>;
 *   insurance_plan_summary?: string;
 *   insurance_coverage_notes?: string;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildLeadPackagePayload, verifyConsentAt } from '@/lib/arcana/lead-package-service';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';
import { safeApiError } from '@/lib/security/safe-error';
import type {
  ArcanaConstraint,
  ArcanaGoal,
  ArcanaMotivation,
  ArcanaProfile,
  BiometricObservation,
  LabResult,
  LeadPackageConsent,
  SupplementProtocol,
  TrainingProtocol,
} from '@/types/arcana';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    consent_id: string;
    initials: string;
    age_band?: string;
    sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    key_risks?: string[];
    recommended_discussion_topics?: string[];
    readiness_score?: number;
    probability_of_success?: number;
    medication_narrative?: Array<{ narrative: string; ongoing: boolean }>;
    insurance_plan_summary?: string;
    insurance_coverage_notes?: string;
  };
  if (!body?.consent_id || !body?.initials) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const sb = supabase as any;

  // 1. Pull consent + verify.
  const consentRes = await sb
    .from('lead_package_consents')
    .select('*')
    .eq('id', body.consent_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (consentRes.error || !consentRes.data) {
    return NextResponse.json({ error: 'consent not found' }, { status: 404 });
  }
  const consent = consentRes.data as LeadPackageConsent;
  const verdict = verifyConsentAt(consent, new Date().toISOString());
  if (!verdict.ok) {
    return NextResponse.json(
      { error: 'consent invalid', reasons: verdict.reasons },
      { status: 403 }
    );
  }

  // 2. Load profile + sections per consent flags.
  const [profileRes, goalsRes, conRes, motRes, bioRes, labsRes, trainRes, suppRes] =
    await Promise.all([
      sb.from('arcana_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      consent.include_goals
        ? sb.from('arcana_goals').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
      consent.include_constraints
        ? sb.from('arcana_constraints').select('*').eq('user_id', user.id).eq('is_active', true)
        : Promise.resolve({ data: [], error: null }),
      consent.include_motivation
        ? sb
            .from('arcana_motivations')
            .select('*')
            .eq('user_id', user.id)
            .order('intensity', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      consent.include_biometrics
        ? sb
            .from('biometric_observations')
            .select('*')
            .eq('user_id', user.id)
            .order('collected_at', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
      consent.include_labs
        ? sb
            .from('lab_results')
            .select('*')
            .eq('user_id', user.id)
            .order('collection_date', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
      consent.include_protocols
        ? sb.from('training_protocols').select('*').eq('user_id', user.id).eq('active', true)
        : Promise.resolve({ data: [], error: null }),
      consent.include_supplements
        ? sb.from('supplement_protocols').select('*').eq('user_id', user.id).eq('active', true)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (!profileRes.data) {
    return NextResponse.json({ error: 'profile missing' }, { status: 409 });
  }

  // 3. Build payload.
  const payload = buildLeadPackagePayload({
    profile: profileRes.data as ArcanaProfile,
    consent,
    initials: body.initials,
    age_band: body.age_band,
    sex: body.sex,
    goals: (goalsRes.data ?? []) as ArcanaGoal[],
    constraints: (conRes.data ?? []) as ArcanaConstraint[],
    motivations: (motRes.data ?? []) as ArcanaMotivation[],
    biometrics_most_recent: (bioRes.data ?? []) as BiometricObservation[],
    labs_most_recent: (labsRes.data ?? []) as LabResult[],
    training_protocols: (trainRes.data ?? []) as TrainingProtocol[],
    supplement_protocols: (suppRes.data ?? []) as SupplementProtocol[],
    medication_narrative: body.medication_narrative,
    insurance_plan_summary: body.insurance_plan_summary,
    insurance_coverage_notes: body.insurance_coverage_notes,
    readiness_score: body.readiness_score,
    probability_of_success: body.probability_of_success,
    key_risks: body.key_risks,
    recommended_discussion_topics: body.recommended_discussion_topics,
  });

  // 4. Persist immutable snapshot.
  const insert = await sb
    .from('lead_packages')
    .insert({
      user_id: user.id,
      consent_id: consent.id,
      recipient_provider_id: consent.recipient_provider_id ?? null,
      payload,
      payload_version: 'v1',
      readiness_score: body.readiness_score ?? null,
      probability_of_success: body.probability_of_success ?? null,
      key_risks: body.key_risks ?? [],
      recommended_discussion_topics: body.recommended_discussion_topics ?? [],
      metadata: {},
    })
    .select('*')
    .single();

  if (insert.error) return safeApiError({ code: 'db_persistence_error', internal: insert.error });

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: {
      kind: 'arcana_recommendation',
      id: insert.data?.id ?? undefined,
      text: subjectTextFromPayload({
        key_risks: body.key_risks,
        recommended_discussion_topics: body.recommended_discussion_topics,
      }),
    },
    emitter: {
      agent_kind: 'arcana_provider_coordination',
      agent_name: 'arcana.provider_coordination',
    },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({
    lead_package: insert.data,
    governance: { verdict: g.decision.verdict },
  });
}
