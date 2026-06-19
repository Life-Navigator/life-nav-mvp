import type { EntityDef } from './domainCrud';

// Career entity registry → real career.* tables (migrations 122 + 162).
export const CAREER_ENTITIES: Record<string, EntityDef> = {
  experience: {
    schema: 'career',
    table: 'experience_records',
    fields: [
      'title',
      'employer',
      'industry',
      'location',
      'start_date',
      'end_date',
      'is_current',
      'responsibilities',
      'employer_domain',
      'employer_logo_url',
    ],
    boolean: ['is_current'],
    requiredField: 'title',
  },
  volunteer: {
    schema: 'career',
    table: 'volunteer_records',
    fields: [
      'organization',
      'role',
      'cause_area',
      'start_date',
      'end_date',
      'is_current',
      'hours_per_month',
      'description',
    ],
    numeric: ['hours_per_month'],
    boolean: ['is_current'],
    requiredField: 'organization',
  },
  'side-projects': {
    schema: 'career',
    table: 'side_projects',
    fields: [
      'name',
      'role',
      'project_type',
      'url',
      'start_date',
      'end_date',
      'is_active',
      'description',
    ],
    boolean: ['is_active'],
    requiredField: 'name',
  },
  goals: {
    schema: 'career',
    table: 'career_goals',
    fields: ['title', 'goal_type', 'target_role', 'target_total_comp', 'target_date', 'status'],
    numeric: ['target_total_comp'],
    requiredField: 'title',
  },
};

export function resolveCareerEntity(slug: string): EntityDef | null {
  return CAREER_ENTITIES[slug] ?? null;
}
