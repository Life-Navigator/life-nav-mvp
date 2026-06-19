/**
 * Career readiness scoring (deterministic, evidence-based).
 *
 * Components (100 total):
 *   Experience depth        25   years of dated experience + number of positions
 *   Current role clarity    15   a clearly-identified current role (title + employer)
 *   Credential strength     15   certifications + licenses on record
 *   Project/portfolio        15   side jobs / projects
 *   Volunteer/leadership    10   volunteer roles (leadership keywords add weight)
 *   Goal alignment          15   active career goals with a target role/date
 *   Data completeness        5   how filled-in the overall picture is
 */
import {
  type ReadinessComponent,
  type ReadinessResult,
  clamp,
  statusFor,
  confidenceFor,
} from './types';

export interface CareerExperience {
  title?: string | null;
  employer?: string | null;
  industry?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  responsibilities?: string | null;
}
export interface CareerVolunteer {
  organization?: string | null;
  role?: string | null;
  cause_area?: string | null;
  is_current?: boolean | null;
}
export interface CareerSideProject {
  name?: string | null;
  role?: string | null;
  project_type?: string | null;
  url?: string | null;
}
export interface CareerGoal {
  title?: string | null;
  target_role?: string | null;
  target_date?: string | null;
  status?: string | null;
}
export interface CareerCredential {
  name?: string | null;
}

export interface CareerData {
  experience: CareerExperience[];
  volunteer: CareerVolunteer[];
  sideProjects: CareerSideProject[];
  goals: CareerGoal[];
  certifications: CareerCredential[];
  licenses: CareerCredential[];
}

const LEADERSHIP =
  /lead|director|president|manager|chief|head|founder|captain|officer|coordinator/i;

function yearsOfExperience(exp: CareerExperience[]): number {
  const starts = exp.map((e) => e.start_date).filter(Boolean) as string[];
  if (!starts.length) return 0;
  const earliest = starts
    .map((s) => new Date(s).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0];
  if (earliest == null) return 0;
  return Math.max(0, Math.round(((Date.now() - earliest) / (365.25 * 864e5)) * 10) / 10);
}

export function scoreCareer(data: CareerData, now: string): ReadinessResult {
  const exp = data.experience || [];
  const volunteer = data.volunteer || [];
  const projects = data.sideProjects || [];
  const goals = (data.goals || []).filter((g) => (g.status ?? 'active') === 'active');
  const creds = [...(data.certifications || []), ...(data.licenses || [])];

  const components: ReadinessComponent[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  const actions: string[] = [];

  // 1. Experience depth (25)
  const years = yearsOfExperience(exp);
  const positions = exp.length;
  let expPts = clamp(years * 2.5, 0, 22);
  if (expPts === 0 && positions > 0) expPts = 4; // undated roles still show experience
  expPts += positions >= 3 ? 3 : positions >= 2 ? 2 : positions >= 1 ? 1 : 0;
  expPts = Math.round(clamp(expPts, 0, 25));
  components.push({
    key: 'experience',
    label: 'Experience depth',
    score: expPts,
    max: 25,
    reason: positions
      ? `${positions} position(s)${years ? `, ~${years} yrs since earliest start` : ' (undated)'}`
      : 'No employment history added yet',
  });
  if (expPts >= 18)
    strengths.push(`${years ? `${years} years` : `${positions} roles`} of employment history`);
  if (positions === 0) {
    gaps.push('No employment history');
    actions.push('Add your current and previous jobs');
  } else if (!exp.some((e) => e.start_date)) {
    gaps.push('Employment dates missing');
    actions.push('Add start/end dates to your roles to reflect tenure');
  }

  // 2. Current role clarity (15)
  const current = exp.find((e) => e.is_current);
  let rolePts = 0;
  if (current?.title && current?.employer) rolePts = 15;
  else if (current?.title || exp.some((e) => e.title)) rolePts = 8;
  components.push({
    key: 'current_role',
    label: 'Current role clarity',
    score: rolePts,
    max: 15,
    reason: current?.title
      ? `Current role: ${current.title}${current.employer ? ` @ ${current.employer}` : ' (no employer)'}`
      : 'No role marked as current',
  });
  if (rolePts === 15) strengths.push(`Current role: ${current!.title} @ ${current!.employer}`);
  if (rolePts < 15) {
    gaps.push('Current role not fully specified');
    actions.push('Mark your current role and add the employer');
  }

  // 3. Credential strength (15)
  const credPts =
    creds.length >= 4
      ? 15
      : creds.length === 3
        ? 13
        : creds.length === 2
          ? 10
          : creds.length === 1
            ? 6
            : 0;
  components.push({
    key: 'credentials',
    label: 'Credential strength',
    score: credPts,
    max: 15,
    reason: creds.length
      ? `${creds.length} certification(s)/license(s) on record`
      : 'No certifications or licenses',
  });
  if (credPts >= 10) strengths.push(`${creds.length} professional credentials`);
  if (creds.length === 0) {
    gaps.push('No certifications or licenses');
    actions.push('Add relevant certifications or licenses');
  }

  // 4. Project/portfolio evidence (15)
  const projPts =
    projects.length >= 3 ? 15 : projects.length === 2 ? 11 : projects.length === 1 ? 7 : 0;
  components.push({
    key: 'projects',
    label: 'Project / portfolio evidence',
    score: projPts,
    max: 15,
    reason: projects.length
      ? `${projects.length} side job(s)/project(s)`
      : 'No side projects or portfolio',
  });
  if (projPts >= 11) strengths.push(`${projects.length} projects demonstrating initiative`);
  if (projects.length === 0) {
    gaps.push('No side projects/portfolio');
    actions.push('Add freelance work, side businesses, or notable projects');
  }

  // 5. Volunteer / leadership evidence (10)
  const hasLeadership =
    volunteer.some((v) => LEADERSHIP.test(v.role || '')) ||
    exp.some((e) => LEADERSHIP.test(e.title || ''));
  let volPts = volunteer.length >= 2 ? 8 : volunteer.length === 1 ? 6 : 0;
  if (hasLeadership) volPts = clamp(volPts + 2, 0, 10);
  volPts = Math.round(volPts);
  components.push({
    key: 'volunteer',
    label: 'Volunteer / leadership evidence',
    score: volPts,
    max: 10,
    reason: volunteer.length
      ? `${volunteer.length} volunteer role(s)${hasLeadership ? ' + leadership signal' : ''}`
      : hasLeadership
        ? 'Leadership signal in a role title'
        : 'No volunteer or leadership evidence',
  });
  if (volPts >= 8) strengths.push('Volunteer and/or leadership experience');
  if (volunteer.length === 0) {
    gaps.push('No volunteer experience');
    actions.push('Add volunteer roles, especially leadership ones');
  }

  // 6. Goal alignment (15)
  const wellSpecified = goals.filter((g) => g.target_role && g.target_date);
  let goalPts = 0;
  if (goals.length >= 2 && wellSpecified.length >= 2) goalPts = 15;
  else if (wellSpecified.length >= 1) goalPts = 12;
  else if (goals.length >= 1) goalPts = 8;
  components.push({
    key: 'goals',
    label: 'Goal alignment',
    score: goalPts,
    max: 15,
    reason: goals.length
      ? `${goals.length} active goal(s), ${wellSpecified.length} with target role + date`
      : 'No active career goals',
  });
  if (goalPts >= 12) strengths.push('Clear, dated career goals');
  if (goals.length === 0) {
    gaps.push('No active career goals');
    actions.push('Set a target role and date for your next move');
  } else if (wellSpecified.length === 0) {
    gaps.push('Goals lack a target role/date');
    actions.push('Add a target role and target date to your goals');
  }

  // 7. Data completeness (5)
  const sources = [exp.length, volunteer.length, projects.length, goals.length, creds.length];
  const populated = sources.filter((n) => n > 0).length;
  const completePts = Math.round(clamp((populated / sources.length) * 5, 0, 5));
  components.push({
    key: 'completeness',
    label: 'Data completeness',
    score: completePts,
    max: 5,
    reason: `${populated} of ${sources.length} career data areas have entries`,
  });

  const dataPoints = sources.reduce((a, b) => a + b, 0);
  const score = Math.round(components.reduce((a, c) => a + c.score, 0));
  const status = statusFor(score, dataPoints);
  const confidence = confidenceFor(populated, sources.length, dataPoints);

  const dataSources: string[] = [];
  if (exp.length) dataSources.push('career.experience_records');
  if (volunteer.length) dataSources.push('career.volunteer_records');
  if (projects.length) dataSources.push('career.side_projects');
  if (goals.length) dataSources.push('career.career_goals');
  if (data.certifications?.length) dataSources.push('education.certifications');
  if (data.licenses?.length) dataSources.push('education.licenses');

  const missingData: string[] = [];
  if (!exp.length) missingData.push('Employment history');
  if (!current) missingData.push('Current role');
  if (!creds.length) missingData.push('Certifications / licenses');
  if (!projects.length) missingData.push('Side projects / portfolio');
  if (!volunteer.length) missingData.push('Volunteer experience');
  if (!goals.length) missingData.push('Active career goals');

  return {
    score,
    status,
    components,
    strengths,
    gaps,
    recommendedActions: actions.slice(0, 5),
    confidence,
    dataSources,
    missingData,
    updatedAt: now,
  };
}
