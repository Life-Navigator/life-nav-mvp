/**
 * Deterministic Career-Marketplace matcher.
 *
 *   matchOne(job, candidate) → MatchResult
 *
 * Pure functions, no I/O. The composite is a weighted average across
 * six dimensions (see types/marketplace.ts for the weights).
 *
 * IMPORTANT COMPLIANCE NOTE:
 *   The matcher uses ONLY user-supplied, job-relevant data: skills,
 *   certifications, education level, experience years, salary, location,
 *   remote preference, willingness to relocate, target role, and industry
 *   interests. It does NOT touch — and the database tables it reads from
 *   do NOT contain — protected characteristics (race, age, religion,
 *   sexual orientation, national origin, marital/parental status, etc.).
 *   `veteran_status_voluntary` and `clearance` are voluntary user-supplied
 *   fields the candidate chose to share and are only used as positive
 *   eligibility signals when the job specifically calls them out.
 */

import {
  DIMENSION_WEIGHTS,
  EDUCATION_RANK,
  type CandidateSnapshot,
  type DimensionScores,
  type JobPostSnapshot,
  type JobRequirement,
  type MatchResult,
} from '@/types/marketplace';

export const MATCHER_VERSION = 'v1';

function lower(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function tokenize(arr: string[] | null | undefined): Set<string> {
  return new Set((arr ?? []).map(lower).filter(Boolean));
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// ---- per-dimension scorers ---------------------------------------------

function scoreSkills(
  reqs: JobRequirement[],
  candidateSkills: Set<string>
): {
  score: number;
  missing: string[];
} {
  const required = reqs
    .filter((r) => r.requirement_kind === 'skill_required')
    .map((r) => lower(r.value));
  const preferred = reqs
    .filter((r) => r.requirement_kind === 'skill_preferred')
    .map((r) => lower(r.value));

  if (required.length === 0 && preferred.length === 0) {
    return { score: 75, missing: [] }; // neutral when nothing specified
  }

  const reqSet = new Set(required);
  const prefSet = new Set(preferred);
  const reqMatches = intersectionSize(reqSet, candidateSkills);
  const prefMatches = intersectionSize(prefSet, candidateSkills);

  const reqShare = required.length > 0 ? reqMatches / required.length : 1;
  const prefShare = preferred.length > 0 ? prefMatches / preferred.length : 1;

  // 70 points for required + 30 for preferred.
  const score = clamp(reqShare * 70 + prefShare * 30);
  const missing = required.filter((r) => !candidateSkills.has(r));
  return { score, missing };
}

function scoreCertifications(
  reqs: JobRequirement[],
  candidateCerts: Set<string>
): {
  score: number;
  missing: string[];
} {
  const required = reqs
    .filter((r) => r.requirement_kind === 'certification')
    .map((r) => lower(r.value));
  if (required.length === 0) return { score: 75, missing: [] };
  const matches = required.filter((r) => candidateCerts.has(r));
  const score = (matches.length / required.length) * 100;
  return { score: clamp(score), missing: required.filter((r) => !candidateCerts.has(r)) };
}

function scoreEducation(
  reqs: JobRequirement[],
  candidateDegree: string | null
): {
  score: number;
  missing: string[];
} {
  const required = reqs
    .filter((r) => r.requirement_kind === 'education')
    .map((r) => lower(r.value))[0]; // we honor the first explicit education req
  if (!required) return { score: 75, missing: [] };
  const candRank = EDUCATION_RANK[lower(candidateDegree)] ?? 0;
  const reqRank = EDUCATION_RANK[required] ?? 0;
  if (candRank >= reqRank && candRank > 0) return { score: 100, missing: [] };
  if (candRank > 0)
    return { score: 40, missing: [`education ${required} (have ${candidateDegree})`] };
  return { score: 0, missing: [`education ${required}`] };
}

function scoreSalary(job: JobPostSnapshot, candidate: CandidateSnapshot): number {
  const jobMin = job.salary_min ?? null;
  const jobMax = job.salary_max ?? null;
  const candMin = candidate.desired_salary_min ?? null;
  const candMax = candidate.desired_salary_max ?? null;

  if (jobMin == null && jobMax == null) return 75; // employer left it blank
  if (candMin == null && candMax == null) return 75; // candidate didn't specify

  const cMin = candMin ?? candMax ?? 0;
  const cMax = candMax ?? candMin ?? 0;
  const jMin = jobMin ?? 0;
  const jMax = jobMax ?? jobMin ?? 0;

  // Overlap check.
  if (jMax >= cMin && cMax >= jMin) return 100;

  // No overlap — penalize by the gap relative to candidate's midpoint.
  const candMid = (cMin + cMax) / 2 || 1;
  const gap = jMax < cMin ? cMin - jMax : jMin - cMax;
  const gapPct = gap / candMid;
  // 10% gap → 70; 30% gap → 30; 50%+ gap → 0
  return clamp(100 - gapPct * 200, 0, 100);
}

function scoreLocation(job: JobPostSnapshot, candidate: CandidateSnapshot): number {
  if (job.remote_mode === 'remote') {
    return /remote|hybrid|on_site|onsite|any/.test(lower(candidate.work_arrangement)) ? 100 : 80;
  }
  // Hybrid / on-site → check city/state/country overlap.
  const jobLocs = (job.locations ?? []).map((l) =>
    [l.city, l.state, l.country].filter(Boolean).map(lower).join(', ')
  );
  const candidateCity = lower(candidate.city);
  const candidateState = lower(candidate.state);
  const candidateLocs = tokenize(candidate.desired_locations);

  for (const loc of jobLocs) {
    if (!loc) continue;
    if (candidateCity && loc.includes(candidateCity)) return 100;
    if (candidateState && loc.includes(candidateState)) return 85;
    for (const dl of candidateLocs) {
      if (loc.includes(dl) || dl.includes(loc)) return 90;
    }
  }
  // Willingness to relocate softens an otherwise-zero score.
  if (candidate.relocation_willingness === 'national') return 60;
  if (candidate.relocation_willingness === 'international') return 70;
  if (candidate.relocation_willingness === 'regional_only') return 40;
  return 20;
}

function scoreGrowth(job: JobPostSnapshot, candidate: CandidateSnapshot): number {
  let s = 50;
  const desired = lower(candidate.desired_title);
  const jobTitle = lower(job.title);
  if (desired && jobTitle && (desired.includes(jobTitle) || jobTitle.includes(desired))) s += 30;

  if (job.industry && tokenize(candidate.industry_interests).has(lower(job.industry))) s += 15;

  // Salary target alignment (rough income-growth proxy).
  if (
    candidate.desired_salary_max != null &&
    job.salary_max != null &&
    job.salary_max >= candidate.desired_salary_max
  ) {
    s += 10;
  }
  return clamp(s);
}

// ---- composite + summary ----------------------------------------------

function composite(d: DimensionScores): number {
  let total = 0;
  for (const key of Object.keys(d) as Array<keyof DimensionScores>) {
    total += d[key] * DIMENSION_WEIGHTS[key];
  }
  return Math.round(total * 100) / 100;
}

function summarize(
  job: JobPostSnapshot,
  d: DimensionScores,
  reqSkillsCount: number,
  reqSkillsHit: number,
  prefSkillsCount: number,
  prefSkillsHit: number,
  missing: string[]
): string {
  const parts: string[] = [];

  parts.push(
    reqSkillsCount > 0
      ? `Skills: ${reqSkillsHit}/${reqSkillsCount} required` +
          (prefSkillsCount > 0 ? `, ${prefSkillsHit}/${prefSkillsCount} preferred` : '')
      : 'Skills: no explicit requirement.'
  );

  if (d.education_score === 100) parts.push('Education meets requirement.');
  else if (d.education_score > 0) parts.push('Education partial match.');

  parts.push(
    d.salary_fit_score >= 95
      ? 'Salary aligned.'
      : d.salary_fit_score >= 60
        ? 'Salary close to candidate target.'
        : 'Salary gap.'
  );

  parts.push(
    d.location_fit_score >= 95
      ? job.remote_mode === 'remote'
        ? 'Location: remote-friendly.'
        : 'Location: city/state match.'
      : d.location_fit_score >= 60
        ? 'Location: candidate is open to relocation.'
        : 'Location gap.'
  );

  if (d.growth_alignment_score >= 80) parts.push('Strong growth alignment.');
  else if (d.growth_alignment_score >= 60) parts.push('Plausible growth alignment.');

  if (missing.length > 0) {
    parts.push(
      `Missing: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? `, +${missing.length - 4} more` : ''}.`
    );
  }
  return parts.join(' ');
}

/**
 * Score one (job, candidate) pair.
 */
export function matchOne(job: JobPostSnapshot, candidate: CandidateSnapshot): MatchResult {
  const candidateSkills = tokenize(candidate.skills);
  const candidateCerts = tokenize(candidate.certifications);
  const skillsResult = scoreSkills(job.requirements, candidateSkills);
  const certsResult = scoreCertifications(job.requirements, candidateCerts);
  const educationResult = scoreEducation(job.requirements, candidate.highest_completed_degree);
  const salaryScore = scoreSalary(job, candidate);
  const locationScore = scoreLocation(job, candidate);
  const growthScore = scoreGrowth(job, candidate);

  const dimensions: DimensionScores = {
    skills_score: skillsResult.score,
    certifications_score: certsResult.score,
    education_score: educationResult.score,
    salary_fit_score: salaryScore,
    location_fit_score: locationScore,
    growth_alignment_score: growthScore,
  };
  const match_score = composite(dimensions);
  const missing = [...skillsResult.missing, ...certsResult.missing, ...educationResult.missing];

  const reqSkillsCount = job.requirements.filter(
    (r) => r.requirement_kind === 'skill_required'
  ).length;
  const prefSkillsCount = job.requirements.filter(
    (r) => r.requirement_kind === 'skill_preferred'
  ).length;
  const reqSkillsHit =
    reqSkillsCount - skillsResult.missing.filter((m) => !m.startsWith('education')).length;
  const prefSkillsHit =
    prefSkillsCount === 0
      ? 0
      : prefSkillsCount -
        job.requirements
          .filter((r) => r.requirement_kind === 'skill_preferred')
          .filter((r) => !candidateSkills.has(lower(r.value))).length;

  return {
    user_id: candidate.user_id,
    match_score,
    dimensions,
    missing_requirements: missing,
    employer_facing_summary: summarize(
      job,
      dimensions,
      reqSkillsCount,
      reqSkillsHit,
      prefSkillsCount,
      prefSkillsHit,
      missing
    ),
    candidate_visibility_at_match: candidate.visibility,
  };
}

/**
 * Score a job against many candidates. Returns sorted desc.
 * Hidden candidates are filtered out — they explicitly opted not to be
 * surfaced to employers.
 */
export function matchMany(job: JobPostSnapshot, candidates: CandidateSnapshot[]): MatchResult[] {
  return candidates
    .filter((c) => c.visibility !== 'hidden')
    .map((c) => matchOne(job, c))
    .sort((a, b) => b.match_score - a.match_score);
}
