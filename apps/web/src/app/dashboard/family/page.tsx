'use client';

// Family Overview — a real household command center. Every number comes from a real API/table; absent
// data shows an honest empty/"not set" state. No fabricated counts, coverage, or readiness scores.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DomainLoadingState, DomainErrorState } from '@/components/domain/framework';

interface Rec {
  title?: string;
  description?: string | null;
  priority?: string | null;
}
interface FamilyVM {
  data?: {
    protection?: {
      life_coverage?: number | null;
      disability_coverage?: number | null;
      coverage_gap?: number | null;
    };
    readiness?: {
      dependents?: number;
      guardianship_status?: string | null;
      estate?: {
        has_will?: boolean;
        has_poa?: boolean;
        has_beneficiaries?: boolean;
        status?: string;
      } | null;
    };
    college?: {
      target_year?: number;
      projected_cost?: number;
      saved_amount?: number;
      funding_gap?: number;
    }[];
  };
  recommendations?: Rec[];
  confidence?: { score?: number };
}
type Row = { id: string; [k: string]: unknown };

const fmtUSD = (n: number | null | undefined) =>
  n == null
    ? null
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n);

async function getJSON(url: string): Promise<any> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

interface Loaded {
  vm: FamilyVM | null;
  members: Row[];
  pets: Row[];
  dependents: Row[];
  beneficiaries: Row[];
  emergency: Row[];
  advisors: Row[];
  guardianship: Row[];
}

export default function FamilyOverviewPage() {
  const [d, setD] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [vm, members, pets, dependents, beneficiaries, emergency, advisors, guardianship] =
        await Promise.all([
          getJSON('/api/family/summary'),
          getJSON('/api/family/members'),
          getJSON('/api/family/pets'),
          getJSON('/api/family/dependents'),
          getJSON('/api/family/beneficiaries'),
          getJSON('/api/family/emergency-contacts'),
          getJSON('/api/family/trusted-advisors'),
          getJSON('/api/family/guardianship'),
        ]);
      // The summary endpoint is the only one whose total failure we treat as an error; entity lists that
      // 404 (table not yet migrated) just mean "none yet".
      if (!active) return;
      if (vm === null) {
        setError(true);
        setLoading(false);
        return;
      }
      const items = (x: any): Row[] =>
        Array.isArray(x?.items) ? x.items : Array.isArray(x?.dependents) ? x.dependents : [];
      setD({
        vm,
        members: items(members),
        pets: items(pets),
        dependents: items(dependents),
        beneficiaries: items(beneficiaries),
        emergency: items(emergency),
        advisors: items(advisors),
        guardianship: items(guardianship),
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading)
    return (
      <div className="p-6">
        <DomainLoadingState />
      </div>
    );
  if (error)
    return (
      <div className="p-6">
        <DomainErrorState
          message="We couldn't load your family summary just now."
          onRetry={() => window.location.reload()}
        />
      </div>
    );

  const { vm, members, pets, dependents, beneficiaries, emergency, advisors, guardianship } = d!;
  const readiness = vm?.data?.readiness;
  const protection = vm?.data?.protection;
  const estate = readiness?.estate;
  const recs = vm?.recommendations ?? [];

  const score = vm?.confidence?.score;
  const scorePct = score == null ? null : score <= 1 ? Math.round(score * 100) : Math.round(score);
  const guardianStatus =
    guardianship.length > 0
      ? String((guardianship[0] as any).legal_doc_status || 'designated')
      : readiness?.guardianship_status || null;

  // Critical items that are genuinely missing (real checks, not invented).
  const missingCritical: string[] = [];
  if (beneficiaries.length === 0) missingCritical.push('Beneficiaries');
  if (emergency.length === 0) missingCritical.push('Emergency contact');
  if (!estate?.has_will) missingCritical.push('Will');
  if (!guardianStatus && (dependents.length > 0 || members.some((m) => isChild(m))))
    missingCritical.push('Guardian designation');
  if (protection?.life_coverage == null) missingCritical.push('Life insurance');

  const spouse = members.filter((m) => /spouse|partner/i.test(String(m.relationship || '')));
  const children = members.filter(isChild);
  const otherMembers = members.filter((m) => !spouse.includes(m) && !children.includes(m));

  return (
    <div className="space-y-5 p-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <LegalBoundary />
      </div>

      {/* ── Family Readiness Summary ── */}
      <Card title="Family readiness">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Metric label="Readiness score" value={scorePct == null ? '—' : `${scorePct}%`} />
          <Metric label="Dependents" value={String(dependents.length)} />
          <Metric label="Family members" value={String(members.length)} />
          <Metric label="Pets" value={String(pets.length)} />
          <Metric label="Beneficiaries" value={String(beneficiaries.length)} />
          <Metric label="Emergency contacts" value={String(emergency.length)} />
          <Metric label="Trusted advisors" value={String(advisors.length)} />
          <Metric label="Guardianship" value={guardianStatus ? cap(guardianStatus) : 'Not set'} />
          <Metric
            label="Estate plan"
            value={
              estate?.status
                ? cap(estate.status)
                : estate?.has_will
                  ? 'Will on file'
                  : 'Not started'
            }
          />
          <Metric
            label="Life insurance"
            value={fmtUSD(protection?.life_coverage) ?? 'Not recorded'}
          />
        </div>
        {missingCritical.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
            Missing critical items: {missingCritical.join(', ')}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Household ── */}
        <Card title="Household">
          {members.length === 0 && pets.length === 0 && dependents.length === 0 ? (
            <Empty>
              No household members added yet.{' '}
              <Link href="/dashboard/family/members" className="text-indigo-600">
                Add family members →
              </Link>
            </Empty>
          ) : (
            <div className="space-y-3 text-sm">
              <Group label="Spouse / partner" rows={spouse} render={(m) => String(m.name)} />
              <Group
                label="Children"
                rows={children}
                render={(m) => `${m.name}${m.age ? ` · age ${m.age}` : ''}`}
              />
              <Group
                label="Dependents"
                rows={dependents}
                render={(m) =>
                  `${m.relationship || 'Dependent'}${m.birth_year ? ` · b. ${m.birth_year}` : ''}`
                }
              />
              <Group
                label="Other members"
                rows={otherMembers}
                render={(m) => `${m.name}${m.relationship ? ` · ${m.relationship}` : ''}`}
              />
              <Group
                label="Pets"
                rows={pets}
                render={(p) => `${p.name}${p.species ? ` · ${p.species}` : ''}`}
              />
            </div>
          )}
        </Card>

        {/* ── Protection ── */}
        <Card title="Protection & estate readiness">
          <ul className="space-y-2 text-sm">
            <StatusRow
              label="Life insurance"
              ok={protection?.life_coverage != null}
              okText={fmtUSD(protection?.life_coverage) ?? 'On file'}
              missText="Not recorded"
            />
            <StatusRow
              label="Disability insurance"
              ok={protection?.disability_coverage != null}
              okText={fmtUSD(protection?.disability_coverage) ?? 'On file'}
              missText="Not recorded"
            />
            <StatusRow label="Will" ok={!!estate?.has_will} okText="On file" missText="Missing" />
            <StatusRow
              label="Power of attorney"
              ok={!!estate?.has_poa}
              okText="On file"
              missText="Missing"
            />
            <StatusRow
              label="Beneficiaries"
              ok={beneficiaries.length > 0 || !!estate?.has_beneficiaries}
              okText={`${beneficiaries.length || 'On'} file`}
              missText="Missing"
            />
            <StatusRow
              label="Guardianship"
              ok={!!guardianStatus}
              okText={guardianStatus ? cap(guardianStatus) : ''}
              missText="Not designated"
            />
            <StatusRow
              label="Emergency contacts"
              ok={emergency.length > 0}
              okText={`${emergency.length} on file`}
              missText="None"
            />
          </ul>
        </Card>
      </div>

      {/* ── Education / Children planning ── */}
      <Card title="Education & children planning">
        {children.length === 0 && dependents.length === 0 ? (
          <Empty>No child education planning data recorded.</Empty>
        ) : (
          <div className="space-y-2 text-sm">
            {(vm?.data?.college ?? []).length > 0 ? (
              (vm!.data!.college ?? []).map((c, i) => (
                <div
                  key={i}
                  className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
                >
                  {c.target_year && <span>Target year {c.target_year}</span>}
                  {c.projected_cost != null && <span>Projected {fmtUSD(c.projected_cost)}</span>}
                  {c.saved_amount != null && <span>Saved {fmtUSD(c.saved_amount)}</span>}
                  {c.funding_gap != null && (
                    <span className="text-amber-600">Gap {fmtUSD(c.funding_gap)}</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500">
                {children.length + dependents.length} child(ren) / dependent(s) on file.
                {children.length
                  ? ` College planning: ${children.map((c) => String(c.college_planning_status || 'not started')).join(', ')}.`
                  : ''}{' '}
                <Link href="/dashboard/family/goals" className="text-indigo-600">
                  Add a college goal →
                </Link>
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Family risks / recommendations ── */}
      <Card title="Family risks & recommendations">
        {recs.length ? (
          <ul className="space-y-2 text-sm">
            {recs.slice(0, 6).map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-500">•</span>
                <span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {r.title ?? 'Recommendation'}
                  </span>
                  {r.description ? <span className="text-gray-500"> — {r.description}</span> : null}
                </span>
              </li>
            ))}
            <li className="pt-1">
              <Link href="/dashboard/family/recommendations" className="text-sm text-indigo-600">
                View all →
              </Link>
            </li>
          </ul>
        ) : (
          <Empty>No family-specific risks identified yet.</Empty>
        )}
      </Card>
    </div>
  );
}

function isChild(m: Row): boolean {
  const rel = String(m.relationship || '').toLowerCase();
  return rel === 'child' || rel.includes('son') || rel.includes('daughter');
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
      {children}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
function Group({
  label,
  rows,
  render,
}: {
  label: string;
  rows: Row[];
  render: (r: Row) => string;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <ul className="mt-0.5">
        {rows.map((r) => (
          <li key={r.id} className="text-gray-800 dark:text-gray-200">
            {render(r)}
          </li>
        ))}
      </ul>
    </div>
  );
}
function StatusRow({
  label,
  ok,
  okText,
  missText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  missText: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span
        className={
          ok
            ? 'font-medium text-emerald-600 dark:text-emerald-400'
            : 'text-amber-600 dark:text-amber-400'
        }
      >
        {ok ? okText || '✓' : missText}
      </span>
    </li>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}
export function LegalBoundary() {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      LifeNavigator is not a law firm and does not provide legal advice. Estate planning decisions
      should be reviewed with a qualified attorney.
    </p>
  );
}
