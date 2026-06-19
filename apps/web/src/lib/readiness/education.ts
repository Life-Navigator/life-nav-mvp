/**
 * Education readiness scoring (deterministic, evidence-based).
 *
 * Components (100 total):
 *   Degree attainment           25   highest completed degree (in-progress counts half)
 *   Certification/license       20   certificates + licenses on record
 *   Continuing education        15   college classes / courses
 *   Future goal clarity         15   education goals with a target role/date
 *   Institution/issuer conf.    10   share of records tied to a recognized school/issuer
 *   Career alignment            10   education directed at a stated career direction
 *   Data completeness            5   how filled-in the overall picture is
 */
import {
  type ReadinessComponent,
  type ReadinessResult,
  clamp,
  statusFor,
  confidenceFor,
} from './types';

export interface EduDegree {
  institution_name?: string | null;
  degree_type?: string | null;
  field_of_study?: string | null;
  status?: string | null;
  is_current?: boolean | null;
  graduation_date?: string | null;
  school_domain?: string | null;
  school_logo_url?: string | null;
}
export interface EduCourse {
  course_name?: string | null;
  status?: string | null;
  completion_date?: string | null;
}
export interface EduCredential {
  name?: string | null;
  issuer_domain?: string | null;
  status?: string | null;
}
export interface EduGoal {
  title?: string | null;
  target_role?: string | null;
  target_date?: string | null;
  status?: string | null;
}

export interface EducationData {
  degrees: EduDegree[];
  courses: EduCourse[];
  certifications: EduCredential[];
  licenses: EduCredential[];
  goals: EduGoal[];
  careerGoalsCount?: number;
}

const DEGREE_VALUE: Record<string, number> = {
  doctorate: 25,
  master: 22,
  bachelor: 18,
  associate: 13,
  certificate: 10,
  bootcamp: 10,
  high_school: 8,
};
const DEGREE_LABEL: Record<string, string> = {
  doctorate: 'Doctorate',
  master: "Master's",
  bachelor: "Bachelor's",
  associate: "Associate's",
  certificate: 'Certificate',
  bootcamp: 'Bootcamp',
  high_school: 'High school diploma',
};

const isCompleted = (d: EduDegree) => (d.status ?? '').toLowerCase() === 'completed';
const isInProgress = (d: EduDegree) =>
  !!d.is_current || ['in_progress', 'enrolled'].includes((d.status ?? '').toLowerCase());

export function scoreEducation(data: EducationData, now: string): ReadinessResult {
  const degrees = data.degrees || [];
  const courses = data.courses || [];
  const creds = [...(data.certifications || []), ...(data.licenses || [])];
  const goals = (data.goals || []).filter((g) => (g.status ?? 'active') === 'active');
  const careerGoals = data.careerGoalsCount || 0;

  const components: ReadinessComponent[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  const actions: string[] = [];

  // 1. Degree attainment (25)
  let bestCompleted = 0;
  let bestCompletedLabel = '';
  let bestInProgress = 0;
  for (const d of degrees) {
    const v = DEGREE_VALUE[(d.degree_type ?? '').toLowerCase()] ?? 0;
    if (isCompleted(d) && v > bestCompleted) {
      bestCompleted = v;
      bestCompletedLabel = DEGREE_LABEL[(d.degree_type ?? '').toLowerCase()] ?? 'Degree';
    } else if (isInProgress(d) && v * 0.5 > bestInProgress) {
      bestInProgress = v * 0.5;
    }
  }
  const degreePts = Math.round(clamp(Math.max(bestCompleted, bestInProgress), 0, 25));
  components.push({
    key: 'degree',
    label: 'Degree attainment',
    score: degreePts,
    max: 25,
    reason: bestCompleted
      ? `Highest completed: ${bestCompletedLabel}`
      : bestInProgress
        ? 'A degree is in progress (counts half until completed)'
        : degrees.length
          ? 'Degree records present but none recognized/completed'
          : 'No degrees or diplomas added',
  });
  if (bestCompleted >= 18) strengths.push(`${bestCompletedLabel} completed`);
  if (!degrees.length) {
    gaps.push('No degrees or diplomas');
    actions.push('Add your high school diploma and any college degrees');
  }

  // 2. Certification / license strength (20)
  const credPts =
    creds.length >= 4
      ? 20
      : creds.length === 3
        ? 17
        : creds.length === 2
          ? 13
          : creds.length === 1
            ? 8
            : 0;
  components.push({
    key: 'credentials',
    label: 'Certification / license strength',
    score: credPts,
    max: 20,
    reason: creds.length
      ? `${creds.length} certificate(s)/license(s)`
      : 'No certificates or licenses',
  });
  if (credPts >= 13) strengths.push(`${creds.length} certificates/licenses`);
  if (!creds.length) {
    gaps.push('No certificates or licenses');
    actions.push('Add certificates (AWS, PMP…) and any professional licenses');
  }

  // 3. Continuing education (15)
  const coursePts =
    courses.length >= 3 ? 15 : courses.length === 2 ? 11 : courses.length === 1 ? 7 : 0;
  components.push({
    key: 'courses',
    label: 'Continuing education',
    score: coursePts,
    max: 15,
    reason: courses.length
      ? `${courses.length} class(es)/course(s)`
      : 'No classes or courses logged',
  });
  if (coursePts >= 11) strengths.push('Active continuing education');
  if (!courses.length) {
    gaps.push('No continuing education');
    actions.push('Add notable college classes or online courses');
  }

  // 4. Future goal clarity (15)
  const specified = goals.filter((g) => g.target_role || g.target_date);
  let goalPts = 0;
  if (goals.length >= 2 && specified.length >= 2) goalPts = 15;
  else if (specified.length >= 1) goalPts = 12;
  else if (goals.length >= 1) goalPts = 8;
  components.push({
    key: 'goals',
    label: 'Future goal clarity',
    score: goalPts,
    max: 15,
    reason: goals.length
      ? `${goals.length} education goal(s), ${specified.length} with a target`
      : 'No future education goals',
  });
  if (goalPts >= 12) strengths.push('Clear future learning goals');
  if (!goals.length) {
    gaps.push('No future education goals');
    actions.push('Add a degree/certificate/program you want to pursue');
  }

  // 5. Institution / issuer confidence (10)
  const recognizableRecords = [
    ...degrees.map((d) => !!(d.school_domain || d.school_logo_url)),
    ...creds.map((c) => !!c.issuer_domain),
  ];
  let instPts = 0;
  if (recognizableRecords.length) {
    const recognized = recognizableRecords.filter(Boolean).length;
    instPts = Math.round(clamp((recognized / recognizableRecords.length) * 10, 0, 10));
  }
  components.push({
    key: 'institution',
    label: 'Institution / issuer confidence',
    score: instPts,
    max: 10,
    reason: recognizableRecords.length
      ? `${recognizableRecords.filter(Boolean).length}/${recognizableRecords.length} records tied to a recognized school/issuer`
      : 'No school/issuer records to verify',
  });
  if (recognizableRecords.length && instPts < 6) {
    gaps.push('Schools/issuers not recognized');
    actions.push('Pick your school/issuer from the catalog so it carries a verified logo');
  }

  // 6. Career alignment (10) — honest heuristic from explicit signals only.
  let alignPts = 0;
  const goalWithRole = goals.some((g) => g.target_role);
  if (goalWithRole) alignPts += 5;
  if (careerGoals > 0 && (degrees.length > 0 || courses.length > 0 || creds.length > 0))
    alignPts += 5;
  alignPts = clamp(alignPts, 0, 10);
  components.push({
    key: 'career_alignment',
    label: 'Career alignment',
    score: alignPts,
    max: 10,
    reason:
      alignPts === 0
        ? 'No explicit link between education and a career direction'
        : `${goalWithRole ? 'Education goal names a target role' : ''}${
            goalWithRole && careerGoals ? '; ' : ''
          }${careerGoals ? 'education paired with active career goals' : ''}`,
  });
  if (alignPts < 5) {
    gaps.push('Education not clearly tied to a career goal');
    actions.push('Set a target role on your education goal, or add a career goal');
  }

  // 7. Data completeness (5)
  const sources = [degrees.length, creds.length, courses.length, goals.length];
  const populated = sources.filter((n) => n > 0).length;
  const completePts = Math.round(clamp((populated / sources.length) * 5, 0, 5));
  components.push({
    key: 'completeness',
    label: 'Data completeness',
    score: completePts,
    max: 5,
    reason: `${populated} of ${sources.length} education data areas have entries`,
  });

  const dataPoints = sources.reduce((a, b) => a + b, 0);
  const score = Math.round(components.reduce((a, c) => a + c.score, 0));
  const status = statusFor(score, dataPoints);
  const confidence = confidenceFor(populated, sources.length, dataPoints);

  const dataSources: string[] = [];
  if (degrees.length) dataSources.push('public.education_records');
  if (data.certifications?.length) dataSources.push('education.certifications');
  if (data.licenses?.length) dataSources.push('education.licenses');
  if (courses.length) dataSources.push('public.courses');
  if (goals.length) dataSources.push('education.education_goals');

  const missingData: string[] = [];
  if (!degrees.length) missingData.push('Degrees / diplomas');
  if (!creds.length) missingData.push('Certificates / licenses');
  if (!courses.length) missingData.push('Classes / courses');
  if (!goals.length) missingData.push('Future education goals');

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
