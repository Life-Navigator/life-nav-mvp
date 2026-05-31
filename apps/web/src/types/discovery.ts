/**
 * Types for the root-goal discovery engine. Mirrors the columns added to
 * public.goals in migration 068 and the public.goal_discovery_turns table.
 */

export type Driver = 'financial_security' | 'image' | 'performance';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export type AgentPersona =
  | 'financial_advisor'
  | 'physician_intake'
  | 'career_coach'
  | 'education_counselor'
  | 'benefits_navigator'
  | 'estate_advisor'
  | 'general';

export type PromptKind =
  | 'what_accomplish'
  | 'what_unlock'
  | 'why_important'
  | 'success_definition'
  | 'consequence_of_inaction'
  | 'urgency'
  | 'confirmation'
  | 'free_text'
  | 'agent_summary';

export interface DriverScores {
  financial_security: number; // 0..1
  image: number; // 0..1
  performance: number; // 0..1
}

export interface DiscoveryTurn {
  turn_index: number;
  prompt_kind: PromptKind;
  prompt_text: string;
  user_answer?: string;
  detected_drivers?: DriverScores;
  inferred_root_goal?: string;
  confidence_after_turn?: number;
  agent_persona?: AgentPersona;
}

export interface DiscoverySessionState {
  session_id: string;
  goal_id?: string | null;
  agent_persona: AgentPersona;
  /** Stated goal at the start of the session — the user's first answer. */
  stated_goal: string;
  /** Free-text "need behind the need", set after the second drill. */
  need_behind_need?: string;
  /** Drilled-down root goal once confidence threshold is reached. */
  root_goal?: string;
  success_definition?: string;
  consequence_of_inaction?: string;
  urgency?: Urgency;
  /** Cumulative driver scores normalized to 0..1. */
  driver_scores: DriverScores;
  /** Confidence in the inferred root goal, 0..1. */
  confidence: number;
  /** Whether the engine considers the session complete. */
  done: boolean;
  /** All turns recorded so far (for persistence). */
  turns: DiscoveryTurn[];
}

export interface NextPromptResult {
  /** When `done`, no more questions — caller should ask for confirmation. */
  done: boolean;
  /** Next question to put in front of the user, if any. */
  prompt?: {
    kind: PromptKind;
    text: string;
    persona: AgentPersona;
  };
}

export interface DiscoverySummary {
  stated_goal: string;
  root_goal: string | null;
  success_definition: string | null;
  consequence_of_inaction: string | null;
  urgency: Urgency | null;
  dominant_driver: Driver | null;
  secondary_driver: Driver | null;
  driver_scores: DriverScores;
  confidence: number;
  agent_persona: AgentPersona;
}

export interface UserGraphProfileSummary {
  user_id: string;
  display_name: string | null;
  life_vision: Array<{ horizon: string; vision_text: string | null }>;
  root_goals: Array<{
    id: string;
    title: string;
    category: string;
    stated_goal: string | null;
    root_goal: string | null;
    success_definition: string | null;
    dominant_driver: Driver | null;
    secondary_driver: Driver | null;
    urgency: Urgency | null;
    confidence: number | null;
  }>;
  dominant_drivers: Record<Driver, number>;
  major_constraints: Array<{ dimension: string; severity: string; description: string }>;
  capabilities: Array<{ capability_name: string; proficiency_level: string }>;
  risk_profile: Array<{
    domain: string;
    tolerance_score: number;
    qualitative_level: string | null;
  }>;
  decision_preferences: Array<{ axis: string; weight: number }>;
  commitment_levels: Array<{ domain: string; hours_per_week: number | null }>;
  motivations: Array<{
    motivation_text: string;
    intensity: number | null;
    motivation_type: string | null;
  }>;
  initial_opportunities: string[];
  missing_information: string[];
}
