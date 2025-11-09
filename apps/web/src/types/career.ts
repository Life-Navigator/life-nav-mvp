/**
 * Career domain type definitions
 */

export type CareerRecord = {
  id: string;
  userId: string;
  currentRole: string | null;
  company: string | null;
  industry: string | null;
  yearsExperience: number | null;
  salaryRange: string | null;
  createdAt: Date;
  updatedAt: Date;
  skills?: Skill[];
  jobApplications?: JobApplication[];
  networkingEvents?: NetworkingEvent[];
};

export type Skill = {
  id: string;
  careerRecordId: string;
  name: string;
  proficiency: number; // 1-5 scale
  yearsExperience: number | null;
  createdAt: Date;
  updatedAt: Date;
};

// Updated Job Application type
export type ApplicationStatus = 'applied' | 'interview' | 'offered' | 'accepted' | 'rejected' | 'declined';

export type JobApplication = {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  applicationDate: string;
  status: ApplicationStatus;
  contactName: string;
  contactEmail: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type JobApplicationCreate = Omit<JobApplication, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type JobApplicationUpdate = Partial<JobApplicationCreate>;

export type NetworkingEvent = {
  id: string;
  careerRecordId: string;
  name: string;
  date: Date;
  location: string | null;
  description: string | null;
  outcome: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CareerOverview = {
  currentRole: string | null;
  company: string | null;
  industry: string | null;
  topSkills: Skill[];
  recentApplications: JobApplication[];
  upcomingEvents: NetworkingEvent[];
};

export type CareerInsight = {
  id: string;
  title: string;
  description: string;
  domain: 'skills' | 'job-search' | 'networking' | 'general';
  impact: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
};

export type JobRecommendation = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  matchScore: number;
  url: string;
  salaryRange: string | null;
  createdAt: Date;
};

// New types for job search functionality
export type JobListing = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary: string;
  posted: string;
  jobType: string;
  tags: string[];
  applicants: number;
  matchPercentage?: number;
  url?: string;
};

export type JobSearchParams = {
  keywords: string;
  location: string;
  jobType: string;
  page: number;
  limit: number;
};

export type JobSearchResult = {
  jobs: JobListing[];
  total: number;
  page: number;
};

// Interview preparation types
export type InterviewQuestion = {
  question: string;
  answer: string;
  tips?: string;
};

export type InterviewResource = {
  title: string;
  description: string;
  url: string;
};

export type InterviewPrepResource = {
  jobTitle: string;
  overview: string;
  keySkills: string[];
  questions: InterviewQuestion[];
  resources: InterviewResource[];
  checklist: string[];
};

// Event Discovery Types
export interface Event {
  id: string;
  title: string;
  description: string;
  platform: 'eventbrite' | 'meetup' | 'chamber' | 'local' | 'other';
  category: string;
  startDate: string;
  endDate?: string;
  location: EventLocation;
  isVirtual: boolean;
  price?: number;
  isFree: boolean;
  organizer: {
    name: string;
    logo?: string;
  };
  attendees?: number;
  imageUrl?: string;
  registrationUrl?: string;
  tags?: string[];
  isSaved?: boolean;
  rsvpStatus?: 'attending' | 'interested' | 'not_attending';
}

export interface EventLocation {
  address?: string;
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface EventSearchParams {
  keywords?: string;
  category?: string;
  location?: string;
  radius?: number;
  startDate?: string;
  endDate?: string;
  isVirtual?: boolean;
  isFree?: boolean;
  platform?: string;
  latitude?: number;
  longitude?: number;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'relevance' | 'distance';
}

// LinkedIn Types
export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary?: string;
  location?: string;
  industry?: string;
  profilePictureUrl?: string;
  publicProfileUrl?: string;
  connections: number;
}

export interface LinkedInConnection {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  profileUrl: string;
  profilePictureUrl?: string;
  company?: string;
  location?: string;
}

// Social Media Types
export interface SocialAccount {
  id: string;
  platform: 'twitter' | 'instagram' | 'tiktok' | 'linkedin';
  username: string;
  displayName: string;
  profileUrl: string;
  followers: number;
  following: number;
  isConnected: boolean;
  connectedAt?: string;
  avatarUrl?: string;
}

export interface SocialAnalytics {
  platform: string;
  followers: number;
  following: number;
  posts: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  growthRate: number;
  topPosts: Array<{
    id: string;
    content: string;
    likes: number;
    comments: number;
    shares: number;
    postedAt: string;
  }>;
}

export interface CrossPostContent {
  platforms: string[];
  content: string;
  mediaUrls?: string[];
  scheduledFor?: string;
}

export interface ScheduledPost {
  platforms: string[];
  content: string;
  mediaUrls?: string[];
  scheduledFor: string;
}

// Network Analytics Types
export interface NetworkAnalytics {
  totalNetworkSize: number;
  growthRate: number;
  influenceScore: {
    overall: number;
    linkedin: number;
    twitter: number;
    instagram: number;
    tiktok: number;
  };
  reachMetrics: {
    totalReach: number;
    averageEngagement: number;
    contentViews: number;
  };
  platformDistribution: Array<{
    platform: string;
    connections: number;
    percentage: number;
  }>;
  topConnections: Array<{
    name: string;
    title: string;
    company: string;
    platform: string;
    mutualConnections?: number;
  }>;
  geographicDistribution: Array<{
    location: string;
    count: number;
    percentage: number;
  }>;
  industryDistribution: Array<{
    industry: string;
    count: number;
    percentage: number;
  }>;
}

// Job Board Integration Types
export interface JobListingEnhanced {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  locationType: 'onsite' | 'remote' | 'hybrid';
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  skills: string[];
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  postedDate: string;
  expiryDate?: string;
  platform: 'linkedin' | 'indeed';
  externalUrl: string;
  applicants?: number;
  matchScore?: number;
  isSaved?: boolean;
  isApplied?: boolean;
}

export interface GigListing {
  id: string;
  title: string;
  description: string;
  client: {
    name: string;
    rating?: number;
    reviewCount?: number;
    location?: string;
  };
  budget?: {
    type: 'fixed' | 'hourly';
    amount?: number;
    hourlyRate?: {
      min: number;
      max: number;
    };
    currency: string;
  };
  duration?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  skills: string[];
  category: string;
  platform: 'upwork' | 'fiverr' | 'freelancer';
  postedDate: string;
  proposals?: number;
  externalUrl: string;
  matchScore?: number;
  isSaved?: boolean;
  isApplied?: boolean;
}

export interface JobSearchParamsEnhanced {
  keywords?: string;
  location?: string;
  locationType?: 'onsite' | 'remote' | 'hybrid' | 'any';
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'any';
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive' | 'any';
  salaryMin?: number;
  skills?: string[];
  platform?: 'linkedin' | 'indeed' | 'all';
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'relevance' | 'salary' | 'match';
}

export interface GigSearchParams {
  keywords?: string;
  category?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: 'fixed' | 'hourly' | 'any';
  experienceLevel?: 'beginner' | 'intermediate' | 'expert' | 'any';
  skills?: string[];
  platform?: 'upwork' | 'fiverr' | 'freelancer' | 'all';
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'relevance' | 'budget' | 'match';
}

export interface JobApplicationTracking {
  jobId: string;
  platform: string;
  status: 'applied' | 'screening' | 'interviewing' | 'offered' | 'rejected' | 'accepted' | 'declined';
  appliedDate: string;
  notes?: string;
  resumeVersion?: string;
  coverLetter?: string;
}

export interface ProfileMatchScore {
  overallScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  locationMatch: number;
  matchingSkills: string[];
  missingSkills: string[];
  recommendations: string[];
}

export interface ApplicationStats {
  totalApplications: number;
  applied: number;
  screening: number;
  interviewing: number;
  offered: number;
  rejected: number;
  responseRate: number;
  averageResponseTime: number;
  topPlatforms: Array<{
    platform: string;
    count: number;
  }>;
}

export interface JobMarketInsights {
  trendingSkills: Array<{
    skill: string;
    demand: number;
    growth: number;
  }>;
  averageSalaries: Array<{
    role: string;
    salary: number;
    currency: string;
  }>;
  topHiringCompanies: Array<{
    company: string;
    openings: number;
  }>;
  demandByLocation: Array<{
    location: string;
    openings: number;
  }>;
}