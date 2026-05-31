/**
 * @jest-environment node
 *
 * Determinism + per-dimension + composite tests for the marketplace matcher.
 */

import { matchOne, matchMany, MATCHER_VERSION } from '../matcher';
import { DIMENSION_WEIGHTS } from '@/types/marketplace';
import type { CandidateSnapshot, JobPostSnapshot } from '@/types/marketplace';

function baseJob(overrides: Partial<JobPostSnapshot> = {}): JobPostSnapshot {
  return {
    id: 'job-1',
    employer_id: 'emp-1',
    title: 'Senior Python Engineer',
    industry: 'software',
    employment_type: 'full_time',
    remote_mode: 'remote',
    experience_level: 'senior',
    salary_min: 140000,
    salary_max: 180000,
    salary_currency: 'USD',
    veteran_friendly: false,
    requirements: [
      { requirement_kind: 'skill_required', value: 'python', weight: 1 },
      { requirement_kind: 'skill_required', value: 'postgres', weight: 1 },
      { requirement_kind: 'skill_preferred', value: 'kubernetes', weight: 1 },
      { requirement_kind: 'education', value: 'bachelor', weight: 1 },
      { requirement_kind: 'certification', value: 'aws_solutions_architect', weight: 1 },
    ],
    locations: [{ city: 'Remote', state: null, country: 'US' }],
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<CandidateSnapshot> = {}): CandidateSnapshot {
  return {
    user_id: 'cand-1',
    current_title: 'Software Engineer',
    desired_title: 'Senior Python Engineer',
    desired_salary_min: 145000,
    desired_salary_max: 175000,
    skills: ['Python', 'Postgres', 'Kubernetes', 'React'],
    certifications: ['AWS_Solutions_Architect'],
    years_of_experience: 6,
    work_arrangement: 'remote',
    industry_interests: ['software'],
    relocation_willingness: 'national',
    job_change_willingness: 'passive',
    visibility: 'anonymous',
    desired_locations: [],
    city: 'Austin',
    state: 'TX',
    country: 'US',
    highest_completed_degree: 'bachelor',
    ...overrides,
  };
}

describe('determinism', () => {
  it('same job + candidate produces identical match every run', () => {
    const job = baseJob();
    const cand = baseCandidate();
    const a = matchOne(job, cand);
    const b = matchOne(job, cand);
    expect(a).toEqual(b);
  });
  it('exports a stable MATCHER_VERSION', () => {
    expect(MATCHER_VERSION).toBeTruthy();
  });
});

describe('skills', () => {
  it('full skill match scores high', () => {
    const r = matchOne(baseJob(), baseCandidate());
    expect(r.dimensions.skills_score).toBeGreaterThanOrEqual(95);
  });

  it('zero skill match scores 0 on the skills dimension', () => {
    const r = matchOne(baseJob(), baseCandidate({ skills: [] }));
    expect(r.dimensions.skills_score).toBe(0);
    expect(r.missing_requirements).toEqual(expect.arrayContaining(['python', 'postgres']));
  });

  it('half-required scores ~35 on skills dimension', () => {
    const r = matchOne(baseJob(), baseCandidate({ skills: ['python'] }));
    // 1/2 required (×70) + 0/1 preferred (×30) = 35
    expect(r.dimensions.skills_score).toBe(35);
  });

  it('preferred skill match without required scores 30', () => {
    const r = matchOne(baseJob(), baseCandidate({ skills: ['kubernetes'] }));
    // 0/2 required + 1/1 preferred = 30
    expect(r.dimensions.skills_score).toBe(30);
  });
});

describe('certifications', () => {
  it('matching certification scores 100', () => {
    const r = matchOne(baseJob(), baseCandidate());
    expect(r.dimensions.certifications_score).toBe(100);
  });
  it('missing certification scores 0', () => {
    const r = matchOne(baseJob(), baseCandidate({ certifications: [] }));
    expect(r.dimensions.certifications_score).toBe(0);
  });
});

describe('education', () => {
  it('bachelor meets bachelor → 100', () => {
    expect(matchOne(baseJob(), baseCandidate()).dimensions.education_score).toBe(100);
  });
  it('master exceeds bachelor → 100', () => {
    expect(
      matchOne(baseJob(), baseCandidate({ highest_completed_degree: 'master' })).dimensions
        .education_score
    ).toBe(100);
  });
  it('high_school below bachelor → 40', () => {
    expect(
      matchOne(baseJob(), baseCandidate({ highest_completed_degree: 'high_school' })).dimensions
        .education_score
    ).toBe(40);
  });
  it('no degree → 0', () => {
    expect(
      matchOne(baseJob(), baseCandidate({ highest_completed_degree: null })).dimensions
        .education_score
    ).toBe(0);
  });
});

describe('salary', () => {
  it('overlapping ranges → 100', () => {
    expect(matchOne(baseJob(), baseCandidate()).dimensions.salary_fit_score).toBe(100);
  });
  it('candidate target well above job max → penalized below 100', () => {
    const r = matchOne(
      baseJob(),
      baseCandidate({ desired_salary_min: 220000, desired_salary_max: 260000 })
    );
    expect(r.dimensions.salary_fit_score).toBeLessThan(100);
    // Job offers 140-180k; candidate wants 220-260k. 40k gap on a 240k mid
    // is ~17% — meaningful but not catastrophic. Confirm a perfect-overlap
    // baseline scores strictly higher.
    const overlap = matchOne(baseJob(), baseCandidate());
    expect(overlap.dimensions.salary_fit_score).toBeGreaterThan(r.dimensions.salary_fit_score);
  });

  it('huge salary gap collapses the score', () => {
    const r = matchOne(
      baseJob({ salary_min: 60000, salary_max: 70000 }),
      baseCandidate({ desired_salary_min: 220000, desired_salary_max: 260000 })
    );
    expect(r.dimensions.salary_fit_score).toBeLessThan(20);
  });
});

describe('location', () => {
  it('remote job + remote-willing candidate → 100', () => {
    expect(matchOne(baseJob(), baseCandidate()).dimensions.location_fit_score).toBe(100);
  });
  it('on-site job with no location overlap and no relocation → 20', () => {
    const job = baseJob({
      remote_mode: 'on_site',
      locations: [{ city: 'New York', state: 'NY', country: 'US' }],
    });
    const cand = baseCandidate({
      city: 'Seattle',
      state: 'WA',
      desired_locations: [],
      relocation_willingness: 'not_willing',
    });
    expect(matchOne(job, cand).dimensions.location_fit_score).toBe(20);
  });
  it('on-site job + candidate willing to relocate nationally → 60', () => {
    const job = baseJob({
      remote_mode: 'on_site',
      locations: [{ city: 'New York', state: 'NY', country: 'US' }],
    });
    const cand = baseCandidate({
      city: 'Seattle',
      state: 'WA',
      desired_locations: [],
      relocation_willingness: 'national',
    });
    expect(matchOne(job, cand).dimensions.location_fit_score).toBe(60);
  });
});

describe('composite + summary', () => {
  it('composite is the weighted sum of dimensions', () => {
    const r = matchOne(baseJob(), baseCandidate());
    const expected =
      r.dimensions.skills_score * DIMENSION_WEIGHTS.skills_score +
      r.dimensions.certifications_score * DIMENSION_WEIGHTS.certifications_score +
      r.dimensions.education_score * DIMENSION_WEIGHTS.education_score +
      r.dimensions.salary_fit_score * DIMENSION_WEIGHTS.salary_fit_score +
      r.dimensions.location_fit_score * DIMENSION_WEIGHTS.location_fit_score +
      r.dimensions.growth_alignment_score * DIMENSION_WEIGHTS.growth_alignment_score;
    expect(r.match_score).toBeCloseTo(expected, 1);
  });

  it('employer-facing summary references skills + education + salary + location', () => {
    const r = matchOne(baseJob(), baseCandidate());
    expect(r.employer_facing_summary.toLowerCase()).toContain('skills');
    expect(r.employer_facing_summary.toLowerCase()).toMatch(/education|salary|location/);
  });

  it('summary lists missing requirements when present', () => {
    const r = matchOne(baseJob(), baseCandidate({ skills: ['python'] }));
    expect(r.employer_facing_summary.toLowerCase()).toMatch(/missing/);
  });
});

describe('matchMany', () => {
  it('filters out hidden candidates', () => {
    const job = baseJob();
    const visible = baseCandidate({ user_id: 'v' });
    const hidden = baseCandidate({ user_id: 'h', visibility: 'hidden' });
    const results = matchMany(job, [visible, hidden]);
    expect(results.find((r) => r.user_id === 'h')).toBeUndefined();
    expect(results.find((r) => r.user_id === 'v')).toBeDefined();
  });

  it('returns results sorted by match_score descending', () => {
    const job = baseJob();
    const strong = baseCandidate({ user_id: 'strong' });
    const weak = baseCandidate({
      user_id: 'weak',
      skills: [],
      certifications: [],
      highest_completed_degree: 'high_school',
    });
    const results = matchMany(job, [weak, strong]);
    expect(results[0].user_id).toBe('strong');
    expect(results[1].user_id).toBe('weak');
  });
});
