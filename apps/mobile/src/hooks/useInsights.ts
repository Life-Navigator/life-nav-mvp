/**
 * Life Navigator - AI Insights Hooks
 *
 * React Query hooks for AI insights, patterns, and predictions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface AIInsight {
  id: string;
  type: 'recommendation' | 'pattern' | 'anomaly' | 'optimization' | 'goal' | 'integration' | 'prediction' | 'risk' | 'benchmark' | 'reminder';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  domain: string[];
  actionItems?: ActionItem[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: string;
  lastOccurrence: string;
  trend: 'improving' | 'declining' | 'stable';
}

export interface Prediction {
  id: string;
  goalId: string;
  goalName: string;
  successProbability: number;
  estimatedCompletion: string;
  factors: string[];
}

/**
 * Query Keys for cache management
 */
export const insightsKeys = {
  all: ['insights'] as const,
  list: (filter?: string) => [...insightsKeys.all, 'list', filter] as const,
  patterns: () => [...insightsKeys.all, 'patterns'] as const,
  predictions: () => [...insightsKeys.all, 'predictions'] as const,
  detail: (id: string) => [...insightsKeys.all, 'detail', id] as const,
};

/**
 * Fetch AI insights
 */
export const useInsights = (filter?: 'all' | 'recommendations' | 'patterns' | 'predictions') => {
  return useQuery<AIInsight[]>({
    queryKey: insightsKeys.list(filter),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/insights?filter=${filter || 'all'}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
  });
};

/**
 * Fetch detected patterns
 */
export const usePatterns = () => {
  return useQuery<Pattern[]>({
    queryKey: insightsKeys.patterns(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/insights/patterns');
      if (!response.ok) throw new Error('Failed to fetch patterns');
      return response.json();
    },
  });
};

/**
 * Fetch success predictions
 */
export const usePredictions = () => {
  return useQuery<Prediction[]>({
    queryKey: insightsKeys.predictions(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/insights/predictions');
      if (!response.ok) throw new Error('Failed to fetch predictions');
      return response.json();
    },
  });
};

/**
 * Complete action item
 */
export const useCompleteActionItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ insightId, actionId }: { insightId: string; actionId: string }) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/insights/${insightId}/actions/${actionId}/complete`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to complete action');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightsKeys.all });
    },
  });
};

/**
 * Dismiss insight
 */
export const useDismissInsight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insightId: string) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/insights/${insightId}/dismiss`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to dismiss insight');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightsKeys.all });
    },
  });
};

/**
 * Refresh insights (trigger AI analysis)
 */
export const useRefreshInsights = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/insights/refresh', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to refresh insights');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightsKeys.all });
    },
  });
};

export default {
  useInsights,
  usePatterns,
  usePredictions,
  useCompleteActionItem,
  useDismissInsight,
  useRefreshInsights,
};
