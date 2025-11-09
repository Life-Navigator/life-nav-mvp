/**
 * Life Navigator - Analytics Types
 *
 * Type definitions for analytics dashboard data structures
 */

export interface DomainScore {
  domain: 'health' | 'finance' | 'career' | 'education';
  score: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface LifeScore {
  overall: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
  lastUpdated: string;
}

export interface CrossDomainInsight {
  id: string;
  title: string;
  description: string;
  impactScore: number;
  priority: 'high' | 'medium' | 'low';
  domains: string[];
  type: 'recommendation' | 'risk' | 'opportunity';
  actionable: boolean;
}

export interface TrendDataPoint {
  date: string;
  health: number;
  finance: number;
  career: number;
  education: number;
}

export interface TimeAllocation {
  domain: string;
  hours: number;
  percentage: number;
  color: string;
}

export interface GoalCompletion {
  domain: string;
  completed: number;
  total: number;
  percentage: number;
}

export interface PeriodComparison {
  period: 'week' | 'month' | 'quarter' | 'year';
  current: number;
  previous: number;
  change: number;
  percentageChange: number;
}

export interface DomainComparison {
  domain: string;
  comparisons: PeriodComparison[];
}

export interface PredictiveAnalytics {
  domain: string;
  predictions: {
    date: string;
    predictedScore: number;
    confidence: number;
  }[];
  goalCompletionProbability: number;
  risks: {
    type: string;
    probability: number;
    impact: string;
  }[];
  opportunities: {
    type: string;
    window: string;
    potential: string;
  }[];
}

export interface AnalyticsDashboardData {
  lifeScore: LifeScore;
  domainScores: DomainScore[];
  insights: CrossDomainInsight[];
  trendData: TrendDataPoint[];
  timeAllocation: TimeAllocation[];
  goalCompletion: GoalCompletion[];
  comparisons: DomainComparison[];
  predictions: PredictiveAnalytics[];
}

export interface ChartConfig {
  backgroundColor?: string;
  backgroundGradientFrom?: string;
  backgroundGradientTo?: string;
  decimalPlaces?: number;
  color?: (opacity: number) => string;
  labelColor?: (opacity: number) => string;
  style?: {
    borderRadius?: number;
  };
  propsForDots?: {
    r?: string;
    strokeWidth?: string;
    stroke?: string;
  };
}
