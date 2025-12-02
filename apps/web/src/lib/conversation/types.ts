/**
 * Discovery Conversation System Types
 * Based on Marine Corps recruiting psychology adapted for life navigation
 */

import { Goal } from '@/lib/goals/types';
import { BenefitTag } from '@/lib/benefits/benefit-tags';

export type ConversationStage = 
  | 'initial_assessment'
  | 'surface_exploration'
  | 'deeper_discovery'
  | 'true_motivation'
  | 'action_planning'
  | 'commitment';

export type QuestionType = 
  | 'open_ended'
  | 'probing'
  | 'clarifying'
  | 'challenging'
  | 'reflective'
  | 'hypothetical';

export type AgentRole = 
  | 'financial_advisor'
  | 'career_coach'
  | 'health_specialist'
  | 'psychologist'
  | 'life_strategist';

export interface ConversationSession {
  id: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  
  // Context from user's selections
  userGoals: Goal[];
  benefitSelections: {
    domain: string;
    topPriorities: string[];
    important: string[];
  }[];
  
  // Conversation state
  currentStage: ConversationStage;
  currentAgent: AgentRole;
  messageHistory: Message[];
  
  // Discovered insights
  insights: InsightDiscovery[];
  hiddenMotivations: HiddenMotivation[];
  contradictions: Contradiction[];
  
  // Recommendations
  goalRefinements: GoalRefinement[];
  newGoalSuggestions: Goal[];
  actionItems: ActionItem[];
  
  // Analysis results
  authenticityScore: number; // 0-100 how authentic/aligned their goals are
  clarityScore: number; // 0-100 how clear they are about their motivations
  readinessScore: number; // 0-100 how ready they are to take action
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  agent?: AgentRole;
  content: string;
  timestamp: Date;
  
  // Message metadata
  questionType?: QuestionType;
  stage?: ConversationStage;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  confidence?: number; // Agent's confidence in the response
  
  // Extracted information
  extractedGoals?: string[];
  extractedBenefits?: string[];
  extractedConcerns?: string[];
  extractedValues?: string[];
}

export interface InsightDiscovery {
  id: string;
  type: 'motivation' | 'fear' | 'value' | 'belief' | 'pattern';
  content: string;
  confidence: number;
  supportingEvidence: string[];
  relatedGoals: string[];
  relatedBenefits: string[];
  discoveredAt: Date;
}

export interface HiddenMotivation {
  id: string;
  statedGoal: string;
  surfaceReason: string;
  deeperReason: string;
  trueMotivation: string;
  
  // Psychological factors
  emotionalDrivers: string[];
  pastExperiences?: string[];
  fears?: string[];
  aspirations?: string[];
  
  // Impact on planning
  implicationsForGoal: string;
  suggestedRefinements: string[];
}

export interface Contradiction {
  id: string;
  type: 'goal_conflict' | 'value_mismatch' | 'priority_confusion' | 'timeline_conflict';
  description: string;
  
  conflictingElements: {
    element1: {
      type: 'goal' | 'benefit' | 'statement';
      content: string;
      reference?: string;
    };
    element2: {
      type: 'goal' | 'benefit' | 'statement';
      content: string;
      reference?: string;
    };
  };
  
  resolution?: {
    suggested: string;
    accepted: boolean;
    finalDecision?: string;
  };
}

export interface GoalRefinement {
  originalGoalId: string;
  originalGoal: Goal;
  
  refinements: {
    field: keyof Goal;
    originalValue: any;
    suggestedValue: any;
    reason: string;
    accepted?: boolean;
  }[];
  
  alignmentImprovement: number; // How much this improves alignment score
  motivationAlignment: string[]; // Which true motivations this better serves
}

export interface ActionItem {
  id: string;
  priority: 'immediate' | 'short_term' | 'long_term';
  category: 'research' | 'planning' | 'action' | 'reflection';
  
  title: string;
  description: string;
  relatedGoals: string[];
  
  deadline?: Date;
  completed: boolean;
  completedAt?: Date;
  
  resources?: string[];
  nextSteps?: string[];
}

/**
 * Question Templates for Discovery methodology
 */
export const QUESTION_TEMPLATES = {
  surface: [
    "What made you choose {goal} as one of your goals?",
    "When you think about {goal}, what comes to mind first?",
    "How would achieving {goal} change your daily life?",
    "What would happen if you didn't achieve {goal}?",
  ],
  
  deeper: [
    "You mentioned {reason}. What makes that important to you?",
    "When you say {statement}, what does that really mean for you?",
    "Help me understand why {benefit} matters so much to you personally.",
    "What experiences have shaped your desire for {goal}?",
  ],
  
  motivation: [
    "If we dig deeper, what's really driving your need for {goal}?",
    "Beyond the practical benefits, what emotional need does {goal} fulfill?",
    "What are you really trying to protect or achieve with {goal}?",
    "If {goal} is the solution, what's the real problem you're solving?",
  ],
  
  challenging: [
    "I notice you want both {goal1} and {goal2}. How do you see these working together?",
    "You prioritized {benefit1} but your goal of {goal} seems to serve {benefit2} more. Can you help me understand?",
    "What if achieving {goal} doesn't actually give you {desired_outcome}?",
    "Are you pursuing {goal} for yourself or to meet someone else's expectations?",
  ],
  
  commitment: [
    "On a scale of 1-10, how committed are you to {goal}?",
    "What would need to change for you to start working on {goal} tomorrow?",
    "What's the smallest step you could take this week toward {goal}?",
    "What might stop you from achieving {goal}, and how will you handle that?",
  ],
};

/**
 * Agent Expertise Areas
 */
export const AGENT_EXPERTISE = {
  financial_advisor: {
    domains: ['financial'],
    topics: ['retirement', 'investments', 'debt', 'savings', 'insurance', 'estate planning'],
    approach: 'analytical and numbers-focused',
  },
  
  career_coach: {
    domains: ['career'],
    topics: ['advancement', 'skills', 'networking', 'entrepreneurship', 'work-life balance'],
    approach: 'growth-oriented and strategic',
  },
  
  health_specialist: {
    domains: ['health'],
    topics: ['fitness', 'nutrition', 'mental health', 'medical care', 'wellness', 'longevity'],
    approach: 'holistic and evidence-based',
  },
  
  psychologist: {
    domains: ['all'],
    topics: ['emotions', 'relationships', 'trauma', 'self-esteem', 'habits', 'mindset'],
    approach: 'empathetic and insight-focused',
  },
  
  life_strategist: {
    domains: ['all'],
    topics: ['purpose', 'values', 'legacy', 'balance', 'fulfillment', 'meaning'],
    approach: 'big-picture and philosophical',
  },
};

/**
 * Conversation Flow Stages
 */
export const CONVERSATION_STAGES = {
  initial_assessment: {
    duration: '5-10 messages',
    goals: ['Build rapport', 'Understand stated goals', 'Identify primary concerns'],
    agents: ['life_strategist'],
  },
  
  surface_exploration: {
    duration: '10-15 messages',
    goals: ['Explore each goal', 'Understand surface reasons', 'Identify patterns'],
    agents: ['financial_advisor', 'career_coach', 'health_specialist'],
  },
  
  deeper_discovery: {
    duration: '15-20 messages',
    goals: ['Probe deeper motivations', 'Uncover hidden drivers', 'Find contradictions'],
    agents: ['psychologist', 'life_strategist'],
  },
  
  true_motivation: {
    duration: '10-15 messages',
    goals: ['Reveal authentic motivations', 'Align goals with values', 'Resolve contradictions'],
    agents: ['psychologist', 'life_strategist'],
  },
  
  action_planning: {
    duration: '10-15 messages',
    goals: ['Refine goals', 'Create action plan', 'Set milestones', 'Identify resources'],
    agents: ['financial_advisor', 'career_coach', 'health_specialist'],
  },
  
  commitment: {
    duration: '5-10 messages',
    goals: ['Secure commitment', 'Address concerns', 'Set first steps', 'Schedule follow-up'],
    agents: ['life_strategist'],
  },
};