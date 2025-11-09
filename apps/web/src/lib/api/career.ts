/**
 * Career domain API client
 */
import { apiClient } from './client';
import type { 
  CareerRecord,
  Skill,
  JobApplication,
  JobApplicationCreate,
  JobApplicationUpdate, 
  NetworkingEvent,
  CareerOverview,
  JobRecommendation,
  JobSearchParams,
  JobSearchResult,
  InterviewPrepResource
} from '@/types/career';

export const getCareerRecord = () =>
  apiClient.get<CareerRecord>('/career/record');

export const updateCareerRecord = (data: Partial<CareerRecord>) =>
  apiClient.patch<CareerRecord>('/career/record', data);

export const getOverview = () =>
  apiClient.get<CareerOverview>('/career/overview');

// Skills API
export const getSkills = () =>
  apiClient.get<Skill[]>('/career/skills');

export const addSkill = (data: Omit<Skill, 'id' | 'careerRecordId' | 'createdAt' | 'updatedAt'>) =>
  apiClient.post<Skill>('/career/skills', data);

export const updateSkill = (id: string, data: Partial<Skill>) =>
  apiClient.patch<Skill>(`/career/skills/${id}`, data);

export const deleteSkill = (id: string) =>
  apiClient.delete(`/career/skills/${id}`);

// Job Applications API
export const getJobApplications = () =>
  apiClient.get<JobApplication[]>('/career/applications');

export const getJobApplication = (id: string) =>
  apiClient.get<JobApplication>(`/career/applications/${id}`);

export const createJobApplication = (data: JobApplicationCreate) =>
  apiClient.post<JobApplication>('/career/applications', data);

export const updateJobApplication = (id: string, data: JobApplicationUpdate) =>
  apiClient.patch<JobApplication>(`/career/applications/${id}`, data);

export const deleteJobApplication = (id: string) =>
  apiClient.delete(`/career/applications/${id}`);

// Networking API
export const getNetworkingEvents = () =>
  apiClient.get<NetworkingEvent[]>('/career/networking');

export const createNetworkingEvent = (data: Omit<NetworkingEvent, 'id' | 'careerRecordId' | 'createdAt' | 'updatedAt'>) =>
  apiClient.post<NetworkingEvent>('/career/networking', data);

export const updateNetworkingEvent = (id: string, data: Partial<NetworkingEvent>) =>
  apiClient.patch<NetworkingEvent>(`/career/networking/${id}`, data);

export const deleteNetworkingEvent = (id: string) =>
  apiClient.delete(`/career/networking/${id}`);

// Job Recommendations API
export const getJobRecommendations = (limit: number = 10) =>
  apiClient.get<JobRecommendation[]>(`/career/recommendations?limit=${limit}`);

// Job Search API
export const searchJobs = (params: JobSearchParams) => {
  const queryParams = new URLSearchParams();
  
  if (params.keywords) queryParams.append('keywords', params.keywords);
  if (params.location) queryParams.append('location', params.location);
  if (params.jobType && params.jobType !== 'any') queryParams.append('jobType', params.jobType);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return apiClient.get<JobSearchResult>(`/career/jobs/search${query}`);
};

// Interview Preparation API
export const getInterviewPrep = (jobTitle: string) =>
  apiClient.get<InterviewPrepResource>(`/career/interview-prep?jobTitle=${encodeURIComponent(jobTitle)}`);

// Event Discovery APIs
export const getEventbriteEvents = (params: any) =>
  apiClient.get('/career/events/eventbrite', { params });

export const getMeetupEvents = (params: any) =>
  apiClient.get('/career/events/meetup', { params });

export const getChamberEvents = (params: any) =>
  apiClient.get('/career/events/chamber', { params });

export const getLocalEvents = (params: any) =>
  apiClient.get('/career/events/local', { params });

export const searchAllEvents = (params: any) =>
  apiClient.get('/career/events/search', { params });

export const saveEvent = (eventId: string) =>
  apiClient.post(`/career/events/${eventId}/save`, {});

export const unsaveEvent = (eventId: string) =>
  apiClient.delete(`/career/events/${eventId}/save`);

export const getSavedEvents = () =>
  apiClient.get('/career/events/saved');

export const rsvpToEvent = (eventId: string, response: 'attending' | 'interested' | 'not_attending') =>
  apiClient.post(`/career/events/${eventId}/rsvp`, { response });

export const getNearbyEvents = (latitude: number, longitude: number, radius: number = 25) =>
  apiClient.get('/career/events/nearby', { params: { latitude, longitude, radius } });

// LinkedIn Advanced APIs
export const getLinkedInProfile = () =>
  apiClient.get('/career/linkedin/profile');

export const getLinkedInConnections = () =>
  apiClient.get('/career/linkedin/connections');

export const getLinkedInRecommendations = () =>
  apiClient.get('/career/linkedin/recommendations');

export const connectLinkedIn = (authCode: string) =>
  apiClient.post('/career/linkedin/connect', { code: authCode });

export const importLinkedInContacts = () =>
  apiClient.post('/career/linkedin/import-contacts', {});

// Social Media APIs
export const getConnectedSocialAccounts = () =>
  apiClient.get('/career/social/accounts');

export const connectTwitter = (authCode: string) =>
  apiClient.post('/career/social/twitter/connect', { code: authCode });

export const connectInstagram = (authCode: string) =>
  apiClient.post('/career/social/instagram/connect', { code: authCode });

export const connectTikTok = (authCode: string) =>
  apiClient.post('/career/social/tiktok/connect', { code: authCode });

export const disconnectSocialAccount = (platform: string) =>
  apiClient.delete(`/career/social/${platform}/disconnect`);

export const getSocialAnalytics = (platform: string) =>
  apiClient.get(`/career/social/${platform}/analytics`);

export const crossPostContent = (content: any) =>
  apiClient.post('/career/social/cross-post', content);

export const schedulePost = (post: any) =>
  apiClient.post('/career/social/schedule', post);

// Network Analytics APIs
export const getNetworkAnalytics = () =>
  apiClient.get('/career/analytics/network');

export const getInfluenceScore = () =>
  apiClient.get('/career/analytics/influence-score');

export const getNetworkGrowth = (params?: { startDate?: string; endDate?: string }) =>
  apiClient.get('/career/analytics/network-growth', { params });

export const getEngagementMetrics = () =>
  apiClient.get('/career/analytics/engagement');

export const getIndustryDistribution = () =>
  apiClient.get('/career/analytics/industry-distribution');

export const getGeographicDistribution = () =>
  apiClient.get('/career/analytics/geographic-distribution');

// Job Board Integrations
export const getLinkedInJobs = (params?: any) =>
  apiClient.get('/career/jobs/linkedin', { params });

export const getIndeedJobs = (params?: any) =>
  apiClient.get('/career/jobs/indeed', { params });

export const getAllJobs = (params?: any) =>
  apiClient.get('/career/jobs/all', { params });

export const getRecommendedJobs = () =>
  apiClient.get('/career/jobs/recommended');

export const saveJob = (jobId: string, platform: string) =>
  apiClient.post('/career/jobs/save', { jobId, platform });

export const unsaveJob = (jobId: string) =>
  apiClient.delete(`/career/jobs/saved/${jobId}`);

export const getSavedJobs = () =>
  apiClient.get('/career/jobs/saved');

export const applyToJob = (jobId: string, platform: string, applicationData: any) =>
  apiClient.post('/career/jobs/apply', { jobId, platform, ...applicationData });

export const trackJobApplication = (data: any) =>
  apiClient.post('/career/jobs/track-application', data);

// Freelance Platform Integrations
export const getUpworkGigs = (params?: any) =>
  apiClient.get('/career/gigs/upwork', { params });

export const getFiverrGigs = (params?: any) =>
  apiClient.get('/career/gigs/fiverr', { params });

export const getFreelancerGigs = (params?: any) =>
  apiClient.get('/career/gigs/freelancer', { params });

export const getAllGigs = (params?: any) =>
  apiClient.get('/career/gigs/all', { params });

export const getRecommendedGigs = () =>
  apiClient.get('/career/gigs/recommended');

export const saveGig = (gigId: string, platform: string) =>
  apiClient.post('/career/gigs/save', { gigId, platform });

export const unsaveGig = (gigId: string) =>
  apiClient.delete(`/career/gigs/saved/${gigId}`);

export const getSavedGigs = () =>
  apiClient.get('/career/gigs/saved');

export const applyToGig = (gigId: string, platform: string, proposalData: any) =>
  apiClient.post('/career/gigs/apply', { gigId, platform, ...proposalData });

// Profile Matching & Analytics
export const getProfileMatchScore = (jobId: string) =>
  apiClient.get(`/career/jobs/${jobId}/match-score`);

export const getSkillGaps = (jobId: string) =>
  apiClient.get(`/career/jobs/${jobId}/skill-gaps`);

export const getApplicationStats = () =>
  apiClient.get('/career/applications/stats');

export const getJobMarketInsights = () =>
  apiClient.get('/career/jobs/market-insights');