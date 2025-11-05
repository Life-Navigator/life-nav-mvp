/**
 * Agent System Types
 *
 * Comprehensive type system for all agent communication,
 * ensuring type safety across the platform.
 */

// ============================================
// AGENT SYSTEM TYPES
// ============================================

export type AgentRole =
  | 'orchestrator'
  | 'finance_manager'
  | 'career_manager'
  | 'health_coordinator'
  | 'legal_advisor'
  | 'analyst'
  | 'planner';

export type AgentDomain =
  | 'finance'
  | 'career'
  | 'health'
  | 'legal'
  | 'personal';

export type MessageAction =
  | 'onboarding'
  | 'chat'
  | 'quick_response'
  | 'analyze'
  | 'escalate';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'pending' | 'processing' | 'completed' | 'failed' | 'escalated';
export type Confidence = number; // 0-100

// ============================================
// MESSAGE TYPES
// ============================================

export interface UserMessage {
  id: string;                    // UUID
  user_id: string;               // UUID
  session_id: string;            // UUID
  content: string;               // User input text
  action: MessageAction;
  detected_domains: AgentDomain[];
  entities?: Record<string, unknown>; // Extracted entities
  sentiment?: 'positive' | 'neutral' | 'negative';
  created_at: Date;
  updated_at: Date;
}

export interface AgentMessage {
  id: string;                    // UUID
  user_message_id: string;       // Links to UserMessage
  user_id: string;               // UUID
  session_id: string;            // UUID
  agent_roles: AgentRole[];      // Which agents responded
  content: string;               // Response text
  message_type: 'analysis' | 'recommendation' | 'question' | 'error' | 'escalation';
  confidence: Confidence;
  sources: string[];             // Data sources used
  metadata: {
    response_time_ms: number;
    tokens_used?: number;
    model_version: string;
    routing_path: string;        // e.g., "orchestrator -> finance_manager"
  };
  created_at: Date;
  updated_at: Date;
}

export interface ConversationContext {
  session_id: string;            // UUID
  user_id: string;               // UUID
  primary_domain?: AgentDomain;
  active_agents: AgentRole[];
  message_count: number;
  started_at: Date;
  last_activity_at: Date;
  context_data: {
    user_profile?: Record<string, unknown>;
    recent_decisions?: string[];
    active_goals?: string[];
    constraints?: string[];
  };
}

// ============================================
// ACTION ITEMS & TASKS
// ============================================

export interface ActionItem {
  id: string;                    // UUID
  agent_message_id: string;
  action: string;                // Specific action to take
  description: string;
  priority: Priority;
  timeline?: string;             // e.g., "by Friday" or "within 30 days"
  estimated_effort?: string;     // e.g., "30 minutes", "2 hours"
  success_criteria?: string[];
  tags: string[];
}

export interface ConversationPhase {
  phase: 'onboarding' | 'active' | 'paused' | 'completed';
  initiated_at: Date;
  last_activity_at: Date;
  primary_goal?: string;
  secondary_goals?: string[];
}

// ============================================
// RESPONSE STRUCTURES
// ============================================

export interface ConfidenceScore {
  overall: Confidence;
  by_domain?: Record<AgentDomain, Confidence>;
  key_assumptions: string[];
  confidence_drivers: string[];
}

export interface Source {
  type: 'graphrag' | 'user_profile' | 'external_api' | 'calculation';
  name: string;
  url?: string;
  confidence: Confidence;
  last_updated: Date;
}

export interface EscalationInfo {
  required: boolean;
  escalation_type?: 'professional_referral' | 'crisis' | 'urgent_decision' | 'complex_analysis';
  reason: string;
  professional_type?: string;    // e.g., "CFP", "attorney", "doctor"
  urgency_level: Priority;
  suggested_action: string;
}

export interface AnalysisResult {
  summary: string;
  options?: Array<{
    name: string;
    pros: string[];
    cons: string[];
    timeline?: string;
    risk_level: 'low' | 'medium' | 'high';
    success_probability?: number; // 0-100
  }>;
  recommendation?: {
    option: string;
    reasoning: string;
    confidence: Confidence;
  };
  risks: Array<{
    risk: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
}

// ============================================
// ONBOARDING TYPES
// ============================================

export type OnboardingPhase = 1 | 2 | 3 | 4 | 5;

export interface OnboardingResponse {
  phase: OnboardingPhase;
  completed_phases: OnboardingPhase[];
  current_data: Record<string, unknown>;
  next_questions?: string[];
  estimated_completion_time_minutes: number;
  status: 'in_progress' | 'completed' | 'paused';
}

export interface OnboardingProfile {
  user_id: string;
  phase: OnboardingPhase;
  completed_at?: Date;
  profile_data: {
    finance?: FinanceDomainProfile;
    career?: CareerDomainProfile;
    health?: HealthDomainProfile;
    legal?: LegalDomainProfile;
    personal?: PersonalDomainProfile;
  };
  preferences: {
    communication_style: 'direct' | 'detailed' | 'mixed';
    technical_level: 'beginner' | 'intermediate' | 'advanced';
    memory_retention: 'full' | 'anonymized' | 'session_only' | 'custom';
  };
}

export interface FinanceDomainProfile {
  primary_concern: string;
  stress_level: number;           // 1-10
  income_range?: string;
  assets?: number;
  liabilities?: number;
  goals: string[];
}

export interface CareerDomainProfile {
  current_status: 'employed' | 'unemployed' | 'entrepreneurial' | 'retired';
  years_experience: number;
  aspiration: string;
  desired_timeline: string;
  key_skills: string[];
}

export interface HealthDomainProfile {
  current_status: string;
  priorities: string[];
  managed_conditions?: string[];
  providers?: string[];
}

export interface LegalDomainProfile {
  concerns: string[];
  family_status: string;
  dependents: number;
}

export interface PersonalDomainProfile {
  relationship_status: string;
  decision_style: 'solo' | 'joint' | 'consensus';
}

// ============================================
// QUICK RESPONSE TYPES
// ============================================

export interface QuickResponse {
  answer: string;               // < 100 words
  suggestions?: string[];        // Smart suggestions
  can_expand: boolean;           // Whether full chat should be offered
  expand_url?: string;           // Link to full chat
}

// ============================================
// DATABASE ENTITY TYPES (Prisma Models)
// ============================================

export interface ConversationMessageModel {
  id: string;
  user_id: string;
  session_id: string;
  role: 'user' | 'agent';
  content: string;
  message_type?: string;
  agent_roles?: string[];
  confidence?: number;
  sources?: string[];
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationSessionModel {
  id: string;
  user_id: string;
  topic: string;
  primary_domain?: AgentDomain;
  started_at: Date;
  last_activity_at: Date;
  ended_at?: Date;
  message_count: number;
  status: 'active' | 'completed' | 'paused';
}

// ============================================
// ERROR TYPES
// ============================================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class AgentTimeoutError extends AgentError {
  constructor(message: string = 'Agent request timed out') {
    super(message, 'AGENT_TIMEOUT');
    this.name = 'AgentTimeoutError';
  }
}

export class AgentValidationError extends AgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'AgentValidationError';
  }
}

export class EscalationRequiredError extends AgentError {
  constructor(
    public escalation: EscalationInfo,
    message: string = 'Professional escalation required'
  ) {
    super(message, 'ESCALATION_REQUIRED');
    this.name = 'EscalationRequiredError';
  }
}
