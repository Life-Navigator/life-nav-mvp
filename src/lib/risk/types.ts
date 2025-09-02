/**
 * Risk Aversion Analyzer Types
 * Based on behavioral finance and psychometric risk assessment
 */

export type RiskDomain = 'financial' | 'career' | 'health' | 'social' | 'general';

export type QuestionType = 
  | 'scenario'      // Behavioral scenario questions
  | 'tradeoff'      // Risk-reward tradeoff questions
  | 'probability'   // Probability assessment questions
  | 'loss_aversion' // Loss aversion measurement
  | 'time_horizon'  // Time preference questions
  | 'regret'        // Regret minimization questions;

export type ResponseType = 
  | 'single_choice'
  | 'scale'
  | 'ranking'
  | 'allocation';

export interface RiskQuestion {
  id: string;
  domain: RiskDomain;
  type: QuestionType;
  responseType: ResponseType;
  
  // Question content
  title: string;
  scenario?: string;
  imageUrl?: string;
  
  // Response options
  options: RiskOption[];
  
  // Scoring
  weight: number; // Importance of this question (0-1)
  category: RiskCategory;
  
  // Behavioral indicators
  measuresTraits: RiskTrait[];
  
  // Conditional logic
  followUpQuestionId?: string;
  prerequisiteAnswers?: Record<string, any>;
}

export interface RiskOption {
  id: string;
  label: string;
  description?: string;
  value: number | string;
  riskScore: number; // -100 (very risk averse) to +100 (very risk seeking)
  
  // For visual options
  icon?: string;
  color?: string;
  
  // For allocation questions
  allocationPercentage?: number;
}

export type RiskCategory = 
  | 'pure_risk_tolerance'     // Core risk tolerance
  | 'risk_capacity'           // Ability to take risk
  | 'loss_aversion'          // Sensitivity to losses
  | 'ambiguity_aversion'     // Comfort with uncertainty
  | 'time_preference'        // Short vs long-term thinking
  | 'social_risk'           // Peer influence sensitivity
  | 'regret_aversion';      // Fear of making wrong choice

export type RiskTrait = 
  | 'conservative'
  | 'moderate'
  | 'aggressive'
  | 'loss_sensitive'
  | 'gain_seeking'
  | 'uncertainty_tolerant'
  | 'planning_oriented'
  | 'spontaneous'
  | 'peer_influenced'
  | 'independent';

export interface RiskProfile {
  id: string;
  userId: string;
  
  // Overall scores
  overallRiskScore: number; // -100 to +100
  riskLevel: 'very_conservative' | 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  
  // Domain-specific scores
  domainScores: Record<RiskDomain, DomainRiskScore>;
  
  // Detailed trait analysis
  traits: RiskTraitAnalysis[];
  
  // Behavioral patterns
  lossAversionCoefficient: number; // Typically 1.5-2.5 for most people
  ambiguityAversionLevel: number; // 0-1
  timeDiscountRate: number; // How much they discount future rewards
  
  // Risk capacity (separate from tolerance)
  riskCapacity: {
    financial: number; // Based on income, savings, obligations
    career: number;    // Based on skills, experience, market
    health: number;    // Based on age, fitness, genetics
  };
  
  // Recommendations
  recommendations: RiskRecommendation[];
  
  // Metadata
  assessmentDate: Date;
  completionTime: number; // Minutes
  consistency_score: number; // How consistent were their answers
}

export interface DomainRiskScore {
  domain: RiskDomain;
  score: number; // -100 to +100
  level: string;
  percentile: number; // Compared to others
  
  subScores: {
    pureRiskTolerance: number;
    lossAversion: number;
    ambiguityTolerance: number;
    timeHorizon: number;
  };
  
  insights: string[];
}

export interface RiskTraitAnalysis {
  trait: RiskTrait;
  strength: number; // 0-100
  description: string;
  implications: string[];
  relatedGoals: string[]; // Goal IDs that align with this trait
}

export interface RiskRecommendation {
  id: string;
  domain: RiskDomain;
  priority: 'high' | 'medium' | 'low';
  
  title: string;
  description: string;
  rationale: string;
  
  // Specific actions
  suggestedActions: string[];
  
  // Goals alignment
  alignedGoals: string[];
  conflictingGoals: string[];
  
  // Resources
  resources: {
    title: string;
    type: 'article' | 'tool' | 'professional';
    url?: string;
  }[];
}

export interface RiskAssessmentSession {
  id: string;
  userId: string;
  
  // Session state
  status: 'in_progress' | 'completed' | 'abandoned';
  currentQuestionIndex: number;
  totalQuestions: number;
  
  // Responses
  responses: QuestionResponse[];
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  
  // Quality metrics
  straightLining: boolean; // Did they answer everything the same?
  speedFlag: boolean; // Did they answer too quickly?
  inconsistencyFlag: boolean; // Contradictory answers?
  
  // Results
  profile?: RiskProfile;
}

export interface QuestionResponse {
  questionId: string;
  response: any; // Could be string, number, array depending on question type
  responseTime: number; // Seconds
  changed: boolean; // Did they change their answer?
  confidence?: number; // Optional confidence rating
  timestamp: Date;
}

/**
 * Risk calculation utilities
 */
export interface RiskCalculationParams {
  responses: QuestionResponse[];
  questions: RiskQuestion[];
  userAge?: number;
  userIncome?: number;
  userDependents?: number;
  previousProfile?: RiskProfile;
}

export interface RiskComparisonData {
  percentile: number;
  peerGroup: string;
  similarProfiles: number;
  
  distribution: {
    veryConservative: number;
    conservative: number;
    moderate: number;
    aggressive: number;
    veryAggressive: number;
  };
}

/**
 * Adaptive questioning
 */
export interface AdaptiveQuestionPath {
  baseQuestions: string[]; // Always ask these
  conditionalBranches: {
    condition: (responses: QuestionResponse[]) => boolean;
    questions: string[];
  }[];
  
  minimumQuestions: number;
  maximumQuestions: number;
  
  completionCriteria: {
    minConfidence: number; // Minimum confidence in assessment
    minConsistency: number; // Minimum consistency score
    minTime: number; // Minimum time in seconds
  };
}

/**
 * Risk education content
 */
export interface RiskEducation {
  id: string;
  title: string;
  description: string;
  
  relatedConcepts: string[];
  examples: {
    scenario: string;
    conservativeChoice: string;
    aggressiveChoice: string;
    explanation: string;
  }[];
  
  quiz?: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  };
}