/**
 * Compact, factual snapshot summaries for Career & Education — the structured facts the
 * advisor PDF report shows above the readiness score (current role, counts, top degree…).
 *
 * Derived deterministically from the SAME CareerData/EducationData the scorers consume, using
 * the SAME derivations as the dashboard overview routes + Life Brief composer — so the PDF,
 * dashboard, and Life Brief never disagree. Facts only; absent inputs become null/0, never invented.
 */
import type { CareerData } from './career';
import type { EducationData } from './education';

export interface CareerSnapshotFacts {
  currentRole: string | null;
  currentEmployer: string | null;
  yearsExperience: number | null;
  employmentCount: number;
  volunteerCount: number;
  projectCount: number;
  activeCareerGoals: number;
}

export interface EducationSnapshotFacts {
  topEducation: { label: string; field: string | null; institution: string | null } | null;
  certificationsCount: number;
  licensesCount: number;
  coursesCount: number;
  educationGoalsCount: number;
}

const DEGREE_LABEL: Record<string, string> = {
  doctorate: 'Doctorate',
  master: "Master's",
  bachelor: "Bachelor's",
  associate: 'Associate',
  high_school: 'High School',
  certificate: 'Certificate',
  bootcamp: 'Bootcamp',
};

export function careerSnapshotFacts(c: CareerData): CareerSnapshotFacts {
  const exp = c.experience || [];
  const current = exp.find((e) => e.is_current) || null;
  // Years of experience: earliest start across roles → now (same computation as overview route).
  const starts = (exp.map((e) => e.start_date).filter(Boolean) as string[])
    .map((s) => new Date(s).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let yearsExperience: number | null = null;
  if (starts.length) {
    yearsExperience = Math.max(
      0,
      Math.round(((Date.now() - starts[0]) / (365.25 * 864e5)) * 10) / 10
    );
  }
  return {
    currentRole: current?.title ?? null,
    currentEmployer: current?.employer ?? null,
    yearsExperience,
    employmentCount: exp.length,
    volunteerCount: (c.volunteer || []).length,
    projectCount: (c.sideProjects || []).length,
    activeCareerGoals: (c.goals || []).filter((g) => (g.status ?? 'active') === 'active').length,
  };
}

export function educationSnapshotFacts(e: EducationData): EducationSnapshotFacts {
  // Top education: highest completed degree by rank (same order as the Life Brief composer).
  const order = [
    'doctorate',
    'master',
    'bachelor',
    'associate',
    'certificate',
    'bootcamp',
    'high_school',
  ];
  const completed = (e.degrees || []).filter((d) => (d.status ?? '').toLowerCase() === 'completed');
  let best: (typeof completed)[number] | null = null;
  for (const d of completed) {
    const rank = order.indexOf((d.degree_type ?? '').toLowerCase());
    const bestRank = best ? order.indexOf((best.degree_type ?? '').toLowerCase()) : 99;
    if (rank >= 0 && rank < bestRank) best = d;
  }
  const topEducation = best
    ? {
        label: DEGREE_LABEL[(best.degree_type ?? '').toLowerCase()] ?? 'Degree',
        field: best.field_of_study ?? null,
        institution: best.institution_name ?? null,
      }
    : null;
  return {
    topEducation,
    certificationsCount: (e.certifications || []).length,
    licensesCount: (e.licenses || []).length,
    coursesCount: (e.courses || []).length,
    educationGoalsCount: (e.goals || []).length,
  };
}
