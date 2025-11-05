import { apiClient } from './client';
import { 
  Roadmap,
  RoadmapCreate,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  RoadmapType,
  RoadmapSummary,
  RoadmapProgress
} from '@/types/roadmap';

// Get user's roadmaps
export const getUserRoadmaps = async (): Promise<RoadmapSummary[]> => {
  return apiClient.get<RoadmapSummary[]>('/roadmap');
};

// Create a new roadmap
export const generateRoadmap = async (data: RoadmapCreate): Promise<Roadmap> => {
  return apiClient.post<Roadmap>('/roadmap/generate', data);
};

// Get a specific roadmap by ID
export const getRoadmapById = async (id: string): Promise<Roadmap> => {
  return apiClient.get<Roadmap>(`/roadmap/${id}`);
};

// Update milestone progress
export const updateMilestoneProgress = async (
  roadmapId: string,
  milestoneId: string,
  data: MilestoneUpdate
): Promise<Milestone> => {
  return apiClient.patch<Milestone>(`/roadmap/${roadmapId}/progress`, {
    milestoneId,
    ...data
  });
};

// Get roadmap for a specific domain
export const getDomainRoadmap = async (domain: RoadmapType): Promise<Roadmap> => {
  return apiClient.get<Roadmap>(`/roadmap/${domain}`);
};

// Get overall roadmap progress
export const getRoadmapProgress = async (): Promise<RoadmapProgress> => {
  return apiClient.get<RoadmapProgress>('/roadmap/progress');
};

// Add a new milestone to roadmap
export const addMilestone = async (
  roadmapId: string,
  milestone: MilestoneCreate
): Promise<Milestone> => {
  return apiClient.post<Milestone>(`/roadmap/${roadmapId}/milestones`, milestone);
};

// Delete a milestone
export const deleteMilestone = async (
  roadmapId: string,
  milestoneId: string
): Promise<void> => {
  return apiClient.delete(`/roadmap/${roadmapId}/milestones/${milestoneId}`);
};