import { scoreEducation, type EducationData } from './education';

const NOW = '2026-06-19T00:00:00.000Z';
const empty: EducationData = {
  degrees: [],
  courses: [],
  certifications: [],
  licenses: [],
  goals: [],
};

describe('scoreEducation', () => {
  it('empty user → 0 / not_started, zero confidence, everything missing', () => {
    const r = scoreEducation(empty, NOW);
    expect(r.score).toBe(0);
    expect(r.status).toBe('not_started');
    expect(r.confidence).toBe(0);
    expect(r.missingData).toEqual(
      expect.arrayContaining(['Degrees / diplomas', 'Future education goals'])
    );
    expect(r.components.every((c) => c.score === 0)).toBe(true);
  });

  it('limited-data user (one completed bachelor) → developing-ish, low-to-mid', () => {
    const r = scoreEducation(
      {
        ...empty,
        degrees: [{ degree_type: 'bachelor', status: 'completed', school_domain: 'mit.edu' }],
      },
      NOW
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.components.find((c) => c.key === 'degree')!.score).toBe(18);
    // recognized institution → institution confidence maxed for the single record
    expect(r.components.find((c) => c.key === 'institution')!.score).toBe(10);
  });

  it('in-progress degree counts half until completed', () => {
    const r = scoreEducation(
      { ...empty, degrees: [{ degree_type: 'bachelor', is_current: true }] },
      NOW
    );
    expect(r.components.find((c) => c.key === 'degree')!.score).toBe(9); // 18 * 0.5
  });

  it('rich-data user → strong/excellent with alignment', () => {
    const r = scoreEducation(
      {
        degrees: [
          {
            degree_type: 'master',
            status: 'completed',
            school_domain: 'stanford.edu',
            school_logo_url: 'x',
          },
          { degree_type: 'bachelor', status: 'completed', school_domain: 'mit.edu' },
        ],
        courses: [
          { course_name: 'ML', status: 'completed' },
          { course_name: 'Stats' },
          { course_name: 'NLP' },
        ],
        certifications: [
          { name: 'AWS', issuer_domain: 'aws.amazon.com' },
          { name: 'GCP', issuer_domain: 'google.com' },
        ],
        licenses: [{ name: 'PE', issuer_domain: 'nspe.org' }, { name: 'CPA' }],
        goals: [
          { title: 'Exec ed', target_role: 'CEO', target_date: '2028-01-01', status: 'active' },
          { title: 'PhD', target_role: 'Researcher', target_date: '2032-01-01', status: 'active' },
        ],
        careerGoalsCount: 2,
      },
      NOW
    );
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(['strong', 'excellent']).toContain(r.status);
    expect(r.components.find((c) => c.key === 'career_alignment')!.score).toBe(10);
  });

  it('scores increase with data: empty < limited < rich', () => {
    const lim = scoreEducation(
      { ...empty, degrees: [{ degree_type: 'bachelor', status: 'completed' }] },
      NOW
    );
    const rich = scoreEducation(
      {
        degrees: [{ degree_type: 'master', status: 'completed', school_domain: 'mit.edu' }],
        courses: [{ course_name: 'a' }, { course_name: 'b' }, { course_name: 'c' }],
        certifications: [{ name: 'x', issuer_domain: 'aws.amazon.com' }],
        licenses: [{ name: 'y' }],
        goals: [{ title: 'g', target_role: 'CTO', target_date: '2030-01-01', status: 'active' }],
        careerGoalsCount: 1,
      },
      NOW
    );
    expect(scoreEducation(empty, NOW).score).toBeLessThan(lim.score);
    expect(lim.score).toBeLessThan(rich.score);
  });

  it('unrecognized school lowers institution confidence (no fake verification)', () => {
    const r = scoreEducation(
      { ...empty, degrees: [{ degree_type: 'bachelor', status: 'completed' }] },
      NOW
    );
    // no school_domain/logo → institution score 0 even though a degree exists
    expect(r.components.find((c) => c.key === 'institution')!.score).toBe(0);
  });
});
