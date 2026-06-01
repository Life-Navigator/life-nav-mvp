/**
 * Decision Governance types — Sprint L.
 *
 * The Decision Governance Engine (DGE) sits between recommendation
 * generation and recommendation delivery. Every recommendation passes
 * through here.
 *
 *   Advisor → Decision Intel → Probability → Recommendation → DGE → XAI → User
 *
 * No bypasses.
 *
 * All types here are pure value objects. The engine and validators
 * are pure functions over these shapes.
 */

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type GovernanceSeverity =
  | 'none' // no violations
  | 'low' // annotate, still ship
  | 'medium' // ship with warning
  | 'high' // blocked (overridable by user-as-actor)
  | 'critical'; // blocked, no override

export const SEVERITY_RANK: Record<GovernanceSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ---------------------------------------------------------------------------
// Violation taxonomy — matches governance.is_violation_category in SQL
// ---------------------------------------------------------------------------

export type ViolationCategory =
  | 'political_influence'
  | 'manipulation'
  | 'self_harm'
  | 'harm_to_others'
  | 'illegal_activity'
  | 'fraud'
  | 'exploitation'
  | 'partner_bias'
  | 'conflict_of_interest'
  | 'unsafe_health'
  | 'unverified_medical'
  | 'coercive_messaging'
  | 'outcome_integrity'
  | 'user_advocacy'
  | 'transparency'
  | 'agent_not_registered'
  | 'unknown';

export const ALL_CATEGORIES: ViolationCategory[] = [
  'political_influence',
  'manipulation',
  'self_harm',
  'harm_to_others',
  'illegal_activity',
  'fraud',
  'exploitation',
  'partner_bias',
  'conflict_of_interest',
  'unsafe_health',
  'unverified_medical',
  'coercive_messaging',
  'outcome_integrity',
  'user_advocacy',
  'transparency',
  'agent_not_registered',
];

// ---------------------------------------------------------------------------
// Principles
// ---------------------------------------------------------------------------

export type PrincipleId =
  | 'user_advocacy'
  | 'political_neutrality'
  | 'legal_compliance'
  | 'no_harm'
  | 'human_autonomy'
  | 'transparency'
  | 'no_partner_bias'
  | 'outcome_integrity';

export interface Principle {
  id: PrincipleId;
  name: string;
  body: string;
}

/**
 * IMMUTABLE — the 8 principles. Code that mutates this array breaks
 * the audit contract. Frozen at module load.
 */
export const PRINCIPLES: ReadonlyArray<Principle> = Object.freeze([
  {
    id: 'user_advocacy',
    name: 'User Advocacy',
    body: 'Optimize for user well-being, user goals, user autonomy. Never optimize for government, employer, advertiser, partner, provider, or vendor unless explicitly requested by the user.',
  },
  {
    id: 'political_neutrality',
    name: 'Political Neutrality',
    body: 'Explain and compare; do not advocate parties, candidates, or ideologies. No persuasion, manipulation, or influence campaigns.',
  },
  {
    id: 'legal_compliance',
    name: 'Legal Compliance',
    body: 'Pursue maximum lawful advantage. Allowed: tax planning, legal optimization, benefits, retirement, estate. Not allowed: fraud, evasion, concealment, regulatory avoidance, criminal activity.',
  },
  {
    id: 'no_harm',
    name: 'No Harm',
    body: 'Do not encourage self-harm, violence, abuse, harassment, stalking, coercion, revenge, exploitation, or dangerous illegal activity. Redirect to safer alternatives.',
  },
  {
    id: 'human_autonomy',
    name: 'Human Autonomy',
    body: 'Advise, do not decide. Explain, model, compare, forecast. Never pressure, shame, guilt, or manipulate. The user remains the decision maker.',
  },
  {
    id: 'transparency',
    name: 'Transparency',
    body: 'Every recommendation must expose assumptions, confidence, evidence, uncertainty, and tradeoffs.',
  },
  {
    id: 'no_partner_bias',
    name: 'No Partner Bias',
    body: 'Partners may never influence recommendation ranking, goal scoring, probability outputs, or outcome scoring. Partner economics may not influence recommendations.',
  },
  {
    id: 'outcome_integrity',
    name: 'Outcome Integrity',
    body: 'Never optimize engagement, clicks, or retention at the expense of user outcomes.',
  },
] as const);

export const GOVERNANCE_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Subject of governance — what is being validated
// ---------------------------------------------------------------------------

export type SubjectKind =
  | 'recommendation' // generic recommendation
  | 'provider_recommendation' // Sprint I provider rec
  | 'arcana_recommendation' // Sprint C arcana
  | 'advisor_message' // advisor agent message
  | 'simulation_output' // life trajectory sim
  | 'probability_output' // Sprint F distribution
  | 'optimizer_recommendation' // dynamic optimizer rec
  | 'partner_recommendation' // partner-emitted rec
  | 'agent_message' // generic multi-agent message
  | 'generic';

export interface SubjectEmitter {
  /** The agent_kind from the governance.agent_registry. */
  agent_kind?: string;
  /** The agent_name from the governance.agent_registry. */
  agent_name?: string;
  /** The auth user id of a human emitter (provider portal etc.). */
  user_id?: string;
}

export interface GovernanceSubject {
  kind: SubjectKind;
  /** Optional id of the persisted subject row. */
  id?: string;
  /** Optional schema-qualified table name. */
  table?: string;

  /** Free-text payload the validators read. */
  text: string;
  /** The structured action the recommendation proposes (optional). */
  action?: string;
  /** Citations + evidence as carried by the existing recommendation envelope. */
  citations?: Array<{ label: string; source?: string; citation_reference?: string }>;
  /** Assumptions the existing pipeline surfaced. */
  assumptions?: string[];
  /** Risks the existing pipeline surfaced. */
  risks?: string[];
  /** Confidence in [0,1] from the upstream engine. */
  confidence?: number;
  /** Tradeoff entries the upstream engine attached. */
  tradeoffs?: Array<{ summary: string; gives_up?: string; gains?: string }>;
  /** Free-form structured metadata (partner payments, sponsor, etc.). */
  metadata?: Record<string, unknown>;
  /** Optional reference to the user the subject is bound for. */
  user_id?: string;
}

// ---------------------------------------------------------------------------
// Violation + Decision
// ---------------------------------------------------------------------------

export interface SaferAlternative {
  label: string;
  description?: string;
}

export interface GovernanceViolation {
  category: ViolationCategory;
  severity: GovernanceSeverity;
  /** Short machine-stable identifier for the violation pattern. */
  rule_id: string;
  /** Human-readable reason in plain language. */
  reason: string;
  /** Optional fragment of the subject that triggered the rule. */
  evidence?: string;
  /** Safer alternatives surfaced for the user. */
  safer_alternatives?: SaferAlternative[];
  /** Principle the violation maps to. */
  principle: PrincipleId;
}

export interface PolicyCheckRecord {
  category: ViolationCategory;
  /** Each validator emits one or more rules; the engine records the result. */
  rules_evaluated: string[];
  violations: number;
  highest_severity: GovernanceSeverity;
}

export type GovernanceVerdict = 'approved' | 'approved_with_warnings' | 'blocked';

export interface GovernanceDecision {
  approved: boolean;
  verdict: GovernanceVerdict;
  severity: GovernanceSeverity;
  governance_version: string;
  violations: GovernanceViolation[];
  policy_checks: PolicyCheckRecord[];
  safer_alternatives: SaferAlternative[];
  /** Deterministic hash of subject + version. */
  input_hash: string;
  /** When the engine produced the decision. Frozen in tests for determinism. */
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Agent registry contract
// ---------------------------------------------------------------------------

export interface AgentRegistration {
  agent_kind: string;
  agent_name: string;
  description?: string;
  responsible_team?: string;
  active: boolean;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// Audit envelope passed to the DB
// ---------------------------------------------------------------------------

export interface GovernanceAuditEnvelope {
  user_id: string;
  subject_kind: SubjectKind;
  subject_id?: string | null;
  subject_table?: string | null;
  emitter_agent_kind?: string | null;
  emitter_agent_id?: string | null;
  emitter_user_id?: string | null;
  approved: boolean;
  severity: GovernanceSeverity;
  governance_version: string;
  policy_checks: PolicyCheckRecord[];
  violations: GovernanceViolation[];
  safer_alternatives: SaferAlternative[];
  input_hash?: string;
  metadata?: Record<string, unknown>;
}
