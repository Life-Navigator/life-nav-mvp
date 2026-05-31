/**
 * Shared types for the Career Marketplace matcher.
 * Mirrors the columns in migration 072_career_marketplace.sql.
 */

export type JobStatus = 'draft' | 'published' | 'paused' | 'expired' | 'archived';

export type RemoteMode = 'remote' | 'hybrid' | 'on_site';

export type ExperienceLevel =
  | 'intern'
  | 'entry'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'executive';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'apprenticeship'
  | 'temporary';

export type RequirementKind =
  | 'skill_required'
  | 'skill_preferred'
  | 'certification'
  | 'education'
  | 'experience_years';

export interface JobRequirement {
  requirement_kind: RequirementKind;
  value: string;
  weight: number;
}

export interface JobPostSnapshot {
  id: string;
  employer_id: string;
  title: string;
  industry: string | null;
  employment_type: EmploymentType | null;
  remote_mode: RemoteMode | null;
  experience_level: ExperienceLevel | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  veteran_friendly: boolean;
  requirements: JobRequirement[];
  locations: Array<{ city: string | null; state: string | null; country: string | null }>;
}

export interface CandidateSnapshot {
  user_id: string;
  current_title: string | null;
  desired_title: string | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  skills: string[];
  certifications: string[];
  years_of_experience: number | null;
  work_arrangement: string | null;
  industry_interests: string[];
  relocation_willingness: string | null;
  job_change_willingness: string | null;
  visibility: 'hidden' | 'anonymous' | 'selected_employers' | 'open';
  desired_locations: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  highest_completed_degree: string | null;
}

export interface DimensionScores {
  skills_score: number; // 0..100
  certifications_score: number;
  education_score: number;
  salary_fit_score: number;
  location_fit_score: number;
  growth_alignment_score: number;
}

export interface MatchResult {
  user_id: string;
  match_score: number; // 0..100, composite weighted
  dimensions: DimensionScores;
  missing_requirements: string[];
  employer_facing_summary: string;
  candidate_visibility_at_match: CandidateSnapshot['visibility'];
}

/**
 * Composite weights. Documented here so a future tweak is reviewable
 * in a PR rather than scattered through the codebase.
 */
export const DIMENSION_WEIGHTS: Record<keyof DimensionScores, number> = {
  skills_score: 0.3,
  certifications_score: 0.1,
  education_score: 0.15,
  salary_fit_score: 0.2,
  location_fit_score: 0.15,
  growth_alignment_score: 0.1,
};

export const EDUCATION_RANK: Record<string, number> = {
  high_school: 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
  bootcamp: 2,
  certificate: 2,
};

export const EXPERIENCE_RANK: Record<ExperienceLevel, number> = {
  intern: 0,
  entry: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  principal: 5,
  executive: 6,
};
