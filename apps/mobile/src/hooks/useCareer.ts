/**
 * Life Navigator - Career Data Hooks
 *
 * Elite-level React Query hooks for career data fetching
 * NO MOCK DATA - All data from real API endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as careerApi from '../api/career';
import {
  Skill,
  NetworkContact,
  JobApplication,
} from '../types';

/**
 * Query Keys for cache management
 */
export const careerKeys = {
  all: ['career'] as const,
  skills: () => [...careerKeys.all, 'skills'] as const,
  skill: (id: string) => [...careerKeys.skills(), id] as const,
  network: () => [...careerKeys.all, 'network'] as const,
  contact: (id: string) => [...careerKeys.network(), id] as const,
  applications: () => [...careerKeys.all, 'applications'] as const,
  application: (id: string) => [...careerKeys.applications(), id] as const,
};

/**
 * Fetch all skills
 */
export const useSkills = () => {
  return useQuery({
    queryKey: careerKeys.skills(),
    queryFn: careerApi.getSkills,
  });
};

/**
 * Create skill
 */
export const useCreateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.addSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.skills() });
    },
  });
};

/**
 * Update skill
 */
export const useUpdateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Skill> }) =>
      careerApi.updateSkill(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.skills() });
    },
  });
};

/**
 * Delete skill
 */
export const useDeleteSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.deleteSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.skills() });
    },
  });
};

/**
 * Fetch network contacts
 */
export const useNetworkContacts = () => {
  return useQuery({
    queryKey: careerKeys.network(),
    queryFn: careerApi.getNetworkContacts,
  });
};

/**
 * Fetch single contact
 */
export const useNetworkContact = (contactId: string) => {
  return useQuery({
    queryKey: careerKeys.contact(contactId),
    queryFn: () => careerApi.getNetworkContact(contactId),
    enabled: !!contactId,
  });
};

/**
 * Create network contact
 */
export const useCreateNetworkContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.createNetworkContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.network() });
    },
  });
};

/**
 * Update network contact
 */
export const useUpdateNetworkContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NetworkContact> }) =>
      careerApi.updateNetworkContact(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.network() });
    },
  });
};

/**
 * Delete network contact
 */
export const useDeleteNetworkContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.deleteNetworkContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.network() });
    },
  });
};

/**
 * Fetch job applications
 */
export const useJobApplications = () => {
  return useQuery({
    queryKey: careerKeys.applications(),
    queryFn: careerApi.getJobApplications,
  });
};

/**
 * Fetch single job application
 */
export const useJobApplication = (applicationId: string) => {
  return useQuery({
    queryKey: careerKeys.application(applicationId),
    queryFn: () => careerApi.getJobApplication(applicationId),
    enabled: !!applicationId,
  });
};

/**
 * Create job application
 */
export const useCreateJobApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.createJobApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
    },
  });
};

/**
 * Update job application
 */
export const useUpdateJobApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JobApplication> }) =>
      careerApi.updateJobApplication(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
    },
  });
};

/**
 * Delete job application
 */
export const useDeleteJobApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.deleteJobApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
    },
  });
};

/**
 * =============================================================================
 * EVENT DISCOVERY HOOKS
 * =============================================================================
 */

/**
 * Fetch Eventbrite events
 */
export const useEventbriteEvents = (params: any) => {
  return useQuery({
    queryKey: ['events', 'eventbrite', params],
    queryFn: () => careerApi.getEventbriteEvents(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch Meetup events
 */
export const useMeetupEvents = (params: any) => {
  return useQuery({
    queryKey: ['events', 'meetup', params],
    queryFn: () => careerApi.getMeetupEvents(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch Chamber of Commerce events
 */
export const useChamberEvents = (params: any) => {
  return useQuery({
    queryKey: ['events', 'chamber', params],
    queryFn: () => careerApi.getChamberEvents(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch local business events
 */
export const useLocalBusinessEvents = (params: any) => {
  return useQuery({
    queryKey: ['events', 'local', params],
    queryFn: () => careerApi.getLocalBusinessEvents(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Search all events from all sources
 */
export const useSearchAllEvents = (params: any) => {
  return useQuery({
    queryKey: ['events', 'search', params],
    queryFn: () => careerApi.searchAllEvents(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Save event to user's saved list
 */
export const useSaveEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, notes }: { eventId: string; notes?: string }) =>
      careerApi.saveEvent(eventId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['saved-events'] });
    },
  });
};

/**
 * Unsave event
 */
export const useUnsaveEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.unsaveEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

/**
 * Fetch user's saved events
 */
export const useSavedEvents = () => {
  return useQuery({
    queryKey: ['saved-events'],
    queryFn: careerApi.getSavedEvents,
    refetchOnWindowFocus: false,
  });
};

/**
 * RSVP to event
 */
export const useRsvpEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, status, notes }: { eventId: string; status: 'going' | 'maybe' | 'not_going'; notes?: string }) =>
      careerApi.rsvpEvent(eventId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['rsvp-events'] });
      queryClient.invalidateQueries({ queryKey: ['saved-events'] });
    },
  });
};

/**
 * Fetch user's RSVP'd events
 */
export const useRSVPEvents = () => {
  return useQuery({
    queryKey: ['rsvp-events'],
    queryFn: careerApi.getRSVPEvents,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch single event details
 */
export const useEventDetails = (eventId: string) => {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: () => careerApi.getEventDetails(eventId),
    enabled: !!eventId,
    refetchOnWindowFocus: false,
  });
};

/**
 * =============================================================================
 * LINKEDIN ADVANCED HOOKS
 * =============================================================================
 */

/**
 * Fetch LinkedIn profile data
 */
export const useLinkedInProfile = () => {
  return useQuery({
    queryKey: ['linkedin', 'profile'],
    queryFn: careerApi.getLinkedInProfile,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch LinkedIn connections
 */
export const useLinkedInConnections = (limit?: number, offset?: number) => {
  return useQuery({
    queryKey: ['linkedin', 'connections', limit, offset],
    queryFn: () => careerApi.getLinkedInConnections(limit, offset),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch AI-powered LinkedIn connection recommendations
 */
export const useLinkedInRecommendations = () => {
  return useQuery({
    queryKey: ['linkedin', 'recommendations'],
    queryFn: careerApi.getLinkedInRecommendations,
    refetchOnWindowFocus: false,
  });
};

/**
 * Import LinkedIn contacts to network
 */
export const useImportLinkedInContacts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionIds?: string[]) => careerApi.importLinkedInContacts(connectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.network() });
      queryClient.invalidateQueries({ queryKey: ['linkedin', 'connections'] });
    },
  });
};

/**
 * Share content to LinkedIn
 */
export const useShareToLinkedIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.shareToLinkedIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin', 'profile'] });
    },
  });
};

/**
 * =============================================================================
 * SOCIAL MEDIA ENGAGEMENT HOOKS
 * =============================================================================
 */

/**
 * Fetch Twitter/X followers
 */
export const useTwitterFollowers = () => {
  return useQuery({
    queryKey: ['social', 'twitter', 'followers'],
    queryFn: careerApi.getTwitterFollowers,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch Instagram followers
 */
export const useInstagramFollowers = () => {
  return useQuery({
    queryKey: ['social', 'instagram', 'followers'],
    queryFn: careerApi.getInstagramFollowers,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch TikTok followers
 */
export const useTikTokFollowers = () => {
  return useQuery({
    queryKey: ['social', 'tiktok', 'followers'],
    queryFn: careerApi.getTikTokFollowers,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch Twitter engagement analytics
 */
export const useTwitterEngagement = (days?: number) => {
  return useQuery({
    queryKey: ['social', 'twitter', 'engagement', days],
    queryFn: () => careerApi.getTwitterEngagement(days),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch Instagram engagement analytics
 */
export const useInstagramEngagement = (days?: number) => {
  return useQuery({
    queryKey: ['social', 'instagram', 'engagement', days],
    queryFn: () => careerApi.getInstagramEngagement(days),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch TikTok engagement analytics
 */
export const useTikTokEngagement = (days?: number) => {
  return useQuery({
    queryKey: ['social', 'tiktok', 'engagement', days],
    queryFn: () => careerApi.getTikTokEngagement(days),
    refetchOnWindowFocus: false,
  });
};

/**
 * Cross-post content to multiple platforms
 */
export const useCrossPostContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.crossPostContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social'] });
      queryClient.invalidateQueries({ queryKey: ['network-analytics'] });
    },
  });
};

/**
 * Fetch social platform data by platform type
 */
export const useSocialPlatformData = (platform: string) => {
  return useQuery({
    queryKey: ['social', platform],
    queryFn: () => careerApi.getSocialPlatformData(platform as any),
    enabled: !!platform,
    refetchOnWindowFocus: false,
  });
};

/**
 * =============================================================================
 * NETWORK ANALYTICS HOOKS
 * =============================================================================
 */

/**
 * Fetch network growth metrics
 */
export const useNetworkGrowth = (params?: { startDate?: string; endDate?: string }) => {
  return useQuery({
    queryKey: ['network-analytics', 'growth', params],
    queryFn: () => careerApi.getNetworkGrowth(params?.startDate, params?.endDate),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch AI-powered network insights
 */
export const useNetworkInsights = () => {
  return useQuery({
    queryKey: ['network-analytics', 'insights'],
    queryFn: careerApi.getNetworkInsights,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch influence score
 */
export const useInfluenceScore = () => {
  return useQuery({
    queryKey: ['network-analytics', 'influence-score'],
    queryFn: careerApi.getInfluenceScore,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch reach metrics
 */
export const useReachMetrics = () => {
  return useQuery({
    queryKey: ['network-analytics', 'reach'],
    queryFn: careerApi.getReachMetrics,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch comprehensive network analytics
 */
export const useNetworkAnalytics = () => {
  return useQuery({
    queryKey: ['network-analytics'],
    queryFn: careerApi.getNetworkAnalytics,
    refetchOnWindowFocus: false,
  });
};

/**
 * Sync all social platform data
 */
export const useSyncAllSocialPlatforms = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: careerApi.syncAllSocialPlatforms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social'] });
      queryClient.invalidateQueries({ queryKey: ['network-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin'] });
      queryClient.invalidateQueries({ queryKey: careerKeys.network() });
    },
  });
};

export default {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
  useNetworkContacts,
  useNetworkContact,
  useCreateNetworkContact,
  useUpdateNetworkContact,
  useDeleteNetworkContact,
  useJobApplications,
  useJobApplication,
  useCreateJobApplication,
  useUpdateJobApplication,
  useDeleteJobApplication,
  // Event Discovery Hooks
  useEventbriteEvents,
  useMeetupEvents,
  useChamberEvents,
  useLocalBusinessEvents,
  useSearchAllEvents,
  useSaveEvent,
  useUnsaveEvent,
  useSavedEvents,
  useRsvpEvent,
  useRSVPEvents,
  useEventDetails,
  // LinkedIn Advanced Hooks
  useLinkedInProfile,
  useLinkedInConnections,
  useLinkedInRecommendations,
  useImportLinkedInContacts,
  useShareToLinkedIn,
  // Social Media Engagement Hooks
  useTwitterFollowers,
  useInstagramFollowers,
  useTikTokFollowers,
  useTwitterEngagement,
  useInstagramEngagement,
  useTikTokEngagement,
  useCrossPostContent,
  useSocialPlatformData,
  // Network Analytics Hooks
  useNetworkGrowth,
  useNetworkInsights,
  useInfluenceScore,
  useReachMetrics,
  useNetworkAnalytics,
  useSyncAllSocialPlatforms,
};
