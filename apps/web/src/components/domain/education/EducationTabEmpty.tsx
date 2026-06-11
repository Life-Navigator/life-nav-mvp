// Honest empty states for Education tabs not fully built — shared DomainEmptyState (never "Coming soon").
// ROI Analysis + Documents carry their domain-specific copy.
import { DomainEmptyState } from '@/components/domain/framework';

type TabCopy = {
  title: string;
  intro?: string;
  missing: string[];
  unlocks: string[];
  action: { label: string; href: string };
};

const ADD = '/dashboard/education/add';

const EDUCATION_TABS: Record<string, TabCopy> = {
  degrees: {
    title: 'Your degrees',
    missing: ['Degrees earned / in progress', 'Institution', 'Field of study', 'Graduation date'],
    unlocks: ['Credential tracking', 'Career alignment'],
    action: { label: 'Add education', href: ADD },
  },
  skills: {
    title: 'Your skills',
    missing: ['Skills from courses / credentials', 'Skill goals'],
    unlocks: ['Skill gap analysis', 'Career-aligned learning'],
    action: { label: 'Add education', href: ADD },
  },
  'career-alignment': {
    title: 'Career alignment',
    missing: ['Target role', 'Current / target credentials', 'Career goal'],
    unlocks: ['Credential-to-role mapping', 'A learning plan tied to your career'],
    action: { label: 'Continue education discovery', href: ADD },
  },
  'roi-analysis': {
    title: 'Education ROI',
    intro:
      'We need your target program, estimated cost, timeline, and career goal before we can calculate education ROI.',
    missing: ['Target program', 'Estimated cost', 'Timeline', 'Career goal'],
    unlocks: [
      'Payback period',
      'Income lift estimate',
      'Debt impact',
      'Career alignment',
      'Family / finance tradeoff',
    ],
    action: { label: 'Enter program details', href: ADD },
  },
  documents: {
    title: 'Education documents',
    missing: [
      'Transcript',
      'Certifications',
      'Degree plan',
      'Tuition bill',
      'Acceptance letter',
      'Financial aid letter',
      'Training certificates',
    ],
    unlocks: ['Auto-filled records', 'ROI inputs', 'Credential verification'],
    action: {
      label: 'Upload documents',
      href: '/dashboard/documents?domain=education&return_to=/dashboard/education/documents',
    },
  },
  recommendations: {
    title: 'Education recommendations',
    missing: ['An education goal', 'Education records'],
    unlocks: ['Program recommendations', 'Credential priorities'],
    action: { label: 'Enter education goal', href: ADD },
  },
  goals: {
    title: 'Education goals',
    missing: ['An education goal', 'Target credential + timeline'],
    unlocks: ['Progress tracking', 'A learning roadmap'],
    action: { label: 'Set an education goal', href: ADD },
  },
  reports: {
    title: 'Education reports',
    missing: ['Education records', 'ROI inputs', 'Career goal'],
    unlocks: [
      'Education Snapshot',
      'ROI Report',
      'Credential Gap Report',
      'Career Alignment Report',
      'Financing Report',
    ],
    action: { label: 'Enter education info', href: ADD },
  },
  settings: {
    title: 'Education settings',
    missing: ['Education preferences', 'Privacy + sharing settings'],
    unlocks: ['Tailored program alerts'],
    action: { label: 'Manage in your profile', href: '/dashboard/profile' },
  },
};

export default function EducationTabEmpty({ tab }: { tab: keyof typeof EDUCATION_TABS }) {
  const t = EDUCATION_TABS[tab];
  if (!t) return null;
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t.title}</h2>
      {t.intro && <p className="text-sm text-gray-600 dark:text-gray-300">{t.intro}</p>}
      <DomainEmptyState
        title={t.title}
        missing={t.missing}
        unlocks={t.unlocks}
        nextAction={t.action}
      />
    </div>
  );
}
