/**
 * Recommendation Validation Middleware (Sprint L Phase 4).
 *
 * Every code path that produces a recommendation should call
 * `validateAndPersist` BEFORE delivering to the user. The middleware:
 *
 *   1. Runs `evaluateWithAgent` over the subject + emitter.
 *   2. Persists the audit row (best-effort; failures do not silently
 *      pass — they raise).
 *   3. Returns the decision so the caller can render block / warning /
 *      approval UX.
 *
 * Determinism: the decision is computed first. The audit insert is
 * post-decision and never feeds back into the verdict.
 */

import { evaluateWithAgent } from './policy-engine';
import { isAgentRegistered } from './agent-registry';
import type {
  AgentRegistration,
  GovernanceAuditEnvelope,
  GovernanceDecision,
  GovernanceSubject,
  SubjectEmitter,
} from '@/types/governance';

// ---------------------------------------------------------------------------
// In-memory cache of the agent registry to avoid a DB roundtrip on
// every recommendation. Refreshed by the API route.
// ---------------------------------------------------------------------------

let agentRegistryCache: AgentRegistration[] = [];
let agentRegistryCacheAt: number | null = null;
const AGENT_REGISTRY_TTL_MS = 60 * 1000;

export function primeAgentRegistry(rows: AgentRegistration[]): void {
  agentRegistryCache = rows;
  agentRegistryCacheAt = Date.now();
}

export function shouldRefreshAgentRegistry(): boolean {
  if (agentRegistryCacheAt == null) return true;
  return Date.now() - agentRegistryCacheAt > AGENT_REGISTRY_TTL_MS;
}

// ---------------------------------------------------------------------------
// Pure: validate without persistence
// ---------------------------------------------------------------------------

export interface ValidateInputs {
  subject: GovernanceSubject;
  emitter?: SubjectEmitter;
  now?: string;
  governance_version?: string;
}

export function validate(inputs: ValidateInputs): GovernanceDecision {
  const e = inputs.emitter ?? {};
  const is_registered =
    e.agent_kind && e.agent_name
      ? isAgentRegistered(agentRegistryCache, e.agent_kind, e.agent_name)
      : true; // human emitter is always treated as registered
  return evaluateWithAgent(
    inputs.subject,
    { agent_kind: e.agent_kind, agent_name: e.agent_name, is_registered },
    { now: inputs.now, governance_version: inputs.governance_version }
  );
}

// ---------------------------------------------------------------------------
// Build the audit row envelope from the decision
// ---------------------------------------------------------------------------

export function buildAuditEnvelope(
  inputs: ValidateInputs,
  decision: GovernanceDecision
): GovernanceAuditEnvelope {
  const e = inputs.emitter ?? {};
  return {
    user_id: inputs.subject.user_id ?? '',
    subject_kind: inputs.subject.kind,
    subject_id: inputs.subject.id ?? null,
    subject_table: inputs.subject.table ?? null,
    emitter_agent_kind: e.agent_kind ?? null,
    emitter_agent_id: null, // set by route if the loader has it
    emitter_user_id: e.user_id ?? null,
    approved: decision.approved,
    severity: decision.severity,
    governance_version: decision.governance_version,
    policy_checks: decision.policy_checks,
    violations: decision.violations,
    safer_alternatives: decision.safer_alternatives,
    input_hash: decision.input_hash,
    metadata: {},
  };
}

// ---------------------------------------------------------------------------
// validateAndPersist — the canonical middleware entry
// ---------------------------------------------------------------------------

export interface PersistInputs extends ValidateInputs {
  supabase: any;
}

export async function validateAndPersist(inputs: PersistInputs): Promise<{
  decision: GovernanceDecision;
  audit_row: GovernanceAuditEnvelope;
}> {
  const decision = validate(inputs);
  const audit_row = buildAuditEnvelope(inputs, decision);

  // Best-effort persistence. Failures here are an environmental issue —
  // we raise so the caller knows the audit is missing and can decide
  // whether to ship the recommendation regardless.
  if (audit_row.user_id) {
    const r = await inputs.supabase.from('decision_governance_audit').insert(audit_row);
    if (r.error) {
      throw new Error(`governance audit insert failed: ${r.error.message}`);
    }
  }

  return { decision, audit_row };
}

export const __test = {
  validate,
  buildAuditEnvelope,
  primeAgentRegistry,
  shouldRefreshAgentRegistry,
};
