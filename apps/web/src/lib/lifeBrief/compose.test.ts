import { scoreCareer, type CareerData } from '@/lib/readiness/career';
import { scoreEducation, type EducationData } from '@/lib/readiness/education';
import { composeLifeBrief } from './compose';

const NOW = '2026-06-19T00:00:00.000Z';
const emptyCareer: CareerData = {
  experience: [],
  volunteer: [],
  sideProjects: [],
  goals: [],
  certifications: [],
  licenses: [],
};
const emptyEdu: EducationData = {
  degrees: [],
  courses: [],
  certifications: [],
  licenses: [],
  goals: [],
};

const richCareer: CareerData = {
  experience: [
    { title: 'VP Engineering', employer: 'Acme', start_date: '2010-01-01', is_current: true },
    { title: 'Eng Manager', employer: 'Globex', start_date: '2006-01-01', end_date: '2010-01-01' },
    { title: 'Engineer', employer: 'Initech', start_date: '2003-01-01', end_date: '2006-01-01' },
  ],
  volunteer: [{ organization: 'Code.org', role: 'Lead Mentor', is_current: true }],
  sideProjects: [{ name: 'OSS' }, { name: 'SaaS' }, { name: 'Blog' }],
  goals: [{ title: 'Become CTO', target_role: 'CTO', target_date: '2028-01-01', status: 'active' }],
  certifications: [{ name: 'AWS' }, { name: 'CKA' }],
  licenses: [{ name: 'PE' }, { name: 'PMP' }],
};
const richEdu: EducationData = {
  degrees: [
    {
      degree_type: 'master',
      status: 'completed',
      school_domain: 'stanford.edu',
      field_of_study: 'CS',
      institution_name: 'Stanford',
    },
  ],
  courses: [{ course_name: 'ML' }, { course_name: 'Stats' }, { course_name: 'NLP' }],
  certifications: [{ name: 'AWS', issuer_domain: 'aws.amazon.com' }],
  licenses: [{ name: 'PE' }],
  goals: [{ title: 'Exec ed', target_role: 'CEO', target_date: '2028-01-01', status: 'active' }],
  careerGoalsCount: 1,
};

const compose = (c: CareerData, e: EducationData) =>
  composeLifeBrief(scoreCareer(c, NOW), c, scoreEducation(e, NOW), e, NOW);

// Forbidden inferences the brief must never make (Phase 6C).
const FORBIDDEN = /salary|\$\d|satisfaction|\bfamily\b|\bhealth\b|\bROI\b|trajectory|prestig/i;
const textOf = (b: ReturnType<typeof compose>) =>
  [b.title, b.summary, b.careerInsight, b.educationInsight, ...b.strengths, ...b.gaps].join(' ');

describe('composeLifeBrief', () => {
  it('empty user → state empty, zero scores, missing data, no fabrication', () => {
    const b = compose(emptyCareer, emptyEdu);
    expect(b.state).toBe('empty');
    expect(b.readiness.career.score).toBe(0);
    expect(b.readiness.education.score).toBe(0);
    expect(b.missingData.length).toBeGreaterThan(0);
    expect(b.summary).toMatch(/don't know enough/i);
    expect(FORBIDDEN.test(textOf(b))).toBe(false);
  });

  it('limited career only → state limited, career facts present, education flagged empty', () => {
    const b = compose(
      { ...emptyCareer, experience: [{ title: 'Analyst', employer: 'Acme', is_current: true }] },
      emptyEdu
    );
    expect(b.state).toBe('limited');
    expect(b.careerInsight).toMatch(/Analyst/);
    expect(b.educationInsight).toMatch(/No education data/i);
    expect(b.readiness.education.status).toBe('not_started');
    expect(FORBIDDEN.test(textOf(b))).toBe(false);
  });

  it('limited education only → state limited, education facts present, career flagged empty', () => {
    const b = compose(emptyCareer, {
      ...emptyEdu,
      degrees: [
        {
          degree_type: 'bachelor',
          status: 'completed',
          institution_name: 'MIT',
          school_domain: 'mit.edu',
          field_of_study: 'EE',
        },
      ],
    });
    expect(b.state).toBe('limited');
    expect(b.careerInsight).toMatch(/No career data/i);
    expect(b.educationInsight).toMatch(/MIT|Bachelor/i);
    expect(FORBIDDEN.test(textOf(b))).toBe(false);
  });

  it('rich career + education → state rich, scores high, summary references real role + scores', () => {
    const b = compose(richCareer, richEdu);
    expect(b.state).toBe('rich');
    expect(b.readiness.career.score).toBeGreaterThanOrEqual(70);
    expect(b.readiness.education.score).toBeGreaterThanOrEqual(60);
    expect(b.summary).toMatch(/VP Engineering/);
    expect(b.summary).toMatch(/readiness/i);
    expect(b.strengths.length).toBeGreaterThan(0);
    // A near-perfect user legitimately has no recommended actions — never fabricate one.
    expect(Array.isArray(b.nextBestActions)).toBe(true);
    expect(b.confidence).toBeGreaterThanOrEqual(50);
    expect(FORBIDDEN.test(textOf(b))).toBe(false);
  });

  it('conflicting/incomplete → low confidence labeled, no inflated next move', () => {
    const b = compose(
      {
        ...emptyCareer,
        experience: [{ is_current: true }],
        goals: [{ title: 'do better', status: 'active' }],
      },
      emptyEdu
    );
    expect(b.confidence).toBeLessThan(50);
    // low-confidence wording surfaces when an action is present
    if (b.nextBestActions[0]) expect(b.summary).toMatch(/limited data/i);
    expect(FORBIDDEN.test(textOf(b))).toBe(false);
  });

  it('brief changes with data: empty vs rich differ in title, summary, scores', () => {
    const empty = compose(emptyCareer, emptyEdu);
    const rich = compose(richCareer, richEdu);
    expect(empty.title).not.toBe(rich.title);
    expect(empty.summary).not.toBe(rich.summary);
    expect(rich.confidence).toBeGreaterThan(empty.confidence);
  });
});
