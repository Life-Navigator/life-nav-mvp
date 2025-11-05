/**
 * Roadmap types for managing life planning and goals tracking
 */

export type RoadmapType = 'career' | 'education' | 'finance' | 'healthcare' | 'comprehensive';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';

export type MilestonePriority = 'low' | 'medium' | 'high' | 'critical';

export type DependencyType = 'requires' | 'enhances' | 'blocks';

export interface Dependency {
  milestoneId: string;
  type: DependencyType;
}

export interface Milestone {
  id: string;
  roadmapId: string;
  title: string;
  description: string;
  domain: RoadmapType;
  startDate: string;
  targetDate: string;
  status: MilestoneStatus;
  progress: number; // 0-100
  priority: MilestonePriority;
  dependencies?: Dependency[];
  resources?: Resource[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MilestoneCreate = Omit<Milestone, 'id' | 'roadmapId' | 'createdAt' | 'updatedAt'>;

export type MilestoneUpdate = Partial<Omit<Milestone, 'id' | 'roadmapId' | 'createdAt' | 'updatedAt'>>;

export interface Resource {
  id: string;
  title: string;
  url?: string;
  description?: string;
  type: 'article' | 'video' | 'course' | 'book' | 'tool' | 'other';
}

export interface Roadmap {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: RoadmapType;
  startDate: string;
  targetDate: string;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export type RoadmapCreate = {
  title: string;
  description: string;
  type: RoadmapType;
  startDate: string;
  targetDate: string;
  goals?: string[];
};

export interface RoadmapSummary {
  id: string;
  title: string;
  type: RoadmapType;
  startDate: string;
  targetDate: string;
  progress: number; // 0-100
  activeMilestones: number;
  completedMilestones: number;
}

export interface RoadmapProgress {
  overall: number; // 0-100
  byDomain: {
    [key in RoadmapType]: number; // 0-100
  };
  recentlyCompleted: Milestone[];
  upcoming: Milestone[];
  delayed: Milestone[];
}

export interface MilestoneTimeline {
  timeframe: 'past' | 'present' | 'future';
  milestones: Milestone[];
}