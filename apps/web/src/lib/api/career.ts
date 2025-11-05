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