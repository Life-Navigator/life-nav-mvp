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
  NetworkContact,
  JobApplication,
  ApiResponse,
} from '../types';
import {
  Event,
  EventSearchParams,
  EventsResponse,
  SavedEvent,
  EventRSVP,
  LinkedInProfile,
  LinkedInConnection,
  LinkedInRecommendation,
  LinkedInShareContent,
  SocialPlatformData,
  SocialPlatformType,
  CrossPostContent,
  CrossPostResult,
  NetworkAnalytics,
  NetworkGrowthMetrics,
  InfluenceScore,
  ReachMetrics,
  NetworkInsightsResponse,
} from '../types/career';

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

/**
 * Get network contacts
 * GET /career/network
 */
export const getNetworkContacts = async (): Promise<NetworkContact[]> => {
  return api.get('/career/network');
};

/**
 * Get single network contact
 * GET /career/network/:id
 */
export const getNetworkContact = async (contactId: string): Promise<NetworkContact> => {
  return api.get(`/career/network/${contactId}`);
};

/**
 * Create network contact
 * POST /career/network
 */
export const createNetworkContact = async (
  contact: Omit<NetworkContact, 'id'>
): Promise<NetworkContact> => {
  return api.post('/career/network', contact);
};

/**
 * Update network contact
 * PATCH /career/network/:id
 */
export const updateNetworkContact = async (
  contactId: string,
  updates: Partial<NetworkContact>
): Promise<NetworkContact> => {
  return api.patch(`/career/network/${contactId}`, updates);
};

/**
 * Delete network contact
 * DELETE /career/network/:id
 */
export const deleteNetworkContact = async (contactId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/career/network/${contactId}`);
};

/**
 * Get job applications
 * GET /career/applications
 */
export const getJobApplications = async (): Promise<JobApplication[]> => {
  return api.get('/career/applications');
};

/**
 * Get single job application
 * GET /career/applications/:id
 */
export const getJobApplication = async (applicationId: string): Promise<JobApplication> => {
  return api.get(`/career/applications/${applicationId}`);
};

/**
 * Create job application
 * POST /career/applications
 */
export const createJobApplication = async (
  application: Omit<JobApplication, 'id'>
): Promise<JobApplication> => {
  return api.post('/career/applications', application);
};

/**
 * Update job application
 * PATCH /career/applications/:id
 */
export const updateJobApplication = async (
  applicationId: string,
  updates: Partial<JobApplication>
): Promise<JobApplication> => {
  return api.patch(`/career/applications/${applicationId}`, updates);
};

/**
 * Delete job application
 * DELETE /career/applications/:id
 */
export const deleteJobApplication = async (applicationId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/career/applications/${applicationId}`);
};

/**
 * =============================================================================
 * EVENT DISCOVERY APIs
 * =============================================================================
 */

/**
 * Get Eventbrite events
 * GET /career/events/eventbrite
 */
export const getEventbriteEvents = async (params: EventSearchParams): Promise<EventsResponse> => {
  return api.get('/career/events/eventbrite', { params });
};

/**
 * Get Meetup events
 * GET /career/events/meetup
 */
export const getMeetupEvents = async (params: EventSearchParams): Promise<EventsResponse> => {
  return api.get('/career/events/meetup', { params });
};

/**
 * Get Chamber of Commerce events
 * GET /career/events/chamber
 */
export const getChamberEvents = async (params: EventSearchParams): Promise<EventsResponse> => {
  return api.get('/career/events/chamber', { params });
};

/**
 * Get local business events
 * GET /career/events/local
 */
export const getLocalBusinessEvents = async (params: EventSearchParams): Promise<EventsResponse> => {
  return api.get('/career/events/local', { params });
};

/**
 * Search all events from all sources
 * GET /career/events/search
 */
export const searchAllEvents = async (params: EventSearchParams): Promise<EventsResponse> => {
  return api.get('/career/events/search', { params });
};

/**
 * Save event to user's saved list
 * POST /career/events/saved
 */
export const saveEvent = async (eventId: string, notes?: string): Promise<SavedEvent> => {
  return api.post('/career/events/saved', { eventId, notes });
};

/**
 * Unsave event
 * DELETE /career/events/saved/:eventId
 */
export const unsaveEvent = async (eventId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/career/events/saved/${eventId}`);
};

/**
 * Get user's saved events
 * GET /career/events/saved
 */
export const getSavedEvents = async (): Promise<SavedEvent[]> => {
  return api.get('/career/events/saved');
};

/**
 * RSVP to event
 * POST /career/events/rsvp
 */
export const rsvpEvent = async (
  eventId: string,
  status: 'going' | 'maybe' | 'not_going',
  notes?: string
): Promise<EventRSVP> => {
  return api.post('/career/events/rsvp', { eventId, status, notes });
};

/**
 * Get user's RSVP'd events
 * GET /career/events/rsvp
 */
export const getRSVPEvents = async (): Promise<EventRSVP[]> => {
  return api.get('/career/events/rsvp');
};

/**
 * Get single event details
 * GET /career/events/:id
 */
export const getEventDetails = async (eventId: string): Promise<Event> => {
  return api.get(`/career/events/${eventId}`);
};

/**
 * =============================================================================
 * LINKEDIN ADVANCED APIs
 * =============================================================================
 */

/**
 * Get LinkedIn profile data
 * GET /career/linkedin/profile
 */
export const getLinkedInProfile = async (): Promise<LinkedInProfile> => {
  return api.get('/career/linkedin/profile');
};

/**
 * Get LinkedIn connections
 * GET /career/linkedin/connections
 */
export const getLinkedInConnections = async (
  limit?: number,
  offset?: number
): Promise<{ connections: LinkedInConnection[]; total: number }> => {
  return api.get('/career/linkedin/connections', {
    params: { limit, offset },
  });
};

/**
 * Get AI-powered LinkedIn connection recommendations
 * GET /career/linkedin/recommendations
 */
export const getLinkedInRecommendations = async (): Promise<LinkedInRecommendation[]> => {
  return api.get('/career/linkedin/recommendations');
};

/**
 * Import LinkedIn contacts to network
 * POST /career/linkedin/import-contacts
 */
export const importLinkedInContacts = async (
  connectionIds?: string[]
): Promise<ApiResponse<{ imported: number }>> => {
  return api.post('/career/linkedin/import-contacts', { connectionIds });
};

/**
 * Share content to LinkedIn
 * POST /career/linkedin/share
 */
export const shareToLinkedIn = async (
  content: LinkedInShareContent
): Promise<ApiResponse<{ postId: string; postUrl: string }>> => {
  return api.post('/career/linkedin/share', content);
};

/**
 * =============================================================================
 * SOCIAL MEDIA ENGAGEMENT APIs
 * =============================================================================
 */

/**
 * Get Twitter/X followers
 * GET /career/twitter/followers
 */
export const getTwitterFollowers = async (): Promise<SocialPlatformData> => {
  return api.get('/career/twitter/followers');
};

/**
 * Get Instagram followers
 * GET /career/instagram/followers
 */
export const getInstagramFollowers = async (): Promise<SocialPlatformData> => {
  return api.get('/career/instagram/followers');
};

/**
 * Get TikTok followers
 * GET /career/tiktok/followers
 */
export const getTikTokFollowers = async (): Promise<SocialPlatformData> => {
  return api.get('/career/tiktok/followers');
};

/**
 * Get Twitter engagement analytics
 * GET /career/twitter/engagement
 */
export const getTwitterEngagement = async (days?: number): Promise<SocialPlatformData> => {
  return api.get('/career/twitter/engagement', { params: { days } });
};

/**
 * Get Instagram engagement analytics
 * GET /career/instagram/engagement
 */
export const getInstagramEngagement = async (days?: number): Promise<SocialPlatformData> => {
  return api.get('/career/instagram/engagement', { params: { days } });
};

/**
 * Get TikTok engagement analytics
 * GET /career/tiktok/engagement
 */
export const getTikTokEngagement = async (days?: number): Promise<SocialPlatformData> => {
  return api.get('/career/tiktok/engagement', { params: { days } });
};

/**
 * Cross-post content to multiple platforms
 * POST /career/social/cross-post
 */
export const crossPostContent = async (
  content: CrossPostContent
): Promise<CrossPostResult[]> => {
  return api.post('/career/social/cross-post', content);
};

/**
 * Get social platform data by platform type
 * GET /career/social/:platform
 */
export const getSocialPlatformData = async (
  platform: SocialPlatformType
): Promise<SocialPlatformData> => {
  return api.get(`/career/social/${platform}`);
};

/**
 * =============================================================================
 * NETWORK ANALYTICS APIs
 * =============================================================================
 */

/**
 * Get network growth metrics
 * GET /career/network/growth
 */
export const getNetworkGrowth = async (
  startDate?: string,
  endDate?: string
): Promise<NetworkGrowthMetrics> => {
  return api.get('/career/network/growth', {
    params: { startDate, endDate },
  });
};

/**
 * Get AI-powered network insights
 * GET /career/network/insights
 */
export const getNetworkInsights = async (): Promise<NetworkInsightsResponse> => {
  return api.get('/career/network/insights');
};

/**
 * Get influence score
 * GET /career/network/influence-score
 */
export const getInfluenceScore = async (): Promise<InfluenceScore> => {
  return api.get('/career/network/influence-score');
};

/**
 * Get reach metrics
 * GET /career/network/reach
 */
export const getReachMetrics = async (): Promise<ReachMetrics> => {
  return api.get('/career/network/reach');
};

/**
 * Get comprehensive network analytics
 * GET /career/network/analytics
 */
export const getNetworkAnalytics = async (): Promise<NetworkAnalytics> => {
  return api.get('/career/network/analytics');
};

/**
 * Sync all social platform data
 * POST /career/social/sync-all
 */
export const syncAllSocialPlatforms = async (): Promise<ApiResponse<{ synced: string[] }>> => {
  return api.post('/career/social/sync-all');
};

export default {
  // Original APIs
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
  getNetworkContacts,
  getNetworkContact,
  createNetworkContact,
  updateNetworkContact,
  deleteNetworkContact,
  getJobApplications,
  getJobApplication,
  createJobApplication,
  updateJobApplication,
  deleteJobApplication,

  // Event Discovery APIs
  getEventbriteEvents,
  getMeetupEvents,
  getChamberEvents,
  getLocalBusinessEvents,
  searchAllEvents,
  saveEvent,
  unsaveEvent,
  getSavedEvents,
  rsvpEvent,
  getRSVPEvents,
  getEventDetails,

  // LinkedIn Advanced APIs
  getLinkedInProfile,
  getLinkedInConnections,
  getLinkedInRecommendations,
  importLinkedInContacts,
  shareToLinkedIn,

  // Social Media Engagement APIs
  getTwitterFollowers,
  getInstagramFollowers,
  getTikTokFollowers,
  getTwitterEngagement,
  getInstagramEngagement,
  getTikTokEngagement,
  crossPostContent,
  getSocialPlatformData,

  // Network Analytics APIs
  getNetworkGrowth,
  getNetworkInsights,
  getInfluenceScore,
  getReachMetrics,
  getNetworkAnalytics,
  syncAllSocialPlatforms,
};
