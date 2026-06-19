/**
 * Deterministic Life Brief composer.
 *
 * Builds a grounded, user-specific executive summary ENTIRELY from verified facts:
 * the Phase-7 readiness results (scores, strengths, gaps, actions, confidence,
 * sources, missing data) + hero facts derived from the same raw data (current role,
 * years, top degree). No LLM, so it cannot fabricate salary, satisfaction, family,
 * health, ROI, trajectory, or employer/degree prestige. Absent data → honest empty
 * states, never guesses.
 */
import type { ReadinessResult } from '@/lib/readiness/types';
import type { CareerData } from '@/lib/readiness/career';
import type { EducationData } from '@/lib/readiness/education';
import type { LifeBrief } from './types';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'not started',
  limited_data: 'limited data',
  developing: 'developing',
  strong: 'strong',
  excellent: 'excellent',
};

const DEGREE_LABEL: Record<string, string> = {
  high_school: 'High school diploma',
  associate: "Associate's",
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  doctorate: 'Doctorate',
  certificate: 'Certificate',
  bootcamp: 'Bootcamp',
};

const dedup = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));

function currentRoleFacts(c: CareerData) {
  const exp = c.experience || [];
  const current = exp.find((e) => e.is_current) || null;
  const starts = (exp.map((e) => e.start_date).filter(Boolean) as string[])
    .map((s) => new Date(s).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let years: number | null = null;
  if (starts.length) {
    years = Math.max(0, Math.round(((Date.now() - starts[0]) / (365.25 * 864e5)) * 10) / 10);
  }
  return {
    role: current?.title ?? null,
    employer: current?.employer ?? null,
    years,
  };
}

function topDegreeFacts(e: EducationData) {
  const completed = (e.degrees || []).filter((d) => (d.status ?? '').toLowerCase() === 'completed');
  const order = [
    'doctorate',
    'master',
    'bachelor',
    'associate',
    'certificate',
    'bootcamp',
    'high_school',
  ];
  let best: (typeof completed)[number] | null = null;
  for (const d of completed) {
    const rank = order.indexOf((d.degree_type ?? '').toLowerCase());
    const bestRank = best ? order.indexOf((best.degree_type ?? '').toLowerCase()) : 99;
    if (rank >= 0 && rank < bestRank) best = d;
  }
  if (!best) return null;
  return {
    label: DEGREE_LABEL[(best.degree_type ?? '').toLowerCase()] ?? 'Degree',
    field: best.field_of_study ?? null,
    institution: best.institution_name ?? null,
  };
}

export function composeLifeBrief(
  career: ReadinessResult,
  careerData: CareerData,
  education: ReadinessResult,
  educationData: EducationData,
  now: string
): LifeBrief {
  const careerHas = career.status !== 'not_started';
  const eduHas = education.status !== 'not_started';
  const state: LifeBrief['state'] =
    !careerHas && !eduHas
      ? 'empty'
      : careerHas && eduHas && career.confidence >= 50 && education.confidence >= 50
        ? 'rich'
        : 'limited';

  const role = currentRoleFacts(careerData);
  const degree = topDegreeFacts(educationData);
  const confidence = Math.round((career.confidence + education.confidence) / 2);

  // --- careerInsight (facts only) ---
  let careerInsight: string;
  if (!careerHas) {
    careerInsight =
      'No career data yet. Add your roles, credentials, and goals to unlock career readiness.';
  } else {
    const head = role.role
      ? `${role.role}${role.employer ? ` @ ${role.employer}` : ''}${role.years != null ? `, ~${role.years} yrs experience` : ''}. `
      : '';
    const s = career.strengths[0] ? `Strength: ${career.strengths[0]}. ` : '';
    const g = career.gaps[0] ? `Gap: ${career.gaps[0]}.` : '';
    careerInsight = `${head}${s}${g}`.trim();
  }

  // --- educationInsight (facts only) ---
  let educationInsight: string;
  if (!eduHas) {
    educationInsight =
      'No education data yet. Add your degrees, certificates, and licenses to unlock education readiness.';
  } else {
    const head = degree
      ? `${degree.label}${degree.field ? ` in ${degree.field}` : ''}${degree.institution ? ` from ${degree.institution}` : ''}. `
      : '';
    const s = education.strengths[0] ? `Strength: ${education.strengths[0]}. ` : '';
    const g = education.gaps[0] ? `Gap: ${education.gaps[0]}.` : '';
    educationInsight = `${head}${s}${g}`.trim();
  }

  // --- next best actions: lower-scoring domain first ---
  const careerFirst = career.score <= education.score;
  const nextBestActions = dedup(
    careerFirst
      ? [...career.recommendedActions, ...education.recommendedActions]
      : [...education.recommendedActions, ...career.recommendedActions]
  ).slice(0, 3);

  const strengths = dedup([...career.strengths, ...education.strengths]).slice(0, 4);
  const gaps = dedup([...career.gaps, ...education.gaps]).slice(0, 4);

  // --- title + summary ---
  let title: string;
  let summary: string;
  if (state === 'empty') {
    title = "Let's build your Life Brief";
    summary =
      "We don't know enough about your career or education yet. Add your work history, degrees, and goals — your Life Brief will then reflect exactly who you are, with no guessing.";
  } else {
    title = role.role
      ? `${role.role}${role.employer ? ` · ${role.employer}` : ''}`
      : degree
        ? `${degree.label}${degree.institution ? ` · ${degree.institution}` : ''}`
        : 'Your Life Brief';

    const heroSentence = role.role
      ? `${role.role}${role.employer ? ` at ${role.employer}` : ''}${role.years != null ? ` with ~${role.years} years of experience` : ''}.`
      : degree
        ? `${degree.label}${degree.field ? ` in ${degree.field}` : ''}${degree.institution ? ` from ${degree.institution}` : ''}.`
        : "You've started building your profile.";

    const careerPart = careerHas
      ? `career readiness ${career.score}/100 (${STATUS_LABEL[career.status]})`
      : 'career not started yet';
    const eduPart = eduHas
      ? `education readiness ${education.score}/100 (${STATUS_LABEL[education.status]})`
      : 'education not started yet';
    const readinessSentence = `Your ${careerPart}; ${eduPart}.`;

    const action = nextBestActions[0];
    const lowConf = confidence < 50;
    const actionSentence = action
      ? `${lowConf ? `Based on limited data (${confidence}% confidence), your` : 'Your'} most important next move: ${action.charAt(0).toLowerCase()}${action.slice(1)}.`
      : lowConf
        ? `This brief is based on limited data (${confidence}% confidence) — add more to sharpen it.`
        : '';

    summary = [heroSentence, readinessSentence, actionSentence].filter(Boolean).join(' ');
  }

  return {
    title,
    summary,
    careerInsight,
    educationInsight,
    strengths,
    gaps,
    nextBestActions,
    confidence,
    readiness: {
      career: {
        score: career.score,
        status: career.status,
        topStrength: career.strengths[0] ?? '',
        topGap: career.gaps[0] ?? '',
      },
      education: {
        score: education.score,
        status: education.status,
        topStrength: education.strengths[0] ?? '',
        topGap: education.gaps[0] ?? '',
      },
    },
    dataSources: dedup([...career.dataSources, ...education.dataSources]),
    missingData: dedup([...career.missingData, ...education.missingData]),
    state,
    updatedAt: now,
  };
}
