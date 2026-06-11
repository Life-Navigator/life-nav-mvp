// Honest empty states for Health tabs not fully built — shared DomainEmptyState (never "Coming soon").
// Documents tab carries a PII/health-privacy warning; every tab carries the medical-safety footer.
import { DomainEmptyState } from '@/components/domain/framework';

type TabCopy = {
  title: string;
  missing: string[];
  unlocks: string[];
  action: { label: string; href: string };
};

const ADD = '/dashboard/healthcare/add';
const upload = (doc: string, ret: string) =>
  `/dashboard/documents?domain=health&doc_type=${doc}&return_to=${ret}`;

const HEALTH_TABS: Record<string, TabCopy> = {
  biometrics: {
    title: 'Your biometrics',
    missing: ['Height & weight', 'Blood pressure', 'Resting heart rate', 'Body composition'],
    unlocks: ['Trend tracking', 'Better readiness scoring'],
    action: { label: 'Enter health info', href: ADD },
  },
  fitness: {
    title: 'Your fitness',
    missing: ['Activity level', 'Workout frequency', 'Fitness goals'],
    unlocks: ['Fitness progress tracking', 'Energy + longevity planning'],
    action: { label: 'Enter fitness info', href: ADD },
  },
  nutrition: {
    title: 'Your nutrition',
    missing: ['Dietary pattern', 'Nutrition goals', 'Logged meals'],
    unlocks: ['Nutrition-consistency coaching', 'Health trend tracking'],
    action: { label: 'Enter nutrition info', href: ADD },
  },
  labs: {
    title: 'Your lab results',
    missing: ['A lab report (CBC, lipid panel, A1C…)'],
    unlocks: ['Lab trend tracking', 'Flags to discuss with your doctor'],
    action: {
      label: 'Upload lab report',
      href: upload('lab_report', '/dashboard/healthcare/labs'),
    },
  },
  medications: {
    title: 'Your medications',
    missing: ['Medication list', 'Dosages', 'Schedule'],
    unlocks: ['Adherence organization', 'Cost-risk planning'],
    action: {
      label: 'Upload medication list',
      href: upload('medication_list', '/dashboard/healthcare/medications'),
    },
  },
  documents: {
    title: 'Health documents',
    missing: [
      'Lab report',
      'Insurance card',
      'Medication list',
      'Doctor notes',
      'Health assessment',
      'Fitness report',
    ],
    unlocks: ['Auto-filled health data', 'Cost-risk planning', 'Healthcare affordability planning'],
    action: {
      label: 'Upload documents',
      href: '/dashboard/documents?domain=health&return_to=/dashboard/healthcare/documents',
    },
  },
  analysis: {
    title: 'Health analysis',
    missing: ['Health profile', 'Lab data', 'Habits (sleep / nutrition / exercise)'],
    unlocks: ['Strengths, risks, and gaps', 'Longevity planning'],
    action: { label: 'Continue health discovery', href: ADD },
  },
  recommendations: {
    title: 'Health recommendations',
    missing: ['Health profile', 'Health + fitness goals'],
    unlocks: ['Personalized organization steps', 'Affordability planning'],
    action: { label: 'Enter health info', href: ADD },
  },
  goals: {
    title: 'Health goals',
    missing: ['A health goal', 'A fitness goal'],
    unlocks: ['Progress tracking', 'A wellness roadmap'],
    action: { label: 'Set a health goal', href: ADD },
  },
  reports: {
    title: 'Health reports',
    missing: ['Health profile', 'Lab data', 'Fitness data'],
    unlocks: [
      'Health Snapshot',
      'Fitness Progress Report',
      'Lab Trends Report',
      'Health Readiness Report',
    ],
    action: { label: 'Enter health info', href: ADD },
  },
};

export default function HealthTabEmpty({ tab }: { tab: keyof typeof HEALTH_TABS }) {
  const t = HEALTH_TABS[tab];
  if (!t) return null;
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t.title}</h2>
      {tab === 'documents' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
          <strong>Privacy:</strong> health documents may contain sensitive personal health
          information (PHI). Only upload what you're comfortable storing — you can remove documents
          at any time.
        </div>
      )}
      <DomainEmptyState
        title={t.title}
        missing={t.missing}
        unlocks={t.unlocks}
        nextAction={t.action}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        LifeNavigator is not medical advice. Health features are for organization, planning, and
        discussion with qualified professionals.
      </p>
    </div>
  );
}
