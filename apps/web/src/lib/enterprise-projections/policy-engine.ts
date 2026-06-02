/**
 * Enterprise Policy Engine — Sprint S Phase 5.
 *
 * Evaluates per-tenant organization policies (approved / prohibited /
 * escalate / requires_compliance_review) against a candidate subject.
 *
 * Composes WITH (never replaces) Sprint L + L2 + N.3 governance. The
 * platform constitution and character layer fire first; this engine
 * adds the tenant-specific overlay.
 *
 * Hard contract:
 *   * 'prohibited' BLOCKS the response regardless of governance verdict.
 *   * 'escalate' allows the response but flags it for review.
 *   * 'requires_compliance_review' allows the response but tags it
 *     with the compliance note.
 *   * 'approved' is an explicit allow-listing; ties broken by priority.
 *
 * Decisions are audited via `projections.policy_decisions`.
 */

import type { OrganizationPolicy, PolicyOutcome } from './types';

export interface PolicyEvalInputs {
  policies: OrganizationPolicy[];
  /** Subject kind (e.g. 'recommendation.optimizer'). */
  subject_kind: string;
  /** Subject text used for match_pattern eval. */
  subject_text: string;
}

export interface PolicyEvalResult {
  outcome: PolicyOutcome | 'allow';
  policy_key?: string;
  reason?: string;
  escalation_to?: string;
  compliance_note?: string;
  /** All matched policies, ordered by priority (lowest first). */
  matched: OrganizationPolicy[];
}

const OUTCOME_PRIORITY: Record<PolicyOutcome | 'allow', number> = {
  prohibited: 0, // strictest
  requires_compliance_review: 1,
  escalate: 2,
  approved: 3, // permissive
  allow: 4, // default
};

/**
 * Pure evaluator. Returns the strictest matching outcome.
 */
export function evaluatePolicies(inputs: PolicyEvalInputs): PolicyEvalResult {
  const matched: OrganizationPolicy[] = [];
  for (const p of inputs.policies) {
    if (!p.active) continue;
    if (!appliesTo(p, inputs.subject_kind)) continue;
    if (p.match_pattern && !subjectMatches(p.match_pattern, inputs.subject_text)) continue;
    matched.push(p);
  }
  // Sort by priority ASC (lowest number first) for deterministic
  // tie-breaking; then by outcome strictness.
  matched.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return OUTCOME_PRIORITY[a.outcome] - OUTCOME_PRIORITY[b.outcome];
  });
  if (matched.length === 0) {
    return { outcome: 'allow', matched: [] };
  }

  // Find the strictest matching policy.
  let strictest = matched[0];
  for (const p of matched) {
    if (OUTCOME_PRIORITY[p.outcome] < OUTCOME_PRIORITY[strictest.outcome]) {
      strictest = p;
    }
  }
  return {
    outcome: strictest.outcome,
    policy_key: strictest.policy_key,
    reason: strictest.display_name,
    escalation_to: strictest.escalation_to,
    compliance_note: strictest.compliance_note,
    matched,
  };
}

function appliesTo(p: OrganizationPolicy, subject_kind: string): boolean {
  if (p.applies_to.length === 0) return true; // wildcard
  return p.applies_to.includes(subject_kind) || p.applies_to.includes('*');
}

function subjectMatches(pattern: string, text: string): boolean {
  try {
    const re = new RegExp(pattern, 'i');
    return re.test(text);
  } catch {
    // Invalid regex — treat as literal substring match (fail-safe).
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
}

/**
 * Best-effort audit-row writer. Caller passes the supabase client; we
 * never throw if the insert fails.
 */
export async function recordPolicyDecision(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  inputs: {
    tenant_id: string;
    user_id?: string;
    subject_kind: string;
    subject_id?: string;
    governance_audit_id?: string;
    result: PolicyEvalResult;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('projections_policy_decisions').insert({
      tenant_id: inputs.tenant_id,
      user_id: inputs.user_id ?? null,
      subject_kind: inputs.subject_kind,
      subject_id: inputs.subject_id ?? null,
      governance_audit_id: inputs.governance_audit_id ?? null,
      policy_key: inputs.result.policy_key ?? null,
      outcome: inputs.result.outcome,
      reason: inputs.result.reason ?? null,
      escalated_to: inputs.result.escalation_to ?? null,
      metadata: inputs.metadata ?? {},
    });
  } catch {
    /* best-effort */
  }
}

export const __test = { appliesTo, subjectMatches };
