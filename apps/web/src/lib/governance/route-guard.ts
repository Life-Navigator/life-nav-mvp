/**
 * Route-level governance wrapper — Sprint N.2 (Phase 1).
 *
 * Single chokepoint for every MUST_WIRE route. Calling `guardOutgoing`
 * now runs the full Sprint L2 constitutional pipeline (`reviewAndPersist`)
 * instead of the regex-only Sprint L pipeline:
 *
 *   1. Constitutional retrieval (governance.constitutional_entities)
 *   2. 13-step hard-constraint review (lawfulness → safety → harm → crisis
 *      → emotional → ethics → neutrality → COI → autonomy → future
 *      preservation → future visibility → goal alignment → outcome)
 *   3. Cognitive distortion + realism + trajectory review
 *   4. Constructive redirection synthesis when applicable
 *   5. Decision-governance audit row persistence
 *   6. Per-iteration governance_review_iterations rows
 *
 * Sprint L's policy engine remains the validator inside steps 1-3 + 6-9,
 * so block semantics are preserved bit-for-bit. The constitutional layer
 * adds — it never weakens.
 *
 * Backward-compatible contract:
 *
 *   if (!g.ok) return g.response;          // 422 on hard block
 *   g.decision  : GovernanceDecision        // Sprint L view
 *   g.constitutional : ConstitutionalDecision // Sprint L2 view
 */

import { NextResponse } from 'next/server';
import { reviewAndPersist } from '@/lib/constitutional/middleware';
import { detectInjection } from '@/lib/security/injection';
import {
  persistInjectionFindings,
  persistContentVerdict,
} from '@/lib/security/injection/audit-persistence';
import { recordUserEvent } from '@/lib/analytics/events';
import { recordRecommendationGenerated } from '@/lib/outcomes/decision-outcomes';
import type { GovernanceDecision, GovernanceSubject, SubjectEmitter } from '@/types/governance';
import type { ConstitutionalDecision } from '@/types/constitutional';
import type { DetectionResult } from '@/lib/security/injection/types';

/**
 * Subjects that count as "a new recommendation just got emitted" —
 * these flip the lifecycle: `recordRecommendationGenerated` runs and
 * a `recommendation_generated` user event is emitted.
 *
 * Non-recommendation subjects (simulation_output, advisor_message,
 * etc.) still go through guardOutgoing for governance but don't
 * register a decision outcome.
 */
const RECOMMENDATION_KINDS = new Set([
  'recommendation',
  'provider_recommendation',
  'arcana_recommendation',
  'optimizer_recommendation',
  'partner_recommendation',
]);

export interface GuardOutgoingInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user_id: string;
  subject: GovernanceSubject;
  emitter?: SubjectEmitter;
  now?: string;
  /** Optional user-input text for emotional / crisis assessment. */
  user_input_text?: string;
}

export interface GuardSuccess {
  ok: true;
  decision: GovernanceDecision;
  /** Full Sprint L2 constitutional decision (verdict + crisis + future + etc). */
  constitutional: ConstitutionalDecision;
  /** Text the route should actually surface, after constitutional rewriting. */
  final_text: string;
  /** Response-time injection verdict (LOW + 0 findings on healthy traffic). */
  injection: DetectionResult;
  audit_row_id?: string;
  response?: undefined;
}

export interface GuardBlocked {
  ok: false;
  response: NextResponse;
  decision: GovernanceDecision;
  constitutional?: ConstitutionalDecision;
  /** Set when the block came from the response-time injection scan. */
  injection?: DetectionResult;
}

export type GuardResult = GuardSuccess | GuardBlocked;

/**
 * Canonical outgoing-content gate. Usage:
 *
 *   const g = await guardOutgoing({
 *     supabase, user_id: user.id,
 *     subject: { kind: 'recommendation', text, citations, ... },
 *     emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
 *   });
 *   if (!g.ok) return g.response;
 *   // ship g.final_text (Sprint L2 may have rewritten the draft)
 */
export async function guardOutgoing(inputs: GuardOutgoingInputs): Promise<GuardResult> {
  // Force user_id from the auth context; the subject cannot lie.
  const subject: GovernanceSubject = { ...inputs.subject, user_id: inputs.user_id };

  const result = await reviewAndPersist({
    supabase: inputs.supabase,
    user_id: inputs.user_id,
    draft_text: subject.text,
    user_input_text: inputs.user_input_text,
    subject,
    now: inputs.now ?? new Date().toISOString(),
  });

  const constitutional = result.final_decision;
  const decision = constitutional.governance;

  // ---- Response-time injection scan ---------------------------------------
  // Catch leakage of system prompts, policy text, embedded jailbreak
  // strings, or tool-abuse instructions that survived all upstream
  // engines. This is the last gate before the LLM reply reaches the
  // client. We scan BOTH the draft (subject.text — what the LLM
  // produced before realism rewrites) AND the final_text (in case the
  // engine introduced new content). Block if either is malicious.
  const injectionDraft = detectInjection({
    text: subject.text,
    origin: 'system',
    authority: 'system',
  });
  const injectionFinal = detectInjection({
    text: result.final_text,
    origin: 'system',
    authority: 'system',
  });
  // Pick the worst of the two as the "verdict" we report.
  const injection: DetectionResult =
    injectionDraft.findings.length >= injectionFinal.findings.length
      ? injectionDraft
      : injectionFinal;
  // Best-effort persistence — the audit row exists either way.
  await persistContentVerdict(
    inputs.supabase,
    injection,
    'system',
    {
      user_id: inputs.user_id,
    },
    { stage: 'response_time', emitter: inputs.emitter?.agent_kind }
  );
  if (injection.findings.length > 0) {
    await persistInjectionFindings(
      inputs.supabase,
      injection,
      'system',
      {
        user_id: inputs.user_id,
      },
      { stage: 'response_time', emitter: inputs.emitter?.agent_kind }
    );
  }

  if (!decision.approved) {
    return {
      ok: false,
      decision,
      constitutional,
      injection,
      response: NextResponse.json(
        { error: 'governance_blocked', decision, constitutional_verdict: constitutional.verdict },
        { status: 422 }
      ),
    };
  }

  // Block on response-time injection — the LLM has tried to leak the
  // hidden prompt or include a tool-call attempt. Never ship that.
  if (injection.action === 'REJECT' || injection.action === 'QUARANTINE') {
    return {
      ok: false,
      decision,
      constitutional,
      injection,
      response: NextResponse.json(
        {
          error: 'response_injection_blocked',
          injection_action: injection.action,
          severity: injection.highest_severity,
        },
        { status: 422 }
      ),
    };
  }

  // Sprint O.0.1 — recommendation lifecycle + telemetry.
  //
  // Every governed recommendation surface routes through this single
  // chokepoint, so registering the decision-outcome row and emitting
  // the `recommendation_generated` event here is the lowest-churn way
  // to give the lifecycle + dashboard real data. Subject kinds that
  // are not recommendations (advisor_message, simulation_output, etc.)
  // are skipped.
  if (RECOMMENDATION_KINDS.has(subject.kind) && subject.id) {
    await recordRecommendationGenerated(
      inputs.supabase,
      {
        user_id: inputs.user_id,
        recommendation_id: subject.id,
        governance_audit_id: null,
      },
      {
        emitter_agent_kind: inputs.emitter?.agent_kind,
        emitter_agent_name: inputs.emitter?.agent_name,
        subject_kind: subject.kind,
      }
    );
    await recordUserEvent(inputs.supabase, {
      user_id: inputs.user_id,
      event_type: 'recommendation_generated',
      event_metadata: {
        emitter_agent_kind: inputs.emitter?.agent_kind ?? null,
        emitter_agent_name: inputs.emitter?.agent_name ?? null,
        subject_kind: subject.kind,
      },
      subject_kind: subject.kind,
      subject_id: subject.id,
    });
  }

  // Provider-emitter referrals get their own event.
  if (subject.kind === 'provider_recommendation' && inputs.emitter?.agent_kind === 'provider') {
    await recordUserEvent(inputs.supabase, {
      user_id: inputs.user_id,
      event_type: 'provider_referral_generated',
      event_metadata: {
        emitter_agent_name: inputs.emitter?.agent_name ?? null,
      },
      subject_kind: subject.kind,
      subject_id: subject.id,
    });
  }

  return {
    ok: true,
    decision,
    constitutional,
    injection,
    final_text: result.final_text,
  };
}

/**
 * Convenience: render any value as the subject text. Used by routes
 * whose output is structured JSON; we serialize it deterministically
 * so the governance text reflects what the user is about to receive.
 */
export function subjectTextFromPayload(payload: unknown, maxLen = 4000): string {
  try {
    const t = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return t.length > maxLen ? t.slice(0, maxLen - 3) + '...' : t;
  } catch {
    return String(payload);
  }
}
