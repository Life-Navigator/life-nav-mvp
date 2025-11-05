/**
 * Life Navigator - AI Agent API
 *
 * Elite-level AI agent API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import { ChatMessage, AIInsight, ApiResponse, PaginatedResponse } from '../types';

/**
 * Get chat history
 * GET /agent/chat/history
 */
export const getChatHistory = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<ChatMessage>> => {
  return api.get('/agent/chat/history', { params });
};

/**
 * Send message to AI agent
 * POST /agent/chat/message
 */
export const sendMessage = async (
  text: string
): Promise<ChatMessage> => {
  return api.post('/agent/chat/message', { text });
};

/**
 * Get AI insights
 * GET /agent/insights
 */
export const getInsights = async (params?: {
  category?: string;
  priority?: string;
  limit?: number;
}): Promise<AIInsight[]> => {
  return api.get('/agent/insights', { params });
};

/**
 * Mark insight as read
 * POST /agent/insights/:id/read
 */
export const markInsightAsRead = async (
  insightId: string
): Promise<ApiResponse<null>> => {
  return api.post(`/agent/insights/${insightId}/read`);
};

/**
 * Dismiss insight
 * DELETE /agent/insights/:id
 */
export const dismissInsight = async (
  insightId: string
): Promise<ApiResponse<null>> => {
  return api.delete(`/agent/insights/${insightId}`);
};

/**
 * Get AI recommendations
 * GET /agent/recommendations
 */
export const getRecommendations = async (params?: {
  domain?: string;
}): Promise<{
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    domain: string;
    priority: number;
  }>;
}> => {
  return api.get('/agent/recommendations', { params });
};

export default {
  getChatHistory,
  sendMessage,
  getInsights,
  markInsightAsRead,
  dismissInsight,
  getRecommendations,
};
