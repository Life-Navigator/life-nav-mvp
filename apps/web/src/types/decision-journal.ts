/**
 * Decision-intelligence types — mirror migration 079.
 *
 * All times are ISO timestamps. All money values are USD unless the row
 * carries a `unit` field.
 */

export type DecisionType =
  | 'financial'
  | 'career'
  | 'education'
  | 'health'
  | 'lifestyle'
  | 'relationship'
  | 'estate'
  | 'entrepreneurship'
  | 'other';

export type JournalStatus = 'pending' | 'made' | 'rescinded' | 'superseded';
export type AcceptanceStatus =
  | 'accepted'
  | 'rejected'
  | 'modified'
  | 'deferred'
  | 'completed'
  | 'abandoned';
export type ReviewPeriod = '7_day' | '30_day' | '90_day' | '180_day' | '1_year' | 'final';
export type ReviewVerdict =
  | 'much_better_than_expected'
  | 'better_than_expected'
  | 'as_expected'
  | 'worse_than_expected'
  | 'much_worse_than_expected'
  | 'no_signal_yet';

export type SignalKind =
  | 'preferred_communication_style'
  | 'follow_through_pattern'
  | 'risk_behavior'
  | 'decision_tendency'
  | 'procrastination_indicator'
  | 'motivation_trigger'
  | 'outcome_quality_distribution';

export interface DecisionJournal {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  decision_type: DecisionType;
  source: 'user' | 'advisor' | 'scenario_lab' | 'optimizer' | 'external';
  source_run_id?: string | null;
  related_goal_id?: string | null;
  related_root_goal_id?: string | null;
  status: JournalStatus;
  made_at?: string | null;
  rescinded_at?: string | null;
  superseded_by?: string | null;
  recommendation_summary?: string | null;
  reasoning?: string | null;
  assumptions: string[];
  system_confidence_at_decision?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DecisionExpectation {
  id: string;
  user_id: string;
  journal_id: string;
  dimension: string;
  expected_value?: number | null;
  expected_text?: string | null;
  expected_unit?: string | null;
  expected_by?: string | null;
  confidence?: number | null;
  rationale?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DecisionOutcome {
  id: string;
  user_id: string;
  journal_id: string;
  expectation_id?: string | null;
  dimension: string;
  observed_value?: number | null;
  observed_text?: string | null;
  observed_unit?: string | null;
  observed_at: string;
  delta_value?: number | null;
  delta_pct?: number | null;
  accuracy_score?: number | null;
  source: 'self_report' | 'computed' | 'integration' | 'admin';
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DecisionReview {
  id: string;
  user_id: string;
  journal_id: string;
  reviewed_at: string;
  period: ReviewPeriod;
  verdict: ReviewVerdict;
  lessons_learned?: string | null;
  would_repeat?: boolean | null;
  sentiment_score?: number | null;
  next_check_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RecommendationAcceptance {
  id: string;
  user_id: string;
  advisor_run_id?: string | null;
  journal_id?: string | null;
  action_id: string;
  recommendation_summary: string;
  expected_strength?: number | null;
  domain?: string | null;
  status: AcceptanceStatus;
  modified_to?: string | null;
  reason?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  abandoned_at?: string | null;
  adherence_score?: number | null;
  user_satisfaction?: number | null;
  outcome_quality?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LearningSignal {
  id: string;
  user_id: string;
  signal_kind: SignalKind;
  signal_key: string;
  signal_value: Record<string, unknown>;
  support_count: number;
  confidence?: number | null;
  computed_at: string;
  updated_at: string;
}

export interface LearningProfile {
  user_id: string;
  signals: LearningSignal[];
  /** Derived helpers — computed from `signals`. Higher is better.
   * `support_count` thresholds: never apply a signal when its support_count is < 5. */
  preferred_style?: 'detailed' | 'balanced' | 'brief';
  follow_through_rate?: number;
  accept_rate?: number;
  procrastination_median_days?: number | null;
  outcome_mean_accuracy?: number | null;
}

export interface AcceptanceMetrics {
  total: number;
  accept_rate: number;
  reject_rate: number;
  modify_rate: number;
  defer_rate: number;
  completion_rate: number; // completed / (accepted + completed + abandoned)
  abandonment_rate: number;
  mean_adherence?: number;
  mean_user_satisfaction?: number;
  mean_outcome_quality?: number;
  by_domain: Record<string, { total: number; accept_rate: number; completion_rate: number }>;
}
