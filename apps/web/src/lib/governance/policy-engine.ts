/**
 * GovernancePolicyEngine — Sprint L Phase 2 core.
 *
 * Composes every validator + the conflict-of-interest engine into a
 * single `evaluate()` call returning a deterministic GovernanceDecision.
 *
 *   Critical violation       → blocked (no override)
 *   High violation           → blocked (overridable by user-as-actor)
 *   Medium violation         → approved_with_warnings
 *   Low (transparency only)  → approved_with_warnings
 *   None                     → approved
 *
 * Determinism contract: identical subject + identical governance
 * version → byte-identical decision (modulo `computed_at` when not
 * explicitly frozen by the caller).
 */

import { detectConflictsOfInterest } from './conflict-of-interest-engine';
import { validatePoliticalInfluence } from './validators/political-influence';
import { validateManipulation } from './validators/manipulation';
import { validateSelfHarm } from './validators/self-harm';
import { validateHarmToOthers } from './validators/harm-to-others';
import { validateIllegalActivity } from './validators/illegal-activity';
import { validateFraud } from './validators/fraud';
import { validateExploitation } from './validators/exploitation';
import { validatePartnerBias } from './validators/partner-bias';
import { validateUnsafeHealth } from './validators/unsafe-health';
import { validateUnverifiedMedical } from './validators/unverified-medical';
import { validateCoerciveMessaging } from './validators/coercive-messaging';
import { validateTransparency } from './validators/transparency';
import { validateOutcomeIntegrity } from './validators/outcome-integrity';
import { validateUserAdvocacy } from './validators/user-advocacy';

import { GOVERNANCE_VERSION, SEVERITY_RANK } from '@/types/governance';
import type {
  GovernanceDecision,
  GovernanceSeverity,
  GovernanceSubject,
  GovernanceVerdict,
  GovernanceViolation,
  PolicyCheckRecord,
  SaferAlternative,
  ViolationCategory,
} from '@/types/governance';

// ---------------------------------------------------------------------------
// Validator catalog — single source of truth for the engine
// ---------------------------------------------------------------------------

const VALIDATORS: Array<{
  category: ViolationCategory;
  fn: (s: GovernanceSubject) => GovernanceViolation[];
  rules: string[];
}> = [
  {
    category: 'political_influence',
    fn: validatePoliticalInfluence,
    rules: ['pol.advocacy_verb', 'pol.ideology_persuasion', 'pol.influence_campaign'],
  },
  {
    category: 'manipulation',
    fn: validateManipulation,
    rules: ['manip.pressure_tactic', 'manip.shame', 'manip.guilt', 'manip.fomo'],
  },
  {
    category: 'self_harm',
    fn: validateSelfHarm,
    rules: ['sh.encourage', 'sh.disordered_eating', 'sh.substance_abuse'],
  },
  {
    category: 'harm_to_others',
    fn: validateHarmToOthers,
    rules: ['hto.violence', 'hto.stalking', 'hto.harassment', 'hto.coercion', 'hto.revenge'],
  },
  {
    category: 'illegal_activity',
    fn: validateIllegalActivity,
    rules: [
      'illegal.criminal_verb',
      'illegal.regulatory_avoidance',
      'illegal.operations',
      'illegal.controlled_substances',
    ],
  },
  {
    category: 'fraud',
    fn: validateFraud,
    rules: [
      'fraud.tax_evasion',
      'fraud.application',
      'fraud.concealment',
      'fraud.insurance',
      'fraud.identity',
    ],
  },
  {
    category: 'exploitation',
    fn: validateExploitation,
    rules: [
      'expl.predatory_targeting',
      'expl.scam_pattern',
      'expl.asymmetric_harm',
      'expl.abuse_of_power',
    ],
  },
  {
    category: 'partner_bias',
    fn: validatePartnerBias,
    rules: ['pb.ranking_by_payment', 'pb.partner_economics_present', 'pb.ranking_override'],
  },
  {
    category: 'unsafe_health',
    fn: validateUnsafeHealth,
    rules: [
      'unsafe.stop_medication',
      'unsafe.alter_dose',
      'unsafe.self_diagnosis',
      'unsafe.delay_care',
      'unsafe.dosing_claim',
    ],
  },
  {
    category: 'unverified_medical',
    fn: validateUnverifiedMedical,
    rules: [
      'umed.uncited_claim',
      'umed.absolute_efficacy',
      'umed.hormone_substitute',
      'umed.miracle_framing',
    ],
  },
  {
    category: 'coercive_messaging',
    fn: validateCoerciveMessaging,
    rules: [
      'coer.imperative',
      'coer.consequence_threat',
      'coer.pseudo_authority',
      'coer.shame_threat',
    ],
  },
  {
    category: 'transparency',
    fn: validateTransparency,
    rules: [
      'trans.no_citations',
      'trans.no_assumptions',
      'trans.no_confidence',
      'trans.no_tradeoffs',
      'trans.no_risks',
    ],
  },
  {
    category: 'outcome_integrity',
    fn: validateOutcomeIntegrity,
    rules: ['oint.engagement_bait', 'oint.retention_bait', 'oint.click_bait'],
  },
  {
    category: 'user_advocacy',
    fn: validateUserAdvocacy,
    rules: ['adv.non_user_beneficiary', 'adv.optimized_for_third_party', 'adv.hidden_beneficiary'],
  },
];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface EvaluateOptions {
  /** Frozen timestamp for deterministic tests. */
  now?: string;
  /** Override the governance version (rare; only for testing). */
  governance_version?: string;
}

function highestSeverity(violations: GovernanceViolation[]): GovernanceSeverity {
  let top: GovernanceSeverity = 'none';
  for (const v of violations) {
    if (SEVERITY_RANK[v.severity] > SEVERITY_RANK[top]) top = v.severity;
  }
  return top;
}

function verdictFromSeverity(s: GovernanceSeverity): GovernanceVerdict {
  if (s === 'critical' || s === 'high') return 'blocked';
  if (s === 'medium' || s === 'low') return 'approved_with_warnings';
  return 'approved';
}

function dedupeSaferAlternatives(list: SaferAlternative[]): SaferAlternative[] {
  const seen = new Set<string>();
  const out: SaferAlternative[] = [];
  for (const a of list) {
    const k = `${a.label}::${a.description ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/**
 * Deterministic hash of the subject relevant for replay verification.
 * We do not use cryptographic randomness; a stable djb2-style hash is
 * enough for the audit log (the SQL layer is the source of truth).
 */
function inputHash(subject: GovernanceSubject, version: string): string {
  const canonical = JSON.stringify({
    v: version,
    k: subject.kind,
    t: (subject.text ?? '').trim(),
    a: subject.action ?? null,
    c: subject.citations ?? [],
    s: subject.assumptions ?? [],
    r: subject.risks ?? [],
    f: subject.confidence ?? null,
    o: subject.tradeoffs ?? [],
    m: subject.metadata ?? {},
  });
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = ((h << 5) + h) ^ canonical.charCodeAt(i);
    h |= 0;
  }
  // Print as unsigned hex.
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function evaluate(
  subject: GovernanceSubject,
  options: EvaluateOptions = {}
): GovernanceDecision {
  const version = options.governance_version ?? GOVERNANCE_VERSION;
  const violations: GovernanceViolation[] = [];
  const policy_checks: PolicyCheckRecord[] = [];

  for (const v of VALIDATORS) {
    const found = v.fn(subject);
    violations.push(...found);
    policy_checks.push({
      category: v.category,
      rules_evaluated: v.rules,
      violations: found.length,
      highest_severity: highestSeverity(found),
    });
  }

  // Conflict-of-interest engine — sub-category of partner-bias but
  // looks at distinct keys; its violations are tagged with the
  // separate 'conflict_of_interest' category.
  const coi = detectConflictsOfInterest(subject);
  violations.push(...coi.violations);
  policy_checks.push({
    category: 'conflict_of_interest',
    rules_evaluated: coi.violations.map((v) => v.rule_id),
    violations: coi.violations.length,
    highest_severity: coi.highest_severity,
  });

  // Stable order for byte-identical output: by severity DESC then by
  // rule_id ASC.
  violations.sort((a, b) => {
    const ds = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (ds !== 0) return ds;
    return a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0;
  });

  const severity = highestSeverity(violations);
  const verdict = verdictFromSeverity(severity);
  const approved = verdict !== 'blocked';

  const safer_alternatives = dedupeSaferAlternatives(
    violations.flatMap((v) => v.safer_alternatives ?? [])
  );

  return {
    approved,
    verdict,
    severity,
    governance_version: version,
    violations,
    policy_checks,
    safer_alternatives,
    input_hash: inputHash(subject, version),
    computed_at: options.now ?? '1970-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Agent registry guard — Phase 10
// ---------------------------------------------------------------------------

export interface AgentRegisteredCheck {
  agent_kind?: string;
  agent_name?: string;
  is_registered: boolean;
}

/**
 * If the subject was emitted by an agent (kind+name supplied), the
 * engine asserts the agent appears in `registered`. Failure adds an
 * `agent_not_registered` violation at HIGH severity (blocking but not
 * critical — sysadmin override possible).
 */
export function evaluateWithAgent(
  subject: GovernanceSubject,
  emitter: { agent_kind?: string; agent_name?: string; is_registered?: boolean },
  options: EvaluateOptions = {}
): GovernanceDecision {
  const decision = evaluate(subject, options);
  if (emitter.agent_kind && emitter.agent_name && emitter.is_registered === false) {
    const v: GovernanceViolation = {
      category: 'agent_not_registered',
      severity: 'high',
      rule_id: 'agent.not_registered',
      reason:
        'Subject was emitted by an agent that is not registered in governance.agent_registry.',
      principle: 'outcome_integrity',
    };
    const violations = [...decision.violations, v];
    const severity = highestSeverity(violations);
    return {
      ...decision,
      violations,
      severity,
      verdict: verdictFromSeverity(severity),
      approved: verdictFromSeverity(severity) !== 'blocked',
      policy_checks: [
        ...decision.policy_checks,
        {
          category: 'agent_not_registered',
          rules_evaluated: ['agent.not_registered'],
          violations: 1,
          highest_severity: 'high',
        },
      ],
    };
  }
  return decision;
}

export const __test = {
  evaluate,
  evaluateWithAgent,
  inputHash,
  highestSeverity,
  verdictFromSeverity,
  dedupeSaferAlternatives,
  VALIDATORS,
};
