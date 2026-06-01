/**
 * Feedback Service — Sprint M Phase 7.
 *
 * Validates + persists user feedback. Each kind binds back to the
 * relevant audit / recommendation / agent identifier so we can join
 * back to the governance audit log.
 *
 * Pure validators are exported separately so the API routes can
 * fail with structured reasons.
 */

export type RecommendationFeedbackKind =
  | 'helpful'
  | 'not_helpful'
  | 'confusing'
  | 'incorrect'
  | 'out_of_scope'
  | 'privacy_concern'
  | 'other';

export type SimulationFeedbackKind =
  | 'useful'
  | 'not_useful'
  | 'confusing'
  | 'inaccurate'
  | 'too_optimistic'
  | 'too_pessimistic'
  | 'other';

export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RecommendationFeedbackInput {
  recommendation_id?: string | null;
  recommendation_table?: string | null;
  agent_kind?: string | null;
  agent_name?: string | null;
  governance_audit_id?: string | null;
  feedback_kind: RecommendationFeedbackKind;
  comment?: string;
}

export interface SimulationFeedbackInput {
  simulation_id?: string | null;
  feedback_kind: SimulationFeedbackKind;
  comment?: string;
}

export interface NpsInput {
  score: number;
  comment?: string;
  prompt_slug?: string;
}

export interface BugReportInput {
  title: string;
  body: string;
  severity?: BugSeverity;
  route_path?: string;
  user_agent?: string;
  app_version?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const REC_KINDS: ReadonlyArray<RecommendationFeedbackKind> = [
  'helpful',
  'not_helpful',
  'confusing',
  'incorrect',
  'out_of_scope',
  'privacy_concern',
  'other',
];

const SIM_KINDS: ReadonlyArray<SimulationFeedbackKind> = [
  'useful',
  'not_useful',
  'confusing',
  'inaccurate',
  'too_optimistic',
  'too_pessimistic',
  'other',
];

const BUG_SEVERITY: ReadonlyArray<BugSeverity> = ['low', 'medium', 'high', 'critical'];

export function validateRecommendationFeedback(i: RecommendationFeedbackInput): ValidationResult {
  const errors: string[] = [];
  if (!REC_KINDS.includes(i.feedback_kind)) errors.push('invalid_kind');
  if (i.comment && i.comment.length > 4000) errors.push('comment_too_long');
  return { ok: errors.length === 0, errors };
}

export function validateSimulationFeedback(i: SimulationFeedbackInput): ValidationResult {
  const errors: string[] = [];
  if (!SIM_KINDS.includes(i.feedback_kind)) errors.push('invalid_kind');
  if (i.comment && i.comment.length > 4000) errors.push('comment_too_long');
  return { ok: errors.length === 0, errors };
}

export function validateNps(i: NpsInput): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(i.score) || i.score < 0 || i.score > 10) errors.push('invalid_score');
  if (i.comment && i.comment.length > 4000) errors.push('comment_too_long');
  return { ok: errors.length === 0, errors };
}

export function validateBugReport(i: BugReportInput): ValidationResult {
  const errors: string[] = [];
  if (!i.title || i.title.length < 4) errors.push('title_too_short');
  if (!i.body || i.body.length < 8) errors.push('body_too_short');
  if (i.title && i.title.length > 240) errors.push('title_too_long');
  if (i.body && i.body.length > 8000) errors.push('body_too_long');
  if (i.severity && !BUG_SEVERITY.includes(i.severity)) errors.push('invalid_severity');
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// NPS bucketing — used by observability dashboards
// ---------------------------------------------------------------------------

export function npsBucket(score: number): 'detractor' | 'passive' | 'promoter' | 'invalid' {
  if (!Number.isInteger(score) || score < 0 || score > 10) return 'invalid';
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}

export const __test = {
  validateRecommendationFeedback,
  validateSimulationFeedback,
  validateNps,
  validateBugReport,
  npsBucket,
  REC_KINDS,
  SIM_KINDS,
  BUG_SEVERITY,
};
