/**
 * Multi-Agent System Types
 * Advanced AI agents for personalized life navigation
 */

import { Goal } from '@/lib/goals/types';
import { BenefitTag } from '@/lib/benefits/benefit-tags';
import { RiskProfile } from '@/lib/risk/types';
import { InsightDiscovery } from '@/lib/conversation/types';

export type AgentType = 
  | 'orchestrator'        // Master coordinator
  | 'financial_strategist'
  | 'career_architect'
  | 'health_optimizer'
  | 'risk_analyst'
  | 'behavioral_psychologist'
  | 'life_coach'
  | 'education_advisor'
  | 'relationship_counselor'
  | 'spiritual_guide';

export type ConversationPhase =
  | 'synthesis'           // Synthesizing all data
  | 'clarification'      // Clarifying contradictions
  | 'deep_discovery'     // Uncovering hidden needs
  | 'roadmap_creation'   // Building the plan
  | 'commitment'         // Securing buy-in
  | 'implementation';    // Action steps

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  avatar: string;
  personality: AgentPersonality;
  expertise: string[];
  communicationStyle: CommunicationStyle;
  
  // Agent capabilities
  canAnalyze: DataSource[];
  canRecommend: RecommendationType[];
  decisionWeight: number; // 0-1, influence in final recommendations
}

export interface AgentPersonality {
  traits: string[];
  approach: 'analytical' | 'empathetic' | 'motivational' | 'practical' | 'visionary';
  questioningStyle: 'direct' | 'socratic' | 'exploratory' | 'challenging';
  supportLevel: 'high' | 'moderate' | 'tough_love';
}

export interface CommunicationStyle {
  formality: 'formal' | 'professional' | 'casual' | 'friendly';
  verbosity: 'concise' | 'balanced' | 'detailed';
  examples: 'frequent' | 'occasional' | 'minimal';
  emotionalTone: 'warm' | 'neutral' | 'serious';
}

export type DataSource = 
  | 'goals'
  | 'benefits'
  | 'risk_profile'
  | 'conversation_insights'
  | 'financial_data'
  | 'health_data'
  | 'career_data'
  | 'relationship_data';

export type RecommendationType =
  | 'goal_refinement'
  | 'new_goals'
  | 'action_steps'
  | 'resource_allocation'
  | 'timeline_adjustment'
  | 'risk_mitigation'
  | 'skill_development'
  | 'habit_formation'
  | 'support_systems';

export interface MultiAgentSession {
  id: string;
  userId: string;
  
  // User context
  userProfile: UserComprehensiveProfile;
  
  // Session state
  phase: ConversationPhase;
  activeAgents: Agent[];
  leadAgent: Agent;
  
  // Conversation
  messages: AgentMessage[];
  
  // Analysis results
  synthesis: DataSynthesis;
  contradictions: Contradiction[];
  gaps: DataGap[];
  opportunities: Opportunity[];
  
  // Output
  roadmap?: PersonalizedRoadmap;
  
  // Metadata
  startedAt: Date;
  completedAt?: Date;
  quality: SessionQuality;
}

export interface UserComprehensiveProfile {
  // From previous steps
  goals: Goal[];
  benefitSelections: Record<string, string[]>;
  riskProfile: RiskProfile;
  conversationInsights: InsightDiscovery[];
  
  // Derived insights
  primaryMotivations: string[];
  coreValues: string[];
  behavioralPatterns: string[];
  blindSpots: string[];
  
  // Context
  lifeStage: string;
  constraints: Constraint[];
  resources: Resource[];
  supportSystem: SupportSystem;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  agentType: AgentType;
  timestamp: Date;
  
  content: string;
  intent: MessageIntent;
  
  // For questions
  question?: {
    type: 'open' | 'choice' | 'scale' | 'ranking';
    options?: string[];
    context?: string;
  };
  
  // For insights
  insight?: {
    type: string;
    confidence: number;
    evidence: string[];
  };
  
  // For recommendations
  recommendation?: {
    type: RecommendationType;
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
  };
  
  // User response
  userResponse?: {
    content: string;
    timestamp: Date;
    sentiment?: string;
  };
}

export type MessageIntent =
  | 'greeting'
  | 'question'
  | 'clarification'
  | 'insight'
  | 'recommendation'
  | 'challenge'
  | 'encouragement'
  | 'summary'
  | 'handoff'; // Transferring to another agent

export interface DataSynthesis {
  // Unified understanding
  lifeVision: string;
  coreObjectives: string[];
  
  // Key patterns
  motivationalDrivers: {
    primary: string[];
    secondary: string[];
    hidden: string[];
  };
  
  // Behavioral insights
  decisionMakingStyle: string;
  changeReadiness: number; // 0-100
  implementationCapability: number; // 0-100
  
  // Risk analysis
  overallRiskTolerance: string;
  domainRiskProfiles: Record<string, number>;
  
  // Success factors
  strengthsToLeverage: string[];
  weaknessesToAddress: string[];
  opportunitiesToCapture: string[];
  threatsToMitigate: string[];
}

export interface Contradiction {
  id: string;
  type: 'goal_conflict' | 'value_mismatch' | 'resource_conflict' | 'timeline_conflict';
  
  elements: {
    element1: { type: string; content: string; source: string };
    element2: { type: string; content: string; source: string };
  };
  
  severity: 'critical' | 'significant' | 'minor';
  
  resolution?: {
    approach: string;
    recommendation: string;
    tradeoffs: string[];
  };
}

export interface DataGap {
  id: string;
  area: string;
  description: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  
  questions: string[];
  potentialImpact: string;
}

export interface Opportunity {
  id: string;
  type: 'quick_win' | 'strategic' | 'transformational';
  
  title: string;
  description: string;
  
  alignment: {
    goals: string[];
    values: string[];
    riskTolerance: boolean;
  };
  
  implementation: {
    difficulty: 'easy' | 'moderate' | 'hard';
    timeframe: string;
    resources: string[];
  };
  
  expectedImpact: {
    area: string;
    magnitude: 'high' | 'medium' | 'low';
    confidence: number;
  };
}

export interface PersonalizedRoadmap {
  id: string;
  userId: string;
  createdAt: Date;
  
  // Vision & Mission
  lifeVision: {
    statement: string;
    timeHorizon: string;
    keyThemes: string[];
  };
  
  personalMission: {
    statement: string;
    coreValues: string[];
    guidingPrinciples: string[];
  };
  
  // Strategic Objectives
  objectives: StrategicObjective[];
  
  // Phases
  phases: RoadmapPhase[];
  
  // Milestones
  milestones: RoadmapMilestone[];
  
  // Action Plan
  immediateActions: ActionItem[];
  habits: HabitFormation[];
  
  // Support Structure
  accountability: AccountabilityPlan;
  resources: ResourcePlan;
  
  // Risk Management
  riskMitigation: RiskMitigationPlan;
  
  // Success Metrics
  successMetrics: SuccessMetric[];
  
  // Review Schedule
  reviewSchedule: ReviewSchedule;
}

export interface StrategicObjective {
  id: string;
  domain: string;
  title: string;
  description: string;
  
  alignment: {
    values: string[];
    motivations: string[];
    riskTolerance: boolean;
  };
  
  priority: number; // 1-10
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  
  keyResults: string[];
  dependencies: string[];
  
  status: 'not_started' | 'in_progress' | 'at_risk' | 'on_track' | 'completed';
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  
  startDate: Date;
  endDate: Date;
  
  objectives: string[]; // Objective IDs
  focusAreas: string[];
  
  successCriteria: string[];
  keyActivities: string[];
  
  resources: string[];
  risks: string[];
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  
  targetDate: Date;
  phase: string; // Phase ID
  
  type: 'achievement' | 'checkpoint' | 'decision_point';
  
  criteria: string[];
  celebration: string; // How to celebrate achievement
  
  dependencies: string[];
  impact: 'critical' | 'major' | 'minor';
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  
  category: string;
  priority: 'urgent' | 'important' | 'nice_to_have';
  
  deadline: Date;
  effort: 'minimal' | 'moderate' | 'significant';
  
  steps: string[];
  resources: string[];
  
  expectedOutcome: string;
  successCriteria: string;
  
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface HabitFormation {
  id: string;
  habit: string;
  rationale: string;
  
  trigger: string;
  routine: string;
  reward: string;
  
  frequency: 'daily' | 'weekly' | 'monthly';
  trackingMethod: string;
  
  supportingGoals: string[];
  expectedImpact: string;
  
  stages: {
    cue: string;
    craving: string;
    response: string;
    reward: string;
  };
}

export interface AccountabilityPlan {
  selfAccountability: {
    checkInFrequency: string;
    trackingMethods: string[];
    rewards: string[];
    consequences: string[];
  };
  
  externalAccountability: {
    partners: string[];
    checkInSchedule: string;
    reportingMethod: string;
    supportType: string;
  };
  
  professionalSupport?: {
    type: string;
    frequency: string;
    objectives: string[];
  };
}

export interface ResourcePlan {
  financial: {
    budget: number;
    allocation: Record<string, number>;
    savingsTarget: number;
  };
  
  time: {
    weeklyHours: number;
    allocation: Record<string, number>;
  };
  
  learning: {
    courses: string[];
    books: string[];
    mentors: string[];
  };
  
  tools: {
    apps: string[];
    services: string[];
    equipment: string[];
  };
}

export interface RiskMitigationPlan {
  identifiedRisks: {
    risk: string;
    probability: 'high' | 'medium' | 'low';
    impact: 'severe' | 'moderate' | 'minor';
    mitigation: string;
    contingency: string;
  }[];
  
  earlyWarningSignals: string[];
  reviewFrequency: string;
  adaptationStrategy: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  description: string;
  
  type: 'quantitative' | 'qualitative';
  measurement: string;
  
  baseline: any;
  target: any;
  
  trackingFrequency: string;
  dataSource: string;
  
  milestone: string; // Milestone ID
}

export interface ReviewSchedule {
  daily: string[];
  weekly: string[];
  monthly: string[];
  quarterly: string[];
  annual: string[];
}

export interface Constraint {
  type: 'financial' | 'time' | 'geographic' | 'family' | 'health' | 'skill';
  description: string;
  severity: 'hard' | 'soft';
  workaround?: string;
}

export interface Resource {
  type: 'financial' | 'social' | 'skill' | 'time' | 'physical';
  description: string;
  availability: 'immediate' | 'accessible' | 'potential';
  quantity?: number;
}

export interface SupportSystem {
  family: string[];
  friends: string[];
  professional: string[];
  community: string[];
  online: string[];
}

export interface SessionQuality {
  completeness: number; // 0-100
  consistency: number; // 0-100
  depth: number; // 0-100
  actionability: number; // 0-100
  userEngagement: number; // 0-100
}