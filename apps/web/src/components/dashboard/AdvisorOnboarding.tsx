'use client';

// Onboarding action-card system + life-model confirmation screen for the Advisor.
// Pure UX/state: action cards are DERIVED on the client from the existing discovery signals
// (per-domain missing inputs) — no AI/model/recommendation logic here. Upload CTAs route to the
// real /dashboard/documents page; manual-entry CTAs open the existing AddDataModal.

import Link from 'next/link';

const RET = encodeURIComponent('/dashboard/advisor?onboarding=1');

export type ActionType =
  | 'upload_document'
  | 'quick_form'
  | 'manual_entry'
  | 'continue_discovery'
  | 'skip_for_now';

export interface AdvisorAction {
  domain: 'finance' | 'career' | 'education' | 'health' | 'family';
  type: ActionType;
  title: string;
  why_it_matters: string;
  what_it_unlocks: string;
  estimated_time: string;
  primary_cta_label: string;
  // Either a route (upload/quick_form pages) OR a manual-entry modal domain.
  href?: string;
  modalDomain?: 'financial' | 'health' | 'career' | 'education';
  // Beta: account-data uploads/entries are not supported (Plaid sandbox persona is the source).
  coming_soon?: boolean;
}

// Step 2 — domain prompt rules. Static catalog of the actions the advisor can surface per domain.
// Shown when a domain still has missing coverage. Upload → documents page; entry → AddDataModal.
export const DOMAIN_ACTIONS: Record<string, AdvisorAction[]> = {
  // P0.4: goal-target CTAs FIRST (things Plaid can't know — payoff/down-payment/fund targets), so the
  // top-2 recommended actions are always actionable. Account-data entries (income/401k) are beta-blocked
  // (Plaid persona is the source) and sink to the end as "Coming Soon".
  finance: [
    {
      domain: 'finance',
      type: 'manual_entry',
      title: 'Set your credit-card payoff target',
      why_it_matters: 'A monthly payoff target turns "pay down debt" into a real, trackable plan.',
      what_it_unlocks: 'debt-free date · interest saved',
      estimated_time: '1 min',
      primary_cta_label: 'Set payoff target',
      modalDomain: 'financial',
    },
    {
      domain: 'finance',
      type: 'manual_entry',
      title: 'Set your home down-payment goal',
      why_it_matters: 'A target down payment lets us time the larger house against your savings.',
      what_it_unlocks: 'home timeline · savings target',
      estimated_time: '1 min',
      primary_cta_label: 'Set down-payment goal',
      modalDomain: 'financial',
    },
    {
      domain: 'finance',
      type: 'manual_entry',
      title: 'Set an emergency-fund target',
      why_it_matters: 'A security cushion is the foundation before saving for the house.',
      what_it_unlocks: 'security cushion · risk buffer',
      estimated_time: '1 min',
      primary_cta_label: 'Set fund target',
      modalDomain: 'financial',
    },
    {
      domain: 'finance',
      type: 'upload_document',
      title: 'Upload an insurance policy',
      why_it_matters: 'Coverage gaps are a top risk for families — we check yours against need.',
      what_it_unlocks: 'coverage-gap analysis',
      estimated_time: '2 min',
      primary_cta_label: 'Upload policy',
      href: `/dashboard/documents?domain=finance&doc_type=insurance_policy&return_to=${RET}`,
    },
    {
      domain: 'finance',
      type: 'manual_entry',
      title: 'Enter your income',
      why_it_matters: 'Income drives savings rate, affordability, and retirement readiness.',
      what_it_unlocks: 'savings rate · home affordability',
      estimated_time: '1 min',
      primary_cta_label: 'Enter income',
      modalDomain: 'financial',
      coming_soon: true, // beta: income comes from the Plaid persona, not manual entry
    },
    {
      domain: 'finance',
      type: 'upload_document',
      title: 'Upload your 401(k) statement',
      why_it_matters:
        'Confirms balances and employer match so projections are real, not estimates.',
      what_it_unlocks: 'retirement projection · match-gap analysis',
      estimated_time: '2 min',
      primary_cta_label: 'Upload statement',
      href: `/dashboard/documents?domain=finance&doc_type=retirement_statement&return_to=${RET}`,
      coming_soon: true, // account-data upload not supported in beta (Plaid persona is the source)
    },
  ],
  career: [
    {
      domain: 'career',
      type: 'upload_document',
      title: 'Upload your resume',
      why_it_matters: 'Lets the advisor read your real experience instead of asking 20 questions.',
      what_it_unlocks: 'market value · skill-gap analysis',
      estimated_time: '2 min',
      primary_cta_label: 'Upload resume',
      href: `/dashboard/documents?domain=career&doc_type=resume&return_to=${RET}`,
    },
    {
      domain: 'career',
      type: 'manual_entry',
      title: 'Enter current & target role',
      why_it_matters:
        'Anchors your compensation benchmark and the path between today and your goal.',
      what_it_unlocks: 'comp benchmark · promotion path',
      estimated_time: '1 min',
      primary_cta_label: 'Enter roles',
      modalDomain: 'career',
    },
  ],
  education: [
    {
      domain: 'education',
      type: 'upload_document',
      title: 'Upload a transcript',
      why_it_matters: 'Captures completed credits so program planning starts from where you are.',
      what_it_unlocks: 'program planning · credit transfer',
      estimated_time: '2 min',
      primary_cta_label: 'Upload transcript',
      href: `/dashboard/documents?domain=education&doc_type=transcript&return_to=${RET}`,
    },
    {
      domain: 'education',
      type: 'manual_entry',
      title: 'Enter your education goal',
      why_it_matters: 'A target degree/certification lets us cost and time the path.',
      what_it_unlocks: 'cost projection · timeline',
      estimated_time: '1 min',
      primary_cta_label: 'Enter goal',
      modalDomain: 'education',
    },
  ],
  health: [
    {
      domain: 'health',
      type: 'manual_entry',
      title: 'Enter your health goals',
      why_it_matters: 'Goals let the advisor connect health to longevity and cost planning.',
      what_it_unlocks: 'longevity view',
      estimated_time: '1 min',
      primary_cta_label: 'Enter goals',
      modalDomain: 'health',
    },
    {
      domain: 'health',
      type: 'upload_document',
      title: 'Upload a lab report',
      why_it_matters:
        'Optional — improves the health picture. (Avoid uploading sensitive identifiers.)',
      what_it_unlocks: 'health trend tracking',
      estimated_time: '2 min',
      primary_cta_label: 'Upload report',
      href: `/dashboard/documents?domain=health&doc_type=lab_report&return_to=${RET}`,
    },
  ],
  family: [
    {
      domain: 'family',
      type: 'upload_document',
      title: 'Upload estate / insurance documents',
      why_it_matters: 'Will, POA, and life coverage are core to protecting dependents.',
      what_it_unlocks: 'protection-gap · estate readiness',
      estimated_time: '2 min',
      primary_cta_label: 'Upload documents',
      href: `/dashboard/documents?domain=family&doc_type=estate_document&return_to=${RET}`,
    },
  ],
};

const TONE: Record<string, string> = {
  finance: 'border-l-emerald-500',
  career: 'border-l-purple-500',
  education: 'border-l-blue-500',
  health: 'border-l-rose-500',
  family: 'border-l-amber-500',
};

export function ActionCard({
  action,
  onManualEntry,
}: {
  action: AdvisorAction;
  onManualEntry: (domain: 'financial' | 'health' | 'career' | 'education') => void;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-4 ${TONE[action.domain]} bg-white p-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">{action.title}</h4>
        <span className="text-[10px] text-gray-400 whitespace-nowrap">{action.estimated_time}</span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{action.why_it_matters}</p>
      <p className="mt-1 text-[11px] text-emerald-700">Unlocks: {action.what_it_unlocks}</p>
      <div className="mt-2">
        {action.coming_soon ? (
          <div>
            <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed">
              Coming Soon
            </span>
            <p className="mt-1.5 text-[11px] text-gray-400">
              During beta, financial account data comes from the Plaid sandbox persona you selected.
            </p>
          </div>
        ) : action.type === 'manual_entry' && action.modalDomain ? (
          <button
            onClick={() => onManualEntry(action.modalDomain!)}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {action.primary_cta_label}
          </button>
        ) : action.href ? (
          <Link
            href={`${action.href}&reason=${encodeURIComponent(action.why_it_matters)}&unlock=${encodeURIComponent(action.what_it_unlocks)}`}
            className="inline-block text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {action.primary_cta_label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export interface CoverageDomain {
  domain: string;
  label: string;
  coverage_pct: number;
  confidence_pct: number;
  missing: string[];
  unlocks: string[];
  cta: string | null;
}
export interface CandidateGoal {
  goal: string;
  objective?: string;
  domain?: string;
  status?: string;
  supporting_quote?: string | null;
}
export interface PanelLike {
  life_vision?: string | null;
  primary_objective?: string | null;
  // P0.2 — the goals the advisor actually heard, in the user's own words (the source of truth for review).
  candidate_goals?: CandidateGoal[];
  priorities_i_heard?: string[];
  domains_touched?: string[];
  top_themes?: string[];
  top_constraints?: string[];
  top_risks?: string[];
  missing_areas?: string[];
  discovery_completion_pct?: number;
}

// Step 5 — "Here is what I understand about you." Review the life model before dashboard unlock.
export function LifeModelConfirmation({
  panel,
  coverage,
  actions,
  onConfirm,
  onEdit,
  onSkip,
  onManualEntry,
  finishing,
}: {
  panel: PanelLike;
  coverage: CoverageDomain[];
  actions: AdvisorAction[];
  onConfirm: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onManualEntry: (domain: 'financial' | 'health' | 'career' | 'education') => void;
  finishing: boolean;
}) {
  const topActions = actions.slice(0, 3);
  // P0.2: the confirmation renders the goals the advisor HEARD (user's own words), not a stale label.
  const heard =
    panel.candidate_goals && panel.candidate_goals.length > 0
      ? panel.candidate_goals.map((g) => ({ text: g.goal, future: g.status === 'future_goal' }))
      : (panel.priorities_i_heard || []).map((t) => ({ text: t, future: false }));
  // P0.6: nothing heard yet AND no vision → an intelligent missing state, never a blank section.
  const nothingYet = heard.length === 0 && !panel.life_vision;

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Here&apos;s what I understand about you
          </h2>
          <p className="text-sm text-gray-500">Review this before we open your dashboard.</p>
        </div>
        {typeof panel.discovery_completion_pct === 'number' && (
          <span className="shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1">
            {panel.discovery_completion_pct}% coverage
          </span>
        )}
      </div>

      {nothingYet && (
        // P0.6: intelligent missing state — never a blank confirmation.
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          I haven&apos;t captured your goals yet. Tell me, in your own words, what you&apos;re
          working toward — and I&apos;ll show it back to you here.
        </div>
      )}

      {panel.life_vision && (
        <Section label="Life vision">
          <span className="italic">“{panel.life_vision}”</span>
        </Section>
      )}

      {/* P0.2/P0.7: Priorities I Heard — the user's own words, in order, never collapsed to one label. */}
      {heard.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase text-gray-400 font-semibold">
            Priorities I heard
          </div>
          <ol className="mt-1 list-decimal list-inside text-sm text-gray-900 space-y-0.5">
            {heard.slice(0, 8).map((g, i) => (
              <li key={`${g.text}-${i}`}>
                {g.text}
                {g.future && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">
                    · later
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {panel.top_constraints && panel.top_constraints.length > 0 && (
        <Section label="Constraints">{panel.top_constraints.join(', ')}</Section>
      )}
      {panel.top_risks && panel.top_risks.length > 0 && (
        <Section label="Risks">{panel.top_risks.slice(0, 3).join(', ')}</Section>
      )}

      {coverage.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase text-gray-400 font-semibold mb-2">
            Domain coverage
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {coverage.map((c) => (
              <div key={c.domain} className="rounded-lg border border-gray-100 p-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{c.label}</span>
                  <span className="text-gray-500">{c.coverage_pct}%</span>
                </div>
                {c.missing?.length > 0 && (
                  <div className="text-[11px] text-rose-600 mt-0.5">
                    Missing:{' '}
                    {c.missing
                      .slice(0, 2)
                      .map((m) => m.replace(/_/g, ' '))
                      .join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {topActions.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase text-gray-400 font-semibold mb-2">
            Recommended next data
          </div>
          <div className="grid grid-cols-1 gap-2">
            {topActions.map((a, i) => (
              <ActionCard key={i} action={a} onManualEntry={onManualEntry} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={onConfirm}
          disabled={finishing}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {finishing ? 'Opening your dashboard…' : 'Looks right — enter dashboard'}
        </button>
        <button
          onClick={onEdit}
          disabled={finishing}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Edit priorities
        </button>
        <button
          onClick={onEdit}
          disabled={finishing}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Add something important
        </button>
        <button
          onClick={onSkip}
          disabled={finishing}
          className="px-4 py-2 rounded-lg text-gray-400 text-sm underline hover:text-gray-600 disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase text-gray-400 font-semibold">{label}</div>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}
