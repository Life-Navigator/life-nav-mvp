/**
 * Constitutional Character Layer — Sprint N.3 types.
 *
 * Builds on Sprint L (governance) + L2 (constitutional) + the
 * injection-defense layer. Every type here describes WHAT WOULD A
 * WISE ADVISOR DO — not just whether the draft is safe.
 */

export type CharacterPrincipleId =
  | 'integrity'
  | 'moral_courage'
  | 'responsibility'
  | 'stewardship'
  | 'discipline'
  | 'respect'
  | 'humility'
  | 'wisdom'
  | 'service';

export type CharacterDimension =
  | 'integrity'
  | 'courage'
  | 'responsibility'
  | 'respect'
  | 'humility'
  | 'wisdom'
  | 'service'
  | 'dignity_preservation';

/** Each dimension is scored in [0,1]. 1 = strong embodiment. */
export interface CharacterScore {
  integrity: number;
  courage: number;
  responsibility: number;
  respect: number;
  humility: number;
  wisdom: number;
  service: number;
  dignity_preservation: number;
  /** Arithmetic mean of all 8 dimensions, in [0,1]. */
  overall: number;
  /** Minimum across all 8 — used as the "weakest link" gate. */
  weakest: number;
  /** Whether the response would be regenerated based on this score. */
  passes_threshold: boolean;
}

/** Severity of a style/character violation. */
export type CharacterSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface CharacterFinding {
  dimension: CharacterDimension;
  rule_id: string;
  severity: CharacterSeverity;
  reason: string;
  evidence?: string;
}

export type StyleViolationCategory =
  | 'anger'
  | 'insult'
  | 'ridicule'
  | 'contempt'
  | 'vulgarity'
  | 'shaming'
  | 'mockery'
  | 'political_persuasion'
  | 'ideological_persuasion'
  | 'emotional_manipulation'
  | 'false_certainty'
  | 'engagement_bait'
  | 'sycophancy'
  | 'abandonment'
  | 'harmful_action_endorsement'
  | 'injection_payload';

export interface StyleFinding {
  category: StyleViolationCategory;
  rule_id: string;
  severity: CharacterSeverity;
  evidence: string;
  reason: string;
}

/** Family Table Test verdict — would we be proud to say this? */
export interface FamilyTableResult {
  passes: boolean;
  /** A small set of failure reasons; empty when passes=true. */
  failures: Array<{
    audience: 'spouse' | 'children' | 'parents' | 'grandparents' | 'future_self';
    reason: string;
  }>;
  /** True when the response uses adverse imagery / shaming / contempt. */
  contains_dignity_violation: boolean;
}

/** Trusted Advisor Test verdict. */
export interface TrustedAdvisorResult {
  passes: boolean;
  /** Specific concerns a wise advisor would raise. */
  concerns: string[];
}

/** Human flourishing assessment — 9 axes. */
export type FlourishingAxis =
  | 'health'
  | 'safety'
  | 'relationships'
  | 'education'
  | 'career'
  | 'financial'
  | 'resilience'
  | 'responsibility'
  | 'future_opportunity';

export interface FlourishingScore {
  axis: FlourishingAxis;
  /** [-1, 1]. -1 = the response actively harms this axis. */
  delta: number;
  reason?: string;
}

export interface FlourishingResult {
  scores: FlourishingScore[];
  overall: number; // average of deltas
  harming_axes: FlourishingAxis[];
}

/** Character review aggregate — produced by the character engine. */
export interface CharacterReview {
  score: CharacterScore;
  style: { findings: StyleFinding[]; sanitized_text: string };
  family_table: FamilyTableResult;
  trusted_advisor: TrustedAdvisorResult;
  flourishing: FlourishingResult;
  /** Should the response be regenerated? */
  needs_regeneration: boolean;
  /** When `needs_regeneration` and the engine can synthesize a
   *  rewrite, this is the suggested constructive reply. */
  suggested_rewrite?: string;
  /** Findings worth showing in the audit chain. */
  findings: CharacterFinding[];
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Minimum overall score to ship without regeneration. */
export const CHARACTER_OVERALL_THRESHOLD = 0.7;
/** Minimum weakest-link score; below this we regenerate even if the
 *  overall is OK. */
export const CHARACTER_WEAKEST_THRESHOLD = 0.4;
