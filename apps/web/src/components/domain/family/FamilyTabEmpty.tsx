// Honest empty states for Family tabs — shared DomainEmptyState (never "Coming soon"). Estate /
// Guardianship / Beneficiaries / Documents carry the legal-boundary note (not legal advice).
import { DomainEmptyState } from '@/components/domain/framework';

type TabCopy = {
  title: string;
  intro?: string;
  known?: string[];
  missing: string[];
  unlocks: string[];
  action: { label: string; href: string };
  legal?: boolean;
};

const ADD = '/dashboard/documents?domain=family&return_to=/dashboard/family';
const PROFILE = '/dashboard/profile';

const FAMILY_TABS: Record<string, TabCopy> = {
  members: {
    title: 'Family members',
    missing: ['Spouse / partner', 'Children', 'Parents / caregivers'],
    unlocks: ['Protection analysis', 'Survivor planning'],
    action: { label: 'Add family details', href: ADD },
  },
  dependents: {
    title: 'Dependents',
    missing: ['Dependents', 'Ages', 'Support needs'],
    unlocks: ['Coverage gap analysis', 'College funding planning'],
    action: { label: 'Add dependents', href: ADD },
  },
  goals: {
    title: 'Family goals',
    missing: ['A family goal (home, college, vacation, legacy)'],
    unlocks: ['Goal tracking', 'A funding plan'],
    action: { label: 'Set a family goal', href: ADD },
  },
  estate: {
    title: 'Estate',
    known: ['Spouse', 'Children', 'Dependents', 'Assets'],
    missing: ['Will', 'Trust', 'Guardian selections', 'Executor', 'Beneficiaries'],
    unlocks: [
      'Estate readiness',
      'Inheritance planning',
      'Family protection analysis',
      'Guardian planning',
    ],
    action: { label: 'Upload estate documents', href: ADD },
    legal: true,
  },
  beneficiaries: {
    title: 'Beneficiaries',
    missing: [
      'Beneficiaries on accounts',
      'Accounts needing beneficiaries',
      'Contingent beneficiaries',
    ],
    unlocks: ['Beneficiary audit', 'Inheritance planning'],
    action: { label: 'Add beneficiary information', href: ADD },
    legal: true,
  },
  guardianship: {
    title: 'Guardianship',
    intro:
      'If you have children, designating a guardian ensures they are cared for by people you choose. If you don’t yet, this becomes important as your family grows.',
    missing: ['Guardian designations', 'Backup guardian', 'Guardianship documents'],
    unlocks: ['Guardian planning', 'Child protection'],
    action: { label: 'Plan guardianship', href: ADD },
    legal: true,
  },
  'trusted-advisors': {
    title: 'Trusted advisors',
    intro: 'No trusted advisors have been added yet.',
    missing: ['CPA', 'Attorney', 'Financial advisor', 'Insurance agent'],
    unlocks: ['Coordinated planning', 'One place for your whole team'],
    action: { label: 'Add a trusted advisor', href: PROFILE },
  },
  'emergency-contacts': {
    title: 'Emergency contacts',
    missing: ['Spouse / partner', 'Family member', 'Trusted friend', 'Caregiver'],
    unlocks: ['Quick access in a crisis', 'Shared with the right people'],
    action: { label: 'Add an emergency contact', href: PROFILE },
  },
  documents: {
    title: 'Family documents',
    missing: [
      'Will',
      'Trust',
      'Power of Attorney',
      'Advance Directive',
      'Guardianship documents',
      'Life Insurance',
      'Estate Inventory',
      'Beneficiary forms',
    ],
    unlocks: ['Auto-filled estate readiness', 'Beneficiary audit', 'Protection analysis'],
    action: {
      label: 'Upload documents',
      href: '/dashboard/documents?domain=family&return_to=/dashboard/family/documents',
    },
    legal: true,
  },
  recommendations: {
    title: 'Family recommendations',
    missing: ['Family profile', 'Protection + estate data'],
    unlocks: [
      'Review life insurance',
      'Update beneficiaries',
      'Create a will',
      'Guardian planning',
    ],
    action: { label: 'Add family details', href: ADD },
  },
  reports: {
    title: 'Family reports',
    missing: ['Family profile', 'Protection data', 'Estate data'],
    unlocks: [
      'Family Snapshot',
      'Family Protection Report',
      'Estate Readiness Report',
      'Beneficiary Audit',
      'Guardian Planning Report',
      'Legacy Planning Report',
    ],
    action: { label: 'Add family details', href: ADD },
  },
  settings: {
    title: 'Family settings',
    missing: ['Family preferences', 'Privacy + sharing settings'],
    unlocks: ['Controlled sharing with advisors'],
    action: { label: 'Manage in your profile', href: PROFILE },
  },
};

export default function FamilyTabEmpty({ tab }: { tab: keyof typeof FAMILY_TABS }) {
  const t = FAMILY_TABS[tab];
  if (!t) return null;
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t.title}</h2>
      {t.intro && <p className="text-sm text-gray-600 dark:text-gray-300">{t.intro}</p>}
      <DomainEmptyState
        title={t.title}
        known={t.known}
        missing={t.missing}
        unlocks={t.unlocks}
        nextAction={t.action}
      />
      {t.legal && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          LifeNavigator is not a law firm and does not provide legal advice. Estate planning
          decisions should be reviewed with a qualified attorney.
        </p>
      )}
    </div>
  );
}
