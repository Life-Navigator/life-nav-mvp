/**
 * MyBlocks-Style Goal Management Types
 * Based on MoneyGuidePro's visual goal planning system
 */

import { Domain } from '@/lib/benefits/benefit-tags';

export type GoalStatus = 'not_started' | 'in_progress' | 'on_track' | 'at_risk' | 'completed' | 'deferred';
export type GoalPriority = 'essential' | 'important' | 'nice_to_have';
export type GoalCategory = 'retirement' | 'education' | 'purchase' | 'protection' | 'lifestyle' | 'wealth' | 'health' | 'career' | 'custom';

export interface Goal {
  id: string;
  userId: string;
  
  // Basic Information
  title: string;
  description: string;
  domain: Domain;
  category: GoalCategory;
  
  // Timeline
  startDate: Date;
  targetDate: Date;
  completedDate?: Date;
  
  // Financial Details
  targetAmount?: number;
  currentAmount?: number;
  monthlyContribution?: number;
  estimatedReturn?: number; // Annual percentage
  
  // Priority & Status
  priority: GoalPriority;
  status: GoalStatus;
  progress: number; // 0-100 percentage
  
  // Dependencies
  prerequisites: string[]; // Goal IDs that must be completed first
  dependents: string[]; // Goals that depend on this one
  conflictsWith?: string[]; // Goals that conflict with this one
  
  // Psychological Alignment (from Benefits Discovery)
  primaryBenefits: string[]; // Benefit tag IDs this goal serves
  alignmentScore: number; // 0-100 how well aligned with user's authentic motivations
  motivationNotes?: string; // From Discovery conversation
  
  // Visual Properties for Timeline
  color: string; // Hex color for the goal block
  icon: string; // Emoji or icon name
  position?: {
    row: number; // Which row on the timeline (for parallel goals)
    startX?: number; // Calculated position
    width?: number; // Calculated width based on duration
  };
  
  // Milestones
  milestones: Milestone[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // AI Insights
  aiRecommendations?: string[];
  riskFactors?: string[];
  opportunityWindows?: string[];
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  targetDate: Date;
  targetAmount?: number;
  completed: boolean;
  completedDate?: Date;
  order: number; // Order within the goal
}

export interface GoalBlock {
  goal: Goal;
  x: number; // Position on timeline
  y: number; // Vertical position (row)
  width: number; // Width based on duration
  height: number; // Fixed height
  isSelected: boolean;
  isDragging: boolean;
  isHovered: boolean;
}

export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  view: 'months' | 'quarters' | 'years' | 'decades';
  zoom: number; // 0.5 to 2.0
  rows: number; // Number of rows for parallel goals
}

/**
 * Pre-defined goal templates based on common patterns
 */
export const GOAL_TEMPLATES: Partial<Goal>[] = [
  // Financial Goals
  {
    title: 'Emergency Fund',
    category: 'protection',
    domain: 'financial',
    description: 'Build 6 months of living expenses',
    icon: '🛡️',
    color: '#3B82F6',
    priority: 'essential',
  },
  {
    title: 'Retirement',
    category: 'retirement',
    domain: 'financial',
    description: 'Financial independence by retirement age',
    icon: '🏖️',
    color: '#10B981',
    priority: 'essential',
  },
  {
    title: 'House Down Payment',
    category: 'purchase',
    domain: 'financial',
    description: 'Save for home purchase',
    icon: '🏠',
    color: '#8B5CF6',
    priority: 'important',
  },
  {
    title: 'College Fund',
    category: 'education',
    domain: 'financial',
    description: "Children's education savings",
    icon: '🎓',
    color: '#F59E0B',
    priority: 'important',
  },
  
  // Career Goals
  {
    title: 'Career Advancement',
    category: 'career',
    domain: 'career',
    description: 'Reach next level in career',
    icon: '📈',
    color: '#06B6D4',
    priority: 'important',
  },
  {
    title: 'Skill Development',
    category: 'education',
    domain: 'career',
    description: 'Learn new professional skills',
    icon: '💡',
    color: '#84CC16',
    priority: 'important',
  },
  
  // Health Goals
  {
    title: 'Health & Fitness',
    category: 'health',
    domain: 'health',
    description: 'Achieve optimal health',
    icon: '💪',
    color: '#EF4444',
    priority: 'essential',
  },
  {
    title: 'Preventive Care',
    category: 'health',
    domain: 'health',
    description: 'Regular health screenings',
    icon: '🏥',
    color: '#EC4899',
    priority: 'essential',
  },
];

/**
 * Goal calculation helpers
 */
export function calculateGoalProgress(goal: Goal): number {
  if (goal.status === 'completed') return 100;
  if (goal.status === 'not_started') return 0;
  
  // Financial goals with amounts
  if (goal.targetAmount && goal.currentAmount) {
    return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
  }
  
  // Time-based progress
  const now = new Date();
  const start = new Date(goal.startDate);
  const target = new Date(goal.targetDate);
  
  if (now < start) return 0;
  if (now > target) return 100;
  
  const totalDuration = target.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  
  return Math.round((elapsed / totalDuration) * 100);
}

export function calculateMonthlyContribution(
  targetAmount: number,
  currentAmount: number,
  monthsRemaining: number,
  annualReturn: number = 0
): number {
  if (monthsRemaining <= 0) return 0;
  
  const remainingAmount = targetAmount - currentAmount;
  
  if (annualReturn === 0) {
    return remainingAmount / monthsRemaining;
  }
  
  // Calculate with compound interest
  const monthlyRate = annualReturn / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, monthsRemaining) - 1;
  
  return remainingAmount / (factor / monthlyRate);
}

export function getGoalStatusColor(status: GoalStatus): string {
  switch (status) {
    case 'completed': return 'text-green-600 bg-green-100';
    case 'on_track': return 'text-blue-600 bg-blue-100';
    case 'in_progress': return 'text-yellow-600 bg-yellow-100';
    case 'at_risk': return 'text-red-600 bg-red-100';
    case 'deferred': return 'text-gray-600 bg-gray-100';
    default: return 'text-gray-500 bg-gray-50';
  }
}

export function getGoalPriorityBadge(priority: GoalPriority): string {
  switch (priority) {
    case 'essential': return '🔴 Essential';
    case 'important': return '🟡 Important';
    case 'nice_to_have': return '🟢 Nice to Have';
  }
}