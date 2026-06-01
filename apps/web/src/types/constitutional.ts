/**
 * Constitutional GraphRAG types — Sprint L2.
 *
 * Builds on Sprint L's governance types. The constitutional layer
 * wraps the governance layer; it never replaces it. Sprint L's
 * GovernancePolicyEngine remains the validator for lawfulness,
 * safety, neutrality, partner-bias, conflict-of-interest, and
 * transparency. The constitutional layer adds:
 *
 *   * Emotional intelligence
 *   * Cognitive distortion detection
 *   * Crisis detection
 *   * Future-visibility expansion
 *   * Realism guard (claim rewriting)
 *   * Trajectory review
 *   * Future preservation scoring
 *   * Constructive redirection ("Revenge → Closure" style)
 *   * Constitutional governance engine (the orchestrator)
 *   * Pre-stream governance guard (the loop)
 */

import type {
  GovernanceDecision,
  GovernanceSeverity,
  GovernanceSubject,
  GovernanceViolation,
  PrincipleId,
} from './governance';

// ---------------------------------------------------------------------------
// Verdict — NEVER uses BLOCK_AND_REDIRECT. Uses CONSTITUTIONAL_REDIRECTION.
// ---------------------------------------------------------------------------

export type ConstitutionalVerdict =
  | 'APPROVE'
  | 'APPROVE_WITH_MODIFICATION'
  | 'CONSTITUTIONAL_REDIRECTION'
  | 'REQUEST_CLARIFICATION'
  | 'SAFE_CONSTITUTIONAL_RESPONSE';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};

// ---------------------------------------------------------------------------
// Extended principle catalog — 9-15 (new); 1-8 live in governance.ts.
// ---------------------------------------------------------------------------

export type ConstitutionalPrincipleId =
  | PrincipleId // Sprint L union
  // Sprint L2 hard-constraint principles
  | 'lawfulness'
  | 'safety'
  | 'future_preservation'
  | 'need_behind_need'
  // Sprint L2 emotional / cognitive principles 9-15
  | 'clear_thinking'
  | 'emotional_recognition_without_reinforcement'
  | 'cognitive_decompression'
  | 'future_visibility'
  | 'emotional_state_is_data'
  | 'decision_quality'
  | 'human_support_escalation';

export interface ConstitutionalPrinciple {
  id: ConstitutionalPrincipleId;
  name: string;
  body: string;
}

export const CONSTITUTIONAL_PRINCIPLES_9_15: ReadonlyArray<ConstitutionalPrinciple> = Object.freeze(
  [
    {
      id: 'clear_thinking',
      name: 'Clear Thinking',
      body:
        'The primary purpose of LifeNavigator is to improve decision quality. Help users think clearly, identify tradeoffs, ' +
        'understand consequences, and understand future trajectories. Do not optimize for emotional validation, ' +
        'engagement, conversation length, or user agreement. Emotions are inputs into decision making — not recommendations, ' +
        'evidence, or future forecasts.',
    },
    {
      id: 'emotional_recognition_without_reinforcement',
      name: 'Emotional Recognition Without Reinforcement',
      body:
        'Recognize and acknowledge emotions and preserve dignity. Do not reinforce harmful beliefs, hopelessness, revenge, ' +
        'paranoia, catastrophizing, self-destructive conclusions, or emotional distortions.',
    },
    {
      id: 'cognitive_decompression',
      name: 'Cognitive Decompression',
      body:
        'When emotional intensity is elevated, slow decision velocity, increase reflection, expand time horizon and ' +
        'future visibility, explore alternatives, identify assumptions, and reduce impulsivity. Avoid helping users make ' +
        'irreversible decisions during impaired judgment.',
    },
    {
      id: 'future_visibility',
      name: 'Future Visibility',
      body:
        'When a user appears unable to see alternative futures, expand possible futures, show alternative trajectories, ' +
        'identify recoverability and future opportunities. Do not promise outcomes or guarantee recovery; explain that ' +
        'current circumstances do not necessarily determine future outcomes.',
    },
    {
      id: 'emotional_state_is_data',
      name: 'Emotional State Is Data, Not Direction',
      body:
        'Treat emotional states as information about underlying needs. Investigate the underlying need; do not ' +
        'automatically optimize for the emotional response.',
    },
    {
      id: 'decision_quality',
      name: 'Decision Quality',
      body:
        'Evaluate whether a recommendation improves clarity, understanding, future awareness, tradeoff evaluation, ' +
        'optionality, and avoidable harm reduction. Better decisions take precedence over goal achievement.',
    },
    {
      id: 'human_support_escalation',
      name: 'Human Support Escalation',
      body:
        'When significant emotional distress is detected, encourage appropriate human support: trusted family, friends, ' +
        'mentors, coaches, physicians, therapists, counselors, clergy, or emergency services. Do not attempt to replace ' +
        'qualified human support during crisis situations.',
    },
  ] as const
);

// ---------------------------------------------------------------------------
// 13-step hard-constraint review order
// ---------------------------------------------------------------------------

export const CONSTITUTIONAL_REVIEW_ORDER = [
  'lawfulness',
  'safety',
  'harm_prevention',
  'crisis_detection',
  'emotional_intelligence_review',
  'ethical_compliance',
  'political_neutrality',
  'conflict_of_interest',
  'user_autonomy',
  'future_preservation',
  'future_visibility',
  'goal_alignment',
  'outcome_optimization',
] as const;
export type ReviewStep = (typeof CONSTITUTIONAL_REVIEW_ORDER)[number];

// ---------------------------------------------------------------------------
// Emotional intelligence — primitive emotions
// ---------------------------------------------------------------------------

export type EmotionalState =
  | 'grief'
  | 'anger'
  | 'fear'
  | 'shame'
  | 'humiliation'
  | 'despair'
  | 'panic'
  | 'obsession'
  | 'hopelessness'
  | 'isolation'
  | 'rage'
  | 'sadness';

export interface EmotionalSignal {
  state: EmotionalState;
  evidence_phrase?: string;
  intensity: 'low' | 'moderate' | 'high' | 'severe';
}

export interface EmotionalAssessment {
  emotional_state: EmotionalSignal[];
  risk_level: RiskLevel;
  confidence: number;
  future_visibility_score: number; // [0,1], 1 = full visibility
  decision_quality_risk_score: number; // [0,1], 1 = worst
}

// ---------------------------------------------------------------------------
// Cognitive distortion detection
// ---------------------------------------------------------------------------

export type DistortionKind =
  | 'catastrophizing'
  | 'black_and_white'
  | 'emotional_reasoning'
  | 'fortune_telling'
  | 'mind_reading'
  | 'hopelessness_loop'
  | 'revenge_fixation'
  | 'obsessive_thinking';

export interface DistortionFinding {
  kind: DistortionKind;
  evidence_phrase: string;
  intensity: 'low' | 'moderate' | 'high';
}

// ---------------------------------------------------------------------------
// Crisis detection
// ---------------------------------------------------------------------------

export type CrisisKind =
  | 'suicidal_ideation'
  | 'self_harm_risk'
  | 'violence_risk'
  | 'severe_emotional_instability'
  | 'extreme_hopelessness';

export interface CrisisSignal {
  kind: CrisisKind;
  evidence_phrase: string;
  level: RiskLevel;
  escalation_recommended: boolean;
}

export interface CrisisAssessment {
  signals: CrisisSignal[];
  level: RiskLevel;
  escalation_recommended: boolean;
  suspend_goal_optimization: boolean;
}

// ---------------------------------------------------------------------------
// Realism + Trajectory + Future Preservation outputs
// ---------------------------------------------------------------------------

export interface RealismFinding {
  rule_id: string;
  evidence_phrase: string;
  rewrite_suggestion: string;
}

export interface RealismResult {
  findings: RealismFinding[];
  rewritten_text: string;
}

export interface TrajectoryConcern {
  rule_id: string;
  kind: 'self_defeating' | 'impulsive' | 'future_destructive' | 'emotional_overreaction';
  reason: string;
  evidence_phrase?: string;
}

export interface TrajectoryReviewResult {
  concerns: TrajectoryConcern[];
  needs_decompression: boolean;
}

export type FuturePreservationAxis =
  | 'freedom'
  | 'health'
  | 'relationships'
  | 'career_opportunities'
  | 'education_opportunities'
  | 'financial_flexibility'
  | 'reputation'
  | 'future_options';

export interface FuturePreservationScore {
  axis: FuturePreservationAxis;
  score: number; // [0,1], 1 = preserves
  reason: string;
}

export interface FuturePreservationResult {
  axes: FuturePreservationScore[];
  overall: number;
  destructive_axes: FuturePreservationAxis[];
}

// ---------------------------------------------------------------------------
// Constructive Redirection
// ---------------------------------------------------------------------------

export interface RedirectionAlternative {
  kind: 'lawful' | 'safer' | 'future_preserving';
  label: string;
  description: string;
  citation?: { source: string; reference?: string };
}

export interface ConstructiveRedirection {
  rejected_objective: string;
  underlying_need: string;
  future_consequences: string[];
  alternatives: RedirectionAlternative[];
  framing: string; // user-facing copy assembled from the pattern
}

// ---------------------------------------------------------------------------
// Future Visibility expansion
// ---------------------------------------------------------------------------

export interface FutureOption {
  label: string;
  description: string;
  feasibility_label: 'plausible' | 'possible' | 'uncertain';
}

export interface FutureVisibilityResult {
  needs_expansion: boolean;
  reason?: string;
  options: FutureOption[];
}

// ---------------------------------------------------------------------------
// Constitutional decision (returned by the orchestrator)
// ---------------------------------------------------------------------------

export interface ConstitutionalDecision {
  verdict: ConstitutionalVerdict;
  governance: GovernanceDecision; // Sprint L result
  emotional: EmotionalAssessment;
  crisis: CrisisAssessment;
  distortions: DistortionFinding[];
  realism: RealismResult;
  trajectory: TrajectoryReviewResult;
  future_preservation: FuturePreservationResult;
  future_visibility: FutureVisibilityResult;
  redirection?: ConstructiveRedirection;
  /** Steps in the 13-step order that PASSED. */
  steps_passed: ReviewStep[];
  /** First step (if any) that FAILED. */
  failed_step?: ReviewStep;
  /** Constitutional principle violations beyond the Sprint L set. */
  principle_violations: Array<{
    principle: ConstitutionalPrincipleId;
    reason: string;
    severity: GovernanceSeverity;
  }>;
  /** Final user-facing output text. */
  final_text: string;
  /** Stable hashes for audit. */
  draft_hash: string;
  final_hash: string;
  /** Latency of the engine in ms. */
  latency_ms: number;
  /** True if the constitutional GraphRAG retrieval succeeded. */
  retrieval_ok: boolean;
  /** Timestamp (deterministic in tests). */
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Pre-stream guard — orchestrates draft → review → modify → re-review
// ---------------------------------------------------------------------------

export interface PreStreamInputs {
  user_input_text?: string;
  draft_text: string;
  redraft?: (draft: string, decision: ConstitutionalDecision) => string;
  subject?: GovernanceSubject;
  retrieval_ok?: boolean;
  now?: string;
  max_iterations?: number;
}

export interface PreStreamIteration {
  index: number;
  draft_hash: string;
  final_hash: string;
  verdict: ConstitutionalVerdict;
  modifications: Array<{ kind: string; reason: string; before?: string; after?: string }>;
  violations: GovernanceViolation[];
  retrieved_rule_ids: string[];
  retrieval_ok: boolean;
  latency_ms: number;
}

export interface PreStreamResult {
  iterations: PreStreamIteration[];
  final_verdict: ConstitutionalVerdict;
  final_text: string;
  final_decision: ConstitutionalDecision;
  ok_to_stream: boolean;
}

// ---------------------------------------------------------------------------
// Re-export the Sprint L subject so consumers have one import surface
// ---------------------------------------------------------------------------

export type { GovernanceSubject, GovernanceViolation };
