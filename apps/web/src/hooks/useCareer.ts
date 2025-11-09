import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getJobApplications,
  createJobApplication,
  updateJobApplication,
  deleteJobApplication,
  searchJobs,
  getInterviewPrep,
  searchAllEvents,
  getSavedEvents,
  saveEvent,
  unsaveEvent,
  rsvpToEvent,
  getLinkedInProfile,
  getLinkedInConnections,
  getConnectedSocialAccounts,
  getSocialAnalytics,
  crossPostContent,
  getNetworkAnalytics,
  getInfluenceScore,
  disconnectSocialAccount,
  getLinkedInJobs,
  getIndeedJobs,
  getAllJobs,
  getRecommendedJobs,
  saveJob,
  unsaveJob,
  getSavedJobs,
  applyToJob,
  trackJobApplication,
  getUpworkGigs,
  getFiverrGigs,
  getFreelancerGigs,
  getAllGigs,
  getRecommendedGigs,
  saveGig,
  unsaveGig,
  getSavedGigs,
  applyToGig,
  getProfileMatchScore,
  getSkillGaps,
  getApplicationStats,
  getJobMarketInsights
} from '@/lib/api/career';
import {
  JobApplication,
  JobApplicationCreate,
  JobApplicationUpdate,
  JobListing,
  InterviewPrepResource,
  JobSearchParams,
  EventSearchParams,
  Event,
  LinkedInProfile,
  LinkedInConnection,
  SocialAccount,
  SocialAnalytics,
  CrossPostContent,
  NetworkAnalytics
} from '@/types/career';

// Hook for managing job applications
export function useJobApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getJobApplications();
      setApplications(data);
    } catch (err) {
      setError('Failed to fetch job applications');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addApplication = useCallback(async (application: JobApplicationCreate) => {
    setIsLoading(true);
    setError(null);
    try {
      const newApplication = await createJobApplication(application);
      setApplications(prev => [...prev, newApplication]);
      return newApplication;
    } catch (err) {
      setError('Failed to create job application');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateApplication = useCallback(async (id: string, updates: JobApplicationUpdate) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await updateJobApplication(id, updates);
      setApplications(prev => 
        prev.map(app => app.id === id ? updated : app)
      );
      return updated;
    } catch (err) {
      setError('Failed to update job application');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeApplication = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteJobApplication(id);
      setApplications(prev => prev.filter(app => app.id !== id));
      return true;
    } catch (err) {
      setError('Failed to delete job application');
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return {
    applications,
    isLoading,
    error,
    fetchApplications,
    addApplication,
    updateApplication,
    removeApplication
  };
}

// Hook for job search functionality
export function useJobSearch() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const searchForJobs = useCallback(async (params: JobSearchParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const { jobs, total, page } = await searchJobs(params);
      setJobs(jobs);
      setTotalResults(total);
      setCurrentPage(page);
      return { jobs, total, page };
    } catch (err) {
      setError('Failed to search for jobs');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    jobs,
    isLoading,
    error,
    totalResults,
    currentPage,
    searchForJobs
  };
}

// Hook for interview preparation resources
export function useInterviewPrep() {
  const [resources, setResources] = useState<InterviewPrepResource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInterviewPrep = useCallback(async (jobTitle: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getInterviewPrep(jobTitle);
      setResources(data);
      return data;
    } catch (err) {
      setError('Failed to fetch interview preparation resources');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    resources,
    isLoading,
    error,
    fetchInterviewPrep
  };
}

// Event Discovery Hooks
export function useAllEvents(params?: EventSearchParams) {
  return useQuery({
    queryKey: ['all-events', params],
    queryFn: () => searchAllEvents(params || {}),
  });
}

export function useSavedEvents() {
  return useQuery({
    queryKey: ['saved-events'],
    queryFn: getSavedEvents,
  });
}

export function useSaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      queryClient.invalidateQueries({ queryKey: ['saved-events'] });
    },
  });
}

export function useUnsaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsaveEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      queryClient.invalidateQueries({ queryKey: ['saved-events'] });
    },
  });
}

export function useRsvpToEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, response }: { eventId: string; response: 'attending' | 'interested' | 'not_attending' }) =>
      rsvpToEvent(eventId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
    },
  });
}

// LinkedIn Hooks
export function useLinkedInProfile() {
  return useQuery({
    queryKey: ['linkedin-profile'],
    queryFn: getLinkedInProfile,
  });
}

export function useLinkedInConnections() {
  return useQuery<LinkedInConnection[]>({
    queryKey: ['linkedin-connections'],
    queryFn: getLinkedInConnections,
  });
}

// Social Media Hooks
export function useConnectedSocialAccounts() {
  return useQuery<SocialAccount[]>({
    queryKey: ['social-accounts'],
    queryFn: getConnectedSocialAccounts,
  });
}

export function useSocialAnalytics(platform: string) {
  return useQuery<SocialAnalytics>({
    queryKey: ['social-analytics', platform],
    queryFn: () => getSocialAnalytics(platform),
    enabled: !!platform,
  });
}

export function useCrossPost() {
  return useMutation({
    mutationFn: crossPostContent,
  });
}

export function useDisconnectSocial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectSocialAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
  });
}

// Network Analytics Hooks
export function useNetworkAnalytics() {
  return useQuery<NetworkAnalytics>({
    queryKey: ['network-analytics'],
    queryFn: getNetworkAnalytics,
  });
}

export function useInfluenceScore() {
  return useQuery({
    queryKey: ['influence-score'],
    queryFn: getInfluenceScore,
  });
}

// Job Board Hooks
export function useLinkedInJobs(params?: any) {
  return useQuery({
    queryKey: ['linkedin-jobs', params],
    queryFn: () => getLinkedInJobs(params),
    enabled: !!params,
  });
}

export function useIndeedJobs(params?: any) {
  return useQuery({
    queryKey: ['indeed-jobs', params],
    queryFn: () => getIndeedJobs(params),
    enabled: !!params,
  });
}

export function useAllJobs(params?: any) {
  return useQuery({
    queryKey: ['all-jobs', params],
    queryFn: () => getAllJobs(params),
  });
}

export function useRecommendedJobs() {
  return useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: getRecommendedJobs,
  });
}

export function useSavedJobs() {
  return useQuery({
    queryKey: ['saved-jobs'],
    queryFn: getSavedJobs,
  });
}

export function useSaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, platform }: { jobId: string; platform: string }) =>
      saveJob(jobId, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-jobs'] });
    },
  });
}

export function useUnsaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => unsaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
    },
  });
}

export function useApplyToJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, platform, applicationData }: any) =>
      applyToJob(jobId, platform, applicationData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
    },
  });
}

export function useTrackJobApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trackJobApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
    },
  });
}

// Freelance Gig Hooks
export function useUpworkGigs(params?: any) {
  return useQuery({
    queryKey: ['upwork-gigs', params],
    queryFn: () => getUpworkGigs(params),
    enabled: !!params,
  });
}

export function useFiverrGigs(params?: any) {
  return useQuery({
    queryKey: ['fiverr-gigs', params],
    queryFn: () => getFiverrGigs(params),
    enabled: !!params,
  });
}

export function useFreelancerGigs(params?: any) {
  return useQuery({
    queryKey: ['freelancer-gigs', params],
    queryFn: () => getFreelancerGigs(params),
    enabled: !!params,
  });
}

export function useAllGigs(params?: any) {
  return useQuery({
    queryKey: ['all-gigs', params],
    queryFn: () => getAllGigs(params),
  });
}

export function useRecommendedGigs() {
  return useQuery({
    queryKey: ['recommended-gigs'],
    queryFn: getRecommendedGigs,
  });
}

export function useSavedGigs() {
  return useQuery({
    queryKey: ['saved-gigs'],
    queryFn: getSavedGigs,
  });
}

export function useSaveGig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gigId, platform }: { gigId: string; platform: string }) =>
      saveGig(gigId, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-gigs'] });
      queryClient.invalidateQueries({ queryKey: ['all-gigs'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-gigs'] });
    },
  });
}

export function useUnsaveGig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gigId: string) => unsaveGig(gigId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-gigs'] });
      queryClient.invalidateQueries({ queryKey: ['all-gigs'] });
    },
  });
}

export function useApplyToGig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gigId, platform, proposalData }: any) =>
      applyToGig(gigId, platform, proposalData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
    },
  });
}

// Analytics Hooks
export function useApplicationStats() {
  return useQuery({
    queryKey: ['application-stats'],
    queryFn: getApplicationStats,
  });
}

export function useJobMarketInsights() {
  return useQuery({
    queryKey: ['job-market-insights'],
    queryFn: getJobMarketInsights,
  });
}

export function useProfileMatchScore(jobId: string) {
  return useQuery({
    queryKey: ['profile-match-score', jobId],
    queryFn: () => getProfileMatchScore(jobId),
    enabled: !!jobId,
  });
}

export function useSkillGaps(jobId: string) {
  return useQuery({
    queryKey: ['skill-gaps', jobId],
    queryFn: () => getSkillGaps(jobId),
    enabled: !!jobId,
  });
}