/**
 * ConstitutionalGovernanceEngine — Sprint L2 orchestrator.
 *
 * Composes Sprint L's GovernancePolicyEngine with the new
 * detection / review / redirection engines under the 13-step
 * hard-constraint order:
 *
 *    1. Lawfulness
 *    2. Safety
 *    3. Harm Prevention
 *    4. Crisis Detection
 *    5. Emotional Intelligence Review
 *    6. Ethical Compliance
 *    7. Political Neutrality
 *    8. Conflict Of Interest
 *    9. User Autonomy
 *   10. Future Preservation
 *   11. Future Visibility
 *   12. Goal Alignment
 *   13. Outcome Optimization
 *
 * Goal Alignment may NEVER occur before Lawfulness and Safety. The
 * orchestrator enforces this by short-circuiting at the first failed
 * hard-constraint step.
 *
 * Output verdicts:
 *    APPROVE
 *    APPROVE_WITH_MODIFICATION
 *    CONSTITUTIONAL_REDIRECTION
 *    REQUEST_CLARIFICATION
 *    SAFE_CONSTITUTIONAL_RESPONSE
 *
 * (NOT "BLOCK_AND_REDIRECT" per spec — we use CONSTITUTIONAL_REDIRECTION.)
 */

import { evaluate as sprintLEvaluate } from '@/lib/governance/policy-engine';
import { assessCrisis } from './detectors/crisis-detection-engine';
import { assessEmotionalState } from './detectors/emotional-intelligence-engine';
import { detectDistortions } from './detectors/cognitive-distortion-engine';
import { assessFutureVisibility } from './detectors/future-visibility-engine';
import { applyRealismGuard } from './engines/realism-guard';
import { reviewTrajectory } from './engines/trajectory-review-engine';
import { scoreFuturePreservation } from './engines/future-preservation-engine';
import { detectRedirectionPattern } from './redirection/constructive-redirection-engine';

import { CONSTITUTIONAL_REVIEW_ORDER, RISK_RANK } from '@/types/constitutional';
import { reviewCharacter } from '@/lib/constitutional/character';
import { SEVERITY_RANK } from '@/types/governance';
import type {
  ConstitutionalDecision,
  ConstitutionalPrincipleId,
  ConstitutionalVerdict,
  ReviewStep,
} from '@/types/constitutional';
import type { GovernanceDecision, GovernanceSubject } from '@/types/governance';

// ---------------------------------------------------------------------------
// Hashing — djb2 reused for cross-version stability.
// ---------------------------------------------------------------------------

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Constitutional review — pure function
// ---------------------------------------------------------------------------

export interface ConstitutionalReviewInputs {
  /** The user's incoming request — used for emotional / crisis assessment. */
  user_input_text?: string;
  /** The drafted response under review. */
  draft_text: string;
  /** Optional subject envelope from Sprint L. */
  subject?: GovernanceSubject;
  /** Frozen now for tests. */
  now?: string;
  /** Whether constitutional graph retrieval succeeded for this iteration. */
  retrieval_ok?: boolean;
  /** Latency carry-through for the audit log. */
  latency_ms?: number;
}

function subjectFromInputs(inputs: ConstitutionalReviewInputs): GovernanceSubject {
  if (inputs.subject) {
    return { ...inputs.subject, text: inputs.draft_text };
  }
  return {
    kind: 'recommendation',
    text: inputs.draft_text,
  };
}

/**
 * Map a Sprint-L verdict to a step pass/fail tuple for the
 * constitutional layer.
 */
function evaluateHardConstraints(decision: GovernanceDecision): {
  failed_step?: ReviewStep;
  severity: GovernanceDecision['severity'];
} {
  // Walk Sprint L violations and find the worst category mapping into
  // the constitutional review order. Order matters: lawfulness > safety
  // > harm > ...
  for (const v of decision.violations) {
    if (v.severity !== 'high' && v.severity !== 'critical') continue;
    if (v.category === 'illegal_activity' || v.category === 'fraud')
      return { failed_step: 'lawfulness', severity: v.severity };
    if (v.category === 'self_harm') return { failed_step: 'safety', severity: v.severity };
    if (v.category === 'harm_to_others' || v.category === 'exploitation')
      return { failed_step: 'harm_prevention', severity: v.severity };
    if (v.category === 'political_influence')
      return { failed_step: 'political_neutrality', severity: v.severity };
    if (v.category === 'partner_bias' || v.category === 'conflict_of_interest')
      return { failed_step: 'conflict_of_interest', severity: v.severity };
    if (v.category === 'unsafe_health' || v.category === 'unverified_medical')
      return { failed_step: 'safety', severity: v.severity };
    if (v.category === 'manipulation' || v.category === 'coercive_messaging')
      return { failed_step: 'user_autonomy', severity: v.severity };
    if (v.category === 'outcome_integrity' || v.category === 'user_advocacy')
      return { failed_step: 'ethical_compliance', severity: v.severity };
  }
  return { severity: decision.severity };
}

/**
 * The core orchestrator. Computes every signal in order, returns a
 * complete ConstitutionalDecision.
 */
export function constitutionalReview(inputs: ConstitutionalReviewInputs): ConstitutionalDecision {
  // Fail-closed: retrieval_ok=false → REQUEST_CLARIFICATION immediately.
  // We still run the cheap pure checks to populate the audit row.
  const retrievalOk = inputs.retrieval_ok !== false;

  // 1+2+3+6+7+8+9 — Sprint L governance covers Lawfulness, Safety,
  // Harm Prevention, Ethical Compliance, Political Neutrality, COI,
  // and User Autonomy.
  const subject = subjectFromInputs(inputs);
  const governance = sprintLEvaluate(subject, { now: inputs.now });
  const hardConstraints = evaluateHardConstraints(governance);

  // 4 — Crisis on user input (NOT on the draft — we want to detect a
  // user who is in crisis, not punish a draft that contains a crisis
  // reference).
  const crisis = assessCrisis(inputs.user_input_text ?? '');

  // 5 — Emotional intelligence review (also on user input).
  const emotional = assessEmotionalState(inputs.user_input_text ?? '');

  // Cognitive distortion detection — runs across BOTH inputs.
  const distortions = detectDistortions(`${inputs.user_input_text ?? ''}\n${inputs.draft_text}`);

  // RealismGuard — runs on the draft.
  const realism = applyRealismGuard(inputs.draft_text);

  // TrajectoryReviewEngine — uses both texts + the emotional read.
  const trajectory = reviewTrajectory({
    draft_text: inputs.draft_text,
    user_input_text: inputs.user_input_text,
    emotional,
  });

  // 10 — Future Preservation.
  const future_preservation = scoreFuturePreservation({
    draft_text: inputs.draft_text,
    user_input_text: inputs.user_input_text,
  });

  // 11 — Future Visibility (heuristic on user input).
  const future_visibility = assessFutureVisibility(inputs.user_input_text ?? '');

  // Constructive Redirection — checks against user input first, then draft.
  const redirection =
    detectRedirectionPattern({ text: inputs.user_input_text ?? '' }) ??
    detectRedirectionPattern({ text: inputs.draft_text });

  // Constitutional principle violations beyond Sprint L (9-15).
  const principle_violations: ConstitutionalDecision['principle_violations'] = [];
  if (emotional.risk_level === 'HIGH' || emotional.risk_level === 'CRITICAL') {
    principle_violations.push({
      principle: 'cognitive_decompression',
      reason:
        'Emotional intensity is elevated; cognitive decompression is required before goal optimization.',
      severity: emotional.risk_level === 'CRITICAL' ? 'critical' : 'high',
    });
  }
  if (crisis.escalation_recommended) {
    principle_violations.push({
      principle: 'human_support_escalation',
      reason: 'Crisis signal detected; human support escalation is required.',
      severity: crisis.level === 'CRITICAL' ? 'critical' : 'high',
    });
  }
  if (future_visibility.needs_expansion) {
    principle_violations.push({
      principle: 'future_visibility',
      reason: 'Future-collapse framing detected; expansion required.',
      severity: 'medium',
    });
  }
  for (const d of distortions) {
    principle_violations.push({
      principle: 'emotional_recognition_without_reinforcement',
      reason: `Cognitive distortion (${d.kind}) should not be reinforced.`,
      severity: d.intensity === 'high' ? 'high' : d.intensity === 'moderate' ? 'medium' : 'low',
    });
  }
  if (trajectory.needs_decompression) {
    principle_violations.push({
      principle: 'cognitive_decompression',
      reason: 'Trajectory concerns combined with elevated emotional risk — slow the decision.',
      severity: 'high',
    });
  }
  if (future_preservation.destructive_axes.length > 0) {
    principle_violations.push({
      principle: 'future_preservation',
      reason: `Action reduces preservation on: ${future_preservation.destructive_axes.join(', ')}.`,
      severity: 'medium',
    });
  }

  // Steps passed walk-through.
  const steps_passed: ReviewStep[] = [];
  let failed_step: ReviewStep | undefined;

  for (const step of CONSTITUTIONAL_REVIEW_ORDER) {
    // Lawfulness / Safety / Harm / Ethical / Neutrality / COI / Autonomy
    if (
      (step === 'lawfulness' ||
        step === 'safety' ||
        step === 'harm_prevention' ||
        step === 'ethical_compliance' ||
        step === 'political_neutrality' ||
        step === 'conflict_of_interest' ||
        step === 'user_autonomy') &&
      hardConstraints.failed_step === step
    ) {
      failed_step = step;
      break;
    }
    if (step === 'crisis_detection' && crisis.escalation_recommended) {
      failed_step = step;
      break;
    }
    if (
      step === 'emotional_intelligence_review' &&
      (emotional.risk_level === 'HIGH' || emotional.risk_level === 'CRITICAL')
    ) {
      failed_step = step;
      break;
    }
    if (step === 'future_preservation' && future_preservation.destructive_axes.length >= 2) {
      failed_step = step;
      break;
    }
    if (step === 'future_visibility' && future_visibility.needs_expansion) {
      // Future visibility is not blocking by itself but is recorded as a
      // step requiring expansion.
      steps_passed.push(step);
      continue;
    }
    if (step === 'goal_alignment' || step === 'outcome_optimization') {
      // If we made it here, lawfulness + safety + everything else passed.
      // The orchestrator does not itself optimize goals — that's done
      // upstream — but it asserts goal alignment only after the prior
      // steps.
    }
    steps_passed.push(step);
  }

  // Verdict.
  let verdict: ConstitutionalVerdict;
  let final_text = realism.rewritten_text;
  if (!retrievalOk) {
    verdict = 'REQUEST_CLARIFICATION';
    final_text =
      'I need to retrieve a small set of constitutional rules before answering, and that retrieval is currently unavailable. ' +
      'Could you rephrase the question or try again in a moment?';
  } else if (
    hardConstraints.severity === 'critical' ||
    crisis.level === 'CRITICAL' ||
    (failed_step &&
      (failed_step === 'lawfulness' ||
        failed_step === 'safety' ||
        failed_step === 'harm_prevention')) ||
    redirection
  ) {
    verdict = 'CONSTITUTIONAL_REDIRECTION';
    if (redirection) {
      final_text = redirection.framing;
    }
  } else if (failed_step) {
    verdict = 'CONSTITUTIONAL_REDIRECTION';
  } else if (
    realism.findings.length > 0 ||
    future_visibility.needs_expansion ||
    distortions.length > 0 ||
    trajectory.concerns.length > 0
  ) {
    verdict = 'APPROVE_WITH_MODIFICATION';
  } else {
    verdict = 'APPROVE';
  }

  // Final text augmentation for visibility expansion / human-support
  // escalation (deterministic, additive — never deletes).
  if (verdict === 'APPROVE_WITH_MODIFICATION' && future_visibility.needs_expansion) {
    final_text = final_text + '\n\n' + composeVisibilityExpansion(future_visibility);
  }
  if (crisis.escalation_recommended) {
    final_text = composeCrisisEscalation(crisis.level) + '\n\n' + final_text;
  }

  // ---- Sprint N.3 — Character Review (step 8) + Final Character
  //                   Verification (step 14) -------------------------------
  //
  // Runs on the (possibly modified) final_text. If the character
  // score fails the threshold AND the response is still in an APPROVE
  // verdict, we either:
  //   * apply the style-guard sanitized text (for low/moderate-severity
  //     style violations), OR
  //   * downgrade the verdict to APPROVE_WITH_MODIFICATION so callers
  //     know the response was character-modified.
  // Critical character failures combined with a CONSTITUTIONAL_REDIRECTION
  // verdict already produced a constructive-redirection framing
  // upstream; we don't override.
  const character = reviewCharacter({ draft_text: final_text });
  if (
    character.needs_regeneration &&
    (verdict === 'APPROVE' || verdict === 'APPROVE_WITH_MODIFICATION')
  ) {
    // If only low/moderate style findings produced the failure, use
    // the style-sanitized text. Otherwise, mark APPROVE_WITH_MODIFICATION
    // and keep the original text (the orchestrator's redraft loop
    // gets another pass).
    const onlySoftStyle = character.style.findings.every(
      (f) => f.severity === 'low' || f.severity === 'moderate'
    );
    if (onlySoftStyle && character.style.sanitized_text.length > 0) {
      final_text = character.style.sanitized_text;
    } else {
      verdict = 'APPROVE_WITH_MODIFICATION';
    }
  }

  const draft_hash = djb2(inputs.draft_text);
  const final_hash = djb2(final_text);

  return {
    verdict,
    governance,
    emotional,
    crisis,
    distortions,
    realism,
    trajectory,
    future_preservation,
    future_visibility,
    redirection: redirection ?? undefined,
    steps_passed,
    failed_step,
    principle_violations,
    final_text,
    draft_hash,
    final_hash,
    latency_ms: inputs.latency_ms ?? 0,
    retrieval_ok: retrievalOk,
    computed_at: inputs.now ?? '1970-01-01T00:00:00.000Z',
    character,
  };
}

function composeVisibilityExpansion(fv: ReturnType<typeof assessFutureVisibility>): string {
  if (!fv.needs_expansion) return '';
  const lines = fv.options.map((o) => `- ${o.label}: ${o.description}`);
  return (
    'I want to add something that may not feel relevant right now but often turns out to be: ' +
    'current circumstances do not necessarily determine future outcomes. Some paths that other people ' +
    'in similar situations have found useful:\n' +
    lines.join('\n')
  );
}

function composeCrisisEscalation(level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'): string {
  if (level === 'CRITICAL') {
    return (
      'I can hear that this is an extremely hard moment. Please consider contacting a crisis line or local ' +
      'emergency services right now. You do not need to figure this out alone tonight.'
    );
  }
  if (level === 'HIGH') {
    return (
      'I can hear that this is heavy. Talking to a qualified human — a therapist, counselor, physician, or a ' +
      'crisis line — is usually the highest-leverage next step. I will keep helping with the structured side, ' +
      'but I will not try to replace human support here.'
    );
  }
  return '';
}

// ---------------------------------------------------------------------------
// PreStreamGovernanceGuard — the iteration loop
// ---------------------------------------------------------------------------

import type { PreStreamInputs, PreStreamIteration, PreStreamResult } from '@/types/constitutional';

const SAFE_FALLBACK =
  "I can't answer this in the form requested without potentially crossing a constitutional principle. " +
  'If you can share more context about the underlying need, I can help you find a path that preserves your ' +
  'lawful interests and future options.';

function highestSeverityRank(d: ConstitutionalDecision): number {
  return Math.max(
    SEVERITY_RANK[d.governance.severity],
    Math.max(
      ...(d.principle_violations.length
        ? d.principle_violations.map((p) => SEVERITY_RANK[p.severity])
        : [0])
    ),
    RISK_RANK[d.crisis.level]
  );
}

export function preStreamGovernance(inputs: PreStreamInputs): PreStreamResult {
  const max = Math.min(3, inputs.max_iterations ?? 3);
  const iterations: PreStreamIteration[] = [];
  let currentDraft = inputs.draft_text;
  let decision = constitutionalReview({
    user_input_text: inputs.user_input_text,
    draft_text: currentDraft,
    subject: inputs.subject,
    retrieval_ok: inputs.retrieval_ok,
    now: inputs.now,
  });

  for (let i = 0; i < max; i++) {
    iterations.push({
      index: i,
      draft_hash: decision.draft_hash,
      final_hash: decision.final_hash,
      verdict: decision.verdict,
      modifications: collectModifications(decision),
      violations: decision.governance.violations,
      retrieved_rule_ids: collectRetrievedRuleIds(decision),
      retrieval_ok: decision.retrieval_ok,
      latency_ms: decision.latency_ms,
    });

    if (decision.verdict === 'APPROVE') {
      return finalize(iterations, decision, true);
    }
    if (decision.verdict === 'CONSTITUTIONAL_REDIRECTION') {
      return finalize(iterations, decision, true);
    }
    if (decision.verdict === 'REQUEST_CLARIFICATION') {
      return finalize(iterations, decision, true);
    }
    if (decision.verdict === 'APPROVE_WITH_MODIFICATION') {
      const next = inputs.redraft
        ? inputs.redraft(decision.final_text, decision)
        : decision.final_text;
      if (next === currentDraft) {
        // No further modification possible; accept the modified draft.
        return finalize(iterations, decision, true);
      }
      currentDraft = next;
      decision = constitutionalReview({
        user_input_text: inputs.user_input_text,
        draft_text: currentDraft,
        subject: inputs.subject,
        retrieval_ok: inputs.retrieval_ok,
        now: inputs.now,
      });
      continue;
    }
    // Else (SAFE_CONSTITUTIONAL_RESPONSE) — shouldn't happen mid-loop.
    break;
  }

  // Max iterations exhausted — fall back to safe constitutional response.
  const safeDecision: ConstitutionalDecision = {
    ...decision,
    verdict: 'SAFE_CONSTITUTIONAL_RESPONSE',
    final_text: SAFE_FALLBACK,
    final_hash: djb2(SAFE_FALLBACK),
    // Preserve worst severity in the audit.
    principle_violations: decision.principle_violations.concat({
      principle: 'human_support_escalation',
      reason:
        'Maximum review iterations reached without satisfactory approval. Returning Safe Constitutional Response.',
      severity: 'high',
    }),
  };
  // Append a final synthetic iteration so the audit shows the SAFE outcome.
  iterations.push({
    index: iterations.length,
    draft_hash: decision.draft_hash,
    final_hash: safeDecision.final_hash,
    verdict: 'SAFE_CONSTITUTIONAL_RESPONSE',
    modifications: [],
    violations: decision.governance.violations,
    retrieved_rule_ids: [],
    retrieval_ok: decision.retrieval_ok,
    latency_ms: decision.latency_ms,
  });
  return finalize(iterations, safeDecision, true);
}

function collectModifications(d: ConstitutionalDecision) {
  const mods: PreStreamIteration['modifications'] = [];
  for (const f of d.realism.findings) {
    mods.push({
      kind: 'realism',
      reason: f.rule_id,
      before: f.evidence_phrase,
      after: f.rewrite_suggestion,
    });
  }
  for (const c of d.trajectory.concerns) {
    mods.push({ kind: 'trajectory', reason: c.rule_id });
  }
  if (d.future_visibility.needs_expansion) {
    mods.push({ kind: 'future_visibility', reason: 'expanded' });
  }
  for (const a of d.future_preservation.destructive_axes) {
    mods.push({ kind: 'future_preservation', reason: `destructive_${a}` });
  }
  return mods;
}

function collectRetrievedRuleIds(d: ConstitutionalDecision): string[] {
  const ids = new Set<string>();
  for (const v of d.governance.violations) ids.add(v.rule_id);
  for (const f of d.realism.findings) ids.add(f.rule_id);
  for (const c of d.trajectory.concerns) ids.add(c.rule_id);
  for (const s of d.crisis.signals) ids.add(`crisis.${s.kind}`);
  for (const dist of d.distortions) ids.add(`cog.${dist.kind}`);
  return Array.from(ids).sort();
}

function finalize(
  iterations: PreStreamIteration[],
  decision: ConstitutionalDecision,
  ok_to_stream: boolean
): PreStreamResult {
  return {
    iterations,
    final_verdict: decision.verdict,
    final_text: decision.final_text,
    final_decision: decision,
    ok_to_stream,
  };
}

export const __test = {
  constitutionalReview,
  preStreamGovernance,
  djb2,
  collectModifications,
  collectRetrievedRuleIds,
  evaluateHardConstraints,
  SAFE_FALLBACK,
};
