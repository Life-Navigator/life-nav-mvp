// Honest empty states for Career tabs that aren't fully built yet — uses the shared DomainEmptyState
// (never "Coming soon"/"No data"). One source of copy so every Career tab reads consistently.
import { DomainEmptyState } from '@/components/domain/framework';

type TabCopy = {
  title: string;
  missing: string[];
  unlocks: string[];
  action: { label: string; href: string };
};

const ADD = '/dashboard/career/add';

const CAREER_TABS: Record<string, TabCopy> = {
  experience: {
    title: 'Your work experience',
    missing: ['Current role + employer', 'Years of experience', 'Past roles'],
    unlocks: ['Seniority + market position', 'Tenure-based compensation bands'],
    action: { label: 'Enter career info', href: ADD },
  },
  certifications: {
    title: 'Your certifications',
    missing: ['Certifications earned', 'Issuing bodies', 'Expiry dates'],
    unlocks: ['Credential-based opportunity matching', 'Verified skills on your profile'],
    action: { label: 'Add certifications', href: ADD },
  },
  compensation: {
    title: 'Your compensation',
    missing: [
      'Current compensation',
      'Target compensation',
      'Total-comp components (bonus, equity)',
    ],
    unlocks: ['Underpayment detection', 'Cited market benchmark', 'A negotiation range'],
    action: { label: 'Enter compensation', href: ADD },
  },
  documents: {
    title: 'Career documents',
    missing: ['Resume', 'Offer letter', 'Employment contract', 'Performance reviews'],
    unlocks: ['Auto-filled experience', 'Compensation verification', 'Skill extraction'],
    action: {
      label: 'Upload documents',
      href: '/dashboard/documents?domain=career&return_to=/dashboard/career/documents',
    },
  },
  analysis: {
    title: 'Career analysis',
    missing: ['Career profile', 'A target role', 'Skills inventory'],
    unlocks: ['Strengths, risks, and gaps', 'Skill-gap analysis', 'Opportunity fit'],
    action: { label: 'Continue career discovery', href: ADD },
  },
  recommendations: {
    title: 'Career recommendations',
    missing: ['Career profile', 'A target role'],
    unlocks: ['Personalized next moves', 'Skill priorities tied to your goal'],
    action: { label: 'Build career profile', href: ADD },
  },
  goals: {
    title: 'Career goals',
    missing: ['A career goal', 'Target role + timeline'],
    unlocks: ['Progress tracking', 'A milestone roadmap'],
    action: { label: 'Set a career goal', href: ADD },
  },
  reports: {
    title: 'Career reports',
    missing: ['Career profile', 'Compensation data', 'Skills'],
    unlocks: [
      'Career Snapshot',
      'Skill Gap Report',
      'Compensation Report',
      'Career Readiness Report',
    ],
    action: { label: 'Build career profile', href: ADD },
  },
  settings: {
    title: 'Career settings',
    missing: ['Career preferences', 'Privacy + sharing settings'],
    unlocks: ['Tailored opportunity alerts'],
    action: { label: 'Manage in your profile', href: '/dashboard/profile' },
  },
};

export default function CareerTabEmpty({ tab }: { tab: keyof typeof CAREER_TABS }) {
  const t = CAREER_TABS[tab];
  if (!t) return null;
  return (
    <div className="space-y-5 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t.title}</h2>
      <DomainEmptyState
        title={t.title}
        missing={t.missing}
        unlocks={t.unlocks}
        nextAction={t.action}
      />
    </div>
  );
}
