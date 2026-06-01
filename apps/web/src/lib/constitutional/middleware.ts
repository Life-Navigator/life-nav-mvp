/**
 * Constitutional middleware — wires Sprint L2's
 * ConstitutionalGovernanceEngine to the audit tables.
 *
 *   1. Run preStreamGovernance.
 *   2. Insert the parent audit row (decision_governance_audit) with
 *      the extended Sprint L2 columns.
 *   3. Insert one governance.review_iterations row per iteration.
 *   4. Return the PreStreamResult unchanged.
 *
 * Persistence is best-effort but raises on failure so callers never
 * silently ship a response that wasn't logged.
 */

import { preStreamGovernance } from './constitutional-governance-engine';
import { retrieveConstitutionalRuleSet } from './retrieval';
import type { PreStreamInputs, PreStreamResult } from '@/types/constitutional';

export interface PersistInputs extends PreStreamInputs {
  supabase: any;
  user_id: string;
}

export async function reviewAndPersist(inputs: PersistInputs): Promise<PreStreamResult> {
  // Sprint M Phase 3: live constitutional retrieval. The orchestrator
  // requires retrieval_ok to be truthful — fail closed if the DB call
  // errors or returns an empty rule set.
  let retrieval_ok = inputs.retrieval_ok;
  let retrieved_rule_ids: string[] | undefined;
  let rule_set_version: string | undefined;
  if (typeof retrieval_ok !== 'boolean') {
    const r = await retrieveConstitutionalRuleSet({
      supabase: inputs.supabase,
      record_meter: true,
    });
    retrieval_ok = r.ok;
    retrieved_rule_ids = r.retrieved?.retrieved_rule_ids;
    rule_set_version = r.retrieved?.rule_set_version;
  }

  const result = preStreamGovernance({ ...inputs, retrieval_ok });
  const decision = result.final_decision;

  const auditRow = {
    user_id: inputs.user_id,
    subject_kind: inputs.subject?.kind ?? 'recommendation',
    subject_id: inputs.subject?.id ?? null,
    subject_table: inputs.subject?.table ?? null,
    emitter_agent_kind: null,
    emitter_agent_id: null,
    emitter_user_id: null,
    approved: decision.verdict === 'APPROVE' || decision.verdict === 'APPROVE_WITH_MODIFICATION',
    severity: decision.governance.severity,
    governance_version: decision.governance.governance_version,
    policy_checks: decision.governance.policy_checks,
    violations: decision.governance.violations,
    safer_alternatives: decision.governance.safer_alternatives,
    input_hash: decision.governance.input_hash,

    // Sprint L2 extension columns
    constitutional_verdict: decision.verdict,
    risk_level:
      decision.crisis.level === 'CRITICAL'
        ? 'CRITICAL'
        : decision.crisis.level === 'HIGH'
          ? 'HIGH'
          : decision.emotional.risk_level === 'CRITICAL'
            ? 'CRITICAL'
            : decision.emotional.risk_level === 'HIGH'
              ? 'HIGH'
              : decision.emotional.risk_level === 'MODERATE'
                ? 'MODERATE'
                : 'LOW',
    iteration_count: result.iterations.length,
    total_latency_ms: result.iterations.reduce((s, i) => s + (i.latency_ms ?? 0), 0),
    draft_hash: result.iterations[0]?.draft_hash ?? decision.draft_hash,
    final_hash: decision.final_hash,
    retrieval_ok: decision.retrieval_ok,
    metadata: {
      retrieved_rule_count: retrieved_rule_ids?.length ?? null,
      rule_set_version: rule_set_version ?? null,
    },
  };

  const auditRes = await inputs.supabase
    .from('decision_governance_audit')
    .insert(auditRow)
    .select('id')
    .single();
  if (auditRes.error) {
    throw new Error(`constitutional audit insert failed: ${auditRes.error.message}`);
  }
  const audit_id = auditRes.data.id as string;

  // Iterations
  const iterRows = result.iterations.map((it) => ({
    audit_id,
    user_id: inputs.user_id,
    iteration_index: it.index,
    draft_hash: it.draft_hash,
    final_hash: it.final_hash,
    retrieved_rule_ids: it.retrieved_rule_ids,
    violations: it.violations,
    modifications: it.modifications,
    verdict: it.verdict,
    latency_ms: it.latency_ms,
    retrieval_ok: it.retrieval_ok,
  }));
  if (iterRows.length > 0) {
    const iterRes = await inputs.supabase.from('governance_review_iterations').insert(iterRows);
    if (iterRes.error) {
      throw new Error(`constitutional iteration insert failed: ${iterRes.error.message}`);
    }
  }

  return result;
}
