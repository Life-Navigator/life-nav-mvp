/**
 * Shared server-side data fetch for readiness + Life Brief, so scoring inputs are
 * built in exactly one place (no duplicated selects, no parallel scoring). All reads
 * are user-scoped (RLS + explicit user_id).
 */
import type { CareerData } from './career';
import type { EducationData } from './education';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function sel(sb: SB, userId: string, schema: string, table: string, cols: string) {
  try {
    const { data } = await sb.schema(schema).from(table).select(cols).eq('user_id', userId);
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchCareerData(sb: SB, userId: string): Promise<CareerData> {
  const [experience, volunteer, sideProjects, goals, certifications, licenses] = await Promise.all([
    sel(
      sb,
      userId,
      'career',
      'experience_records',
      'title,employer,industry,start_date,end_date,is_current,responsibilities'
    ),
    sel(sb, userId, 'career', 'volunteer_records', 'organization,role,cause_area,is_current'),
    sel(sb, userId, 'career', 'side_projects', 'name,role,project_type,url'),
    sel(sb, userId, 'career', 'career_goals', 'title,target_role,target_date,status'),
    sel(sb, userId, 'education', 'certifications', 'name'),
    sel(sb, userId, 'education', 'licenses', 'name'),
  ]);
  return { experience, volunteer, sideProjects, goals, certifications, licenses };
}

export async function fetchEducationData(sb: SB, userId: string): Promise<EducationData> {
  const [degrees, courses, certifications, licenses, goals, careerGoals] = await Promise.all([
    sel(
      sb,
      userId,
      'public',
      'education_records',
      'institution_name,degree_type,field_of_study,status,is_current,graduation_date,school_domain,school_logo_url'
    ),
    sel(sb, userId, 'public', 'courses', 'course_name,status,completion_date'),
    sel(sb, userId, 'education', 'certifications', 'name,issuer_domain,status'),
    sel(sb, userId, 'education', 'licenses', 'name,issuer_domain,status'),
    sel(sb, userId, 'education', 'education_goals', 'title,target_role,target_date,status'),
    sel(sb, userId, 'career', 'career_goals', 'status'),
  ]);
  return {
    degrees,
    courses,
    certifications,
    licenses,
    goals,
    careerGoalsCount: (careerGoals as { status?: string }[]).filter(
      (g) => (g.status ?? 'active') === 'active'
    ).length,
  };
}
