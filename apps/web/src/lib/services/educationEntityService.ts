import type { EntityDef } from './domainCrud';

// Education entity registry. Degrees + classes use the legacy public.* tables that the
// existing /api/education/records|courses routes also write; certificates/licenses/goals
// use the education.* schema (migrations 127 + 162).
export const EDUCATION_ENTITIES: Record<string, EntityDef> = {
  degrees: {
    schema: 'public',
    table: 'education_records',
    fields: [
      'institution_name',
      'degree_type',
      'field_of_study',
      'gpa',
      'start_date',
      'end_date',
      'graduation_date',
      'is_current',
      'status',
      'school_domain',
      'school_logo_url',
    ],
    numeric: ['gpa'],
    boolean: ['is_current'],
    requiredField: 'institution_name',
  },
  classes: {
    schema: 'public',
    table: 'courses',
    fields: [
      'course_name',
      'provider',
      'level',
      'status',
      'progress_percent',
      'url',
      'start_date',
      'completion_date',
      'cost',
      'notes',
    ],
    numeric: ['progress_percent', 'cost'],
    requiredField: 'course_name',
  },
  certificates: {
    schema: 'education',
    table: 'certifications',
    fields: [
      'name',
      'issuer',
      'status',
      'issued_date',
      'expires_date',
      'credential_id',
      'issuer_domain',
      'logo_url',
    ],
    requiredField: 'name',
  },
  licenses: {
    schema: 'education',
    table: 'licenses',
    fields: [
      'name',
      'issuing_authority',
      'license_number',
      'state',
      'issued_date',
      'expires_date',
      'status',
      'issuer_domain',
      'logo_url',
    ],
    requiredField: 'name',
  },
  goals: {
    schema: 'education',
    table: 'education_goals',
    fields: ['title', 'goal_type', 'target_role', 'target_date', 'status'],
    requiredField: 'title',
  },
};

export function resolveEducationEntity(slug: string): EntityDef | null {
  return EDUCATION_ENTITIES[slug] ?? null;
}
