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