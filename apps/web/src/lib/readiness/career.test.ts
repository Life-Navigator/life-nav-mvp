import { scoreCareer, type CareerData } from './career';

const NOW = '2026-06-19T00:00:00.000Z';
const empty: CareerData = {
  experience: [],
  volunteer: [],
  sideProjects: [],
  goals: [],
  certifications: [],
  licenses: [],
};

describe('scoreCareer', () => {
  it('empty user → 0 / not_started, zero confidence, everything missing', () => {
    const r = scoreCareer(empty, NOW);
    expect(r.score).toBe(0);
    expect(r.status).toBe('not_started');
    expect(r.confidence).toBe(0);
    expect(r.dataSources).toHaveLength(0);
    expect(r.missingData).toEqual(
      expect.arrayContaining(['Employment history', 'Active career goals'])
    );
    // No fake assumptions: every component scored 0
    expect(r.components.every((c) => c.score === 0)).toBe(true);
  });

  it('limited-data user → low score, limited_data status', () => {
    const r = scoreCareer({ ...empty, experience: [{ title: 'Analyst', is_current: true }] }, NOW);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(40);
    expect(r.status).toBe('limited_data');
    // current role title present but no employer → partial (8), not full (15)
    expect(r.components.find((c) => c.key === 'current_role')!.score).toBe(8);
  });

  it('rich-data user → high score, strong/excellent, real strengths', () => {
    const r = scoreCareer(
      {
        experience: [
          { title: 'VP Engineering', employer: 'Acme', start_date: '2010-01-01', is_current: true },
          {
            title: 'Eng Manager',
            employer: 'Globex',
            start_date: '2006-01-01',
            end_date: '2010-01-01',
          },
          {
            title: 'Engineer',
            employer: 'Initech',
            start_date: '2003-01-01',
            end_date: '2006-01-01',
          },
        ],
        volunteer: [
          { organization: 'Code.org', role: 'Lead Mentor', is_current: true },
          { organization: 'Red Cross', role: 'Volunteer' },
        ],
        sideProjects: [{ name: 'OSS lib' }, { name: 'SaaS app' }, { name: 'Blog' }],
        goals: [
          { title: 'Become CTO', target_role: 'CTO', target_date: '2028-01-01', status: 'active' },
          {
            title: 'Board seat',
            target_role: 'Board Member',
            target_date: '2030-01-01',
            status: 'active',
          },
        ],
        certifications: [{ name: 'AWS SA' }, { name: 'CKA' }],
        licenses: [{ name: 'PE' }, { name: 'PMP' }],
      },
      NOW
    );
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(['strong', 'excellent']).toContain(r.status);
    expect(r.confidence).toBeGreaterThanOrEqual(80);
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.components.find((c) => c.key === 'current_role')!.score).toBe(15);
  });

  it('scores increase with data: empty < limited < rich', () => {
    const lim = scoreCareer(
      { ...empty, experience: [{ title: 'Analyst', is_current: true }] },
      NOW
    );
    const rich = scoreCareer(
      {
        experience: [{ title: 'VP', employer: 'Acme', start_date: '2010-01-01', is_current: true }],
        volunteer: [{ organization: 'X', role: 'Lead' }],
        sideProjects: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
        goals: [{ title: 'g', target_role: 'CTO', target_date: '2030-01-01', status: 'active' }],
        certifications: [{ name: 'AWS' }],
        licenses: [{ name: 'PE' }],
      },
      NOW
    );
    expect(scoreCareer(empty, NOW).score).toBeLessThan(lim.score);
    expect(lim.score).toBeLessThan(rich.score);
  });

  it('incomplete data (current flag but no title/employer, undated, untargeted goal) → no inflation, lower confidence', () => {
    const r = scoreCareer(
      {
        ...empty,
        experience: [{ is_current: true }], // current but blank
        goals: [{ title: 'Do better', status: 'active' }], // no target role/date
      },
      NOW
    );
    expect(r.components.find((c) => c.key === 'current_role')!.score).toBe(0); // no fabricated clarity
    expect(r.components.find((c) => c.key === 'goals')!.score).toBe(8); // present but unspecified
    expect(r.confidence).toBeLessThan(60);
  });
});
