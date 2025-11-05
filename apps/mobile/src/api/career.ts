/**
 * Life Navigator - Career API
 *
 * Elite-level career API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import {
  SocialAccount,
  NetworkValue,
  Skill,
  Achievement,
  ApiResponse,
} from '../types';

/**
 * Get network value summary
 * GET /career/network-value
 */
export const getNetworkValue = async (): Promise<NetworkValue> => {
  return api.get('/career/network-value');
};

/**
 * Get all connected social accounts
 * GET /career/social-accounts
 */
export const getSocialAccounts = async (): Promise<SocialAccount[]> => {
  return api.get('/career/social-accounts');
};

/**
 * Connect LinkedIn account
 * POST /career/social/linkedin/connect
 */
export const connectLinkedIn = async (
  code: string
): Promise<ApiResponse<SocialAccount>> => {
  return api.post('/career/social/linkedin/connect', { code });
};

/**
 * Sync LinkedIn data
 * POST /career/social/linkedin/sync
 */
export const syncLinkedIn = async (): Promise<ApiResponse<{ synced: boolean }>> => {
  return api.post('/career/social/linkedin/sync');
};

/**
 * Connect Twitter account
 * POST /career/social/twitter/connect
 */
export const connectTwitter = async (
  code: string
): Promise<ApiResponse<SocialAccount>> => {
  return api.post('/career/social/twitter/connect', { code });
};

/**
 * Connect Instagram account
 * POST /career/social/instagram/connect
 */
export const connectInstagram = async (
  code: string
): Promise<ApiResponse<SocialAccount>> => {
  return api.post('/career/social/instagram/connect', { code });
};

/**
 * Connect TikTok account
 * POST /career/social/tiktok/connect
 */
export const connectTikTok = async (
  code: string
): Promise<ApiResponse<SocialAccount>> => {
  return api.post('/career/social/tiktok/connect', { code });
};

/**
 * Disconnect social account
 * DELETE /career/social-accounts/:id
 */
export const disconnectSocialAccount = async (
  accountId: string
): Promise<ApiResponse<null>> => {
  return api.delete(`/career/social-accounts/${accountId}`);
};

/**
 * Get skills
 * GET /career/skills
 */
export const getSkills = async (): Promise<Skill[]> => {
  return api.get('/career/skills');
};

/**
 * Add skill
 * POST /career/skills
 */
export const addSkill = async (skill: Omit<Skill, 'id'>): Promise<Skill> => {
  return api.post('/career/skills', skill);
};

/**
 * Update skill
 * PATCH /career/skills/:id
 */
export const updateSkill = async (
  skillId: string,
  updates: Partial<Skill>
): Promise<Skill> => {
  return api.patch(`/career/skills/${skillId}`, updates);
};

/**
 * Delete skill
 * DELETE /career/skills/:id
 */
export const deleteSkill = async (skillId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/career/skills/${skillId}`);
};

/**
 * Get achievements
 * GET /career/achievements
 */
export const getAchievements = async (): Promise<Achievement[]> => {
  return api.get('/career/achievements');
};

/**
 * Add achievement
 * POST /career/achievements
 */
export const addAchievement = async (
  achievement: Omit<Achievement, 'id'>
): Promise<Achievement> => {
  return api.post('/career/achievements', achievement);
};

/**
 * Update achievement
 * PATCH /career/achievements/:id
 */
export const updateAchievement = async (
  achievementId: string,
  updates: Partial<Achievement>
): Promise<Achievement> => {
  return api.patch(`/career/achievements/${achievementId}`, updates);
};

/**
 * Delete achievement
 * DELETE /career/achievements/:id
 */
export const deleteAchievement = async (achievementId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/career/achievements/${achievementId}`);
};

export default {
  getNetworkValue,
  getSocialAccounts,
  connectLinkedIn,
  syncLinkedIn,
  connectTwitter,
  connectInstagram,
  connectTikTok,
  disconnectSocialAccount,
  getSkills,
  addSkill,
  updateSkill,
  deleteSkill,
  getAchievements,
  addAchievement,
  updateAchievement,
  deleteAchievement,
};
