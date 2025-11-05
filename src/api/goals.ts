/**
 * Life Navigator - Goals API
 *
 * Elite-level goals API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import { Goal, Milestone, ApiResponse } from '../types';

/**
 * Get all goals
 * GET /goals
 */
export const getGoals = async (params?: {
  status?: string;
  category?: string;
}): Promise<Goal[]> => {
  return api.get('/goals', { params });
};

/**
 * Get single goal by ID
 * GET /goals/:id
 */
export const getGoal = async (goalId: string): Promise<Goal> => {
  return api.get(`/goals/${goalId}`);
};

/**
 * Create goal
 * POST /goals
 */
export const createGoal = async (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Goal> => {
  return api.post('/goals', goal);
};

/**
 * Update goal
 * PATCH /goals/:id
 */
export const updateGoal = async (
  goalId: string,
  updates: Partial<Goal>
): Promise<Goal> => {
  return api.patch(`/goals/${goalId}`, updates);
};

/**
 * Update goal progress
 * POST /goals/:id/progress
 */
export const updateGoalProgress = async (
  goalId: string,
  progress: number
): Promise<Goal> => {
  return api.post(`/goals/${goalId}/progress`, { progress });
};

/**
 * Mark goal as completed
 * POST /goals/:id/complete
 */
export const completeGoal = async (goalId: string): Promise<Goal> => {
  return api.post(`/goals/${goalId}/complete`);
};

/**
 * Delete goal
 * DELETE /goals/:id
 */
export const deleteGoal = async (goalId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/goals/${goalId}`);
};

/**
 * Get goal milestones
 * GET /goals/:id/milestones
 */
export const getGoalMilestones = async (goalId: string): Promise<Milestone[]> => {
  return api.get(`/goals/${goalId}/milestones`);
};

/**
 * Create milestone
 * POST /goals/:id/milestones
 */
export const createMilestone = async (
  goalId: string,
  milestone: Omit<Milestone, 'id' | 'goalId'>
): Promise<Milestone> => {
  return api.post(`/goals/${goalId}/milestones`, milestone);
};

/**
 * Update milestone
 * PATCH /goals/:goalId/milestones/:milestoneId
 */
export const updateMilestone = async (
  goalId: string,
  milestoneId: string,
  updates: Partial<Milestone>
): Promise<Milestone> => {
  return api.patch(`/goals/${goalId}/milestones/${milestoneId}`, updates);
};

/**
 * Complete milestone
 * POST /goals/:goalId/milestones/:milestoneId/complete
 */
export const completeMilestone = async (
  goalId: string,
  milestoneId: string
): Promise<Milestone> => {
  return api.post(`/goals/${goalId}/milestones/${milestoneId}/complete`);
};

/**
 * Delete milestone
 * DELETE /goals/:goalId/milestones/:milestoneId
 */
export const deleteMilestone = async (
  goalId: string,
  milestoneId: string
): Promise<ApiResponse<null>> => {
  return api.delete(`/goals/${goalId}/milestones/${milestoneId}`);
};

/**
 * Get goal statistics
 * GET /goals/statistics
 */
export const getGoalStatistics = async (): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  atRisk: number;
  completionRate: number;
}> => {
  return api.get('/goals/statistics');
};

export default {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  updateGoalProgress,
  completeGoal,
  deleteGoal,
  getGoalMilestones,
  createMilestone,
  updateMilestone,
  completeMilestone,
  deleteMilestone,
  getGoalStatistics,
};
