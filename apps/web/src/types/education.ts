/**
 * TypeScript types for Education Module
 * Matches backend Pydantic schemas
 */

export enum CredentialType {
  DEGREE = 'degree',
  DIPLOMA = 'diploma',
  CERTIFICATE = 'certificate',
  LICENSE = 'license',
  BADGE = 'badge',
  MICRO_CREDENTIAL = 'micro-credential',
}

export enum CoursePlatform {
  COURSERA = 'coursera',
  UDEMY = 'udemy',
  LINKEDIN_LEARNING = 'linkedin_learning',
  PLURALSIGHT = 'pluralsight',
  EDX = 'edx',
  UDACITY = 'udacity',
  SKILLSHARE = 'skillshare',
  CODECADEMY = 'codecademy',
  FREECODECAMP = 'freecodecamp',
  KHAN_ACADEMY = 'khan_academy',
  YOUTUBE = 'youtube',
  FRONTEND_MASTERS = 'frontend_masters',
  EGGHEAD = 'egghead',
  OTHER = 'other',
}

export enum CourseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  DROPPED = 'dropped',
}

export interface Course {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  platform: CoursePlatform;
  status: CourseStatus;
  progress_percentage: number;
  hours_completed: number;
  estimated_hours?: number;
  instructor?: string;
  thumbnail?: string;
  course_url?: string;
  skills?: string[];
  last_accessed?: string;
  created_at: string;
  updated_at: string;
}

export interface EducationDashboardStats {
  total_credentials: number;
  active_courses: number;
  completed_courses: number;
  total_learning_hours: number;
  active_learning_paths: number;
  learning_streak_days: number;
  average_course_progress: number;
}
