'use client';

// In-app Executive Report Viewer (Finish Line — trust & consistency).
// Surfaces the EXISTING GET /v1/reports/{type}/preview JSON (via /api/reports/{type}/preview)
// that was built and wired to nothing. No new intelligence, no fabricated data: every section
// reads a real preview-JSON field and renders an honest empty state when that field is absent.
// Section order leads with the narrative, then Goals/Risks/Opportunities/Constraints/
// Recommendations/Decision Tradeoffs/Action Plan/Sources. The PDF download is retained.
// Design follows the brand teal-700 (#0f766e) ink-on-paper system (globals.css).

import React from 'react';
import { useParams } from 'next/navigation';

// --- preview-JSON shape (subset we read; everything optional → honest empty states) ---
type Evidence = { statement?: string | null; source?: string | null };
type Assumption = { label?: string | null; value?: string | null };
type Rec = {
  title?: string | null;
  priority?: string | null;
  why?: string | null;
  confidence?: number | null;
  expected_impact?: string | null;
  domains?: string[] | null;
  evidence?: Evidence[] | null;
  assumptions?: Assumption[] | null;
  unlocks?: string[] | null;
};
type Tradeoff = { between?: unknown; reason?: string | null; focus?: string | null };
// Constraints arrive from the life_model section as {label, detail} OBJECTS (snapshot.active_constraints),
// not bare strings. Accept either shape so we render the label, never raw JSON.
type Constraint = string | { label?: string | null; detail?: string | null };
// "Why Arcana believes this" — same explainability the dashboard shows; surfaced from advisor_executive.
type NarrativeExplanation = {
  why?: string | null;
  contributing_goals?: string[] | null;
  evidence_signals?: string[] | null;
  confidence_pct?: number | null;
  confidence_label?: string | null;
};
const constraintLabel = (c: Constraint): { label: string; detail?: string | null } =>
  typeof c === 'string'
    ? { label: c }
    : { label: String(c?.label ?? '').trim(), detail: c?.detail ?? null };
type Plan = {
  now?: (string | null)[] | null;
  next?: (string | null)[] | null;
  later?: (string | null)[] | null;
  blocked?: { title?: string | null; why?: string | null }[] | null;
};
type LifeBrief = {
  ready?: boolean;
  headline?: string | null;
  body?: string | null;
  situation?: string | null;
  tension?: string | null;
  stakes?: string | null;
  next_move?: string | null;
};
type AdvBody = {
  cover?: { readiness?: number | null; objective?: string | null; confidence_pct?: number | null };
  life_brief?: LifeBrief | null;
  vision?: string | null;
  primary_objective?: { title?: string | null; reasoning?: string | null };
  goals?: {
    title?: string | null;
    status?: string | null;
    progress?: number | null;
    category?: string | null;
    confirmation_status?: string | null;
    target_value?: unknown;
    current_value?: unknown;
  }[];
  recommendations?: Rec[];
  next_best_action?: Rec | null;
  narrative_explanation?: NarrativeExplanation | null;
  risks?: string[];
  opportunities?: string[];
  missing_data?: string[];
  plan_90?: Plan;
  appendix?: {
    evidence_count?: number;
    recommendation_count?: number;
    goal_count?: number;
    avg_confidence_pct?: number | null;
  };
};
type LifeModelBody = {
  life_vision?: string | null;
  primary_objective?: {
    title?: string | null;
    confidence?: number | null;
    reasoning?: string | null;
  };
  themes?: string[] | null;
  constraints?: Constraint[] | null;
  opportunities?: string[] | null;
  tradeoffs?: Tradeoff[] | null;
};
type Section = { key: string; title: string; ord: number; body: Record<string, unknown> };
type ReportDef = {
  report_type: string;
  title: string;
  version?: number;
  sections: Section[];
  citations?: string[];
  governance?: { disclaimer_text?: string | null } | null;
};
type Preview = { format?: string; report?: ReportDef };

const REPORT_TITLES: Record<string, string> = {
  full: 'Full Life Report',
  financial: 'Financial Report',
  compensation: 'Compensation & Benefits',
  family: 'Family & Protection',
  decision: 'Decision Report',
  education: 'Education Report',
  health: 'Health & Wellness',
};

function findBody<T>(report: ReportDef | undefined, key: string): T | undefined {
  const s = report?.sections?.find((x) => x.key === key);
  return s?.body as T | undefined;
}

const isFilled = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';

// --- small presentational primitives (brand teal/ink) ---
function SectionShell({
  n,
  title,
  children,
}: {
  n?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--brand-line)] bg-white p-6 shadow-sm">
      <div className="flex items-baseline gap-2">
        {n != null && (
          <span className="text-xs font-semibold text-[#0f766e]">{String(n).padStart(2, '0')}</span>
        )}
        <h2 className="text-base font-semibold tracking-tight text-[#0b0b0f]">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-gray-400">{children}</p>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#e6f2f0] px-2 py-0.5 text-xs font-medium text-[#0f766e]">
      {children}
    </span>
  );
}

function RecCard({ rec }: { rec: Rec }) {
  const evidence = (rec.evidence ?? []).filter((e) => e && (e.statement || e.source));
  const assumptions = (rec.assumptions ?? []).filter((a) => a && (a.label || a.value));
  return (
    <div className="rounded-lg border border-[var(--brand-line)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0b0b0f]">{rec.title || 'Recommendation'}</h3>
        <div className="flex items-center gap-1.5">
          {rec.priority && <Chip>{rec.priority}</Chip>}
          {rec.confidence != null && <Chip>{Math.round(rec.confidence * 100)}% confidence</Chip>}
        </div>
      </div>
      {rec.why && <p className="mt-1.5 text-sm text-gray-600">{rec.why}</p>}
      {/* Quantified impact — only when the engine populated it; never invented. */}
      {isFilled(rec.expected_impact) ? (
        <p className="mt-2 text-sm font-medium text-[#0f766e]">{rec.expected_impact}</p>
      ) : (
        <p className="mt-2 text-xs italic text-gray-400">Impact not yet quantified</p>
      )}
      {(rec.domains ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rec.domains!.map((d, i) => (
            <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
              {d}
            </span>
          ))}
        </div>
      )}
      {evidence.length > 0 && (
        <div className="mt-3 border-t border-[var(--brand-line)] pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Evidence
          </p>
          <ul className="mt-1 space-y-1">
            {evidence.map((e, i) => (
              <li key={i} className="text-xs text-gray-600">
                {e.statement}
                {e.source && <span className="ml-1.5 text-gray-400">· {e.source}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {assumptions.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          Assumptions:{' '}
          {assumptions.map((a, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {a.label}
              {a.value != null && a.value !== '' ? `: ${a.value}` : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export default function ReportViewerPage() {
  const params = useParams<{ type: string }>();
  const type = params?.type ?? 'full';
  const [data, setData] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/reports/${type}/preview`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Report unavailable (${r.status})`);
        return r.json();
      })
      .then((j) => {
        if (alive) setData(j);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load report');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type]);

  const report = data?.report;
  const adv = findBody<AdvBody>(report, 'advisor_executive');
  const lm = findBody<LifeModelBody>(report, 'life_model');
  const exec = findBody<Record<string, unknown>>(report, 'executive_summary');

  // Narrative LEAD: prefer the life_brief paragraph if the payload carries it; otherwise fall
  // back to the existing vision + objective reasoning. Never fabricate.
  const brief = adv?.life_brief ?? null;
  const narrativeBody =
    (brief && (brief.body || brief.situation)) ||
    adv?.vision ||
    lm?.life_vision ||
    adv?.primary_objective?.reasoning ||
    null;
  const narrativeHeadline = brief?.headline || null;

  const goals = adv?.goals ?? [];
  const tradeoffs = lm?.tradeoffs ?? [];
  const risks = (adv?.risks ?? []) as string[];
  const opportunities = (adv?.opportunities ?? lm?.opportunities ?? []) as string[];
  // Constraints are {label,detail} objects (or strings) — normalize to labels so we never render raw JSON.
  const constraints = ((lm?.constraints ?? []) as Constraint[])
    .map(constraintLabel)
    .filter((c) => c.label);
  // "Why Arcana believes this" — same explainability the dashboard renders; null until a narrative exists.
  const narrativeWhy = adv?.narrative_explanation ?? null;
  const whyGoals = (narrativeWhy?.contributing_goals ?? []).filter((g) => g && g.trim());
  const whySignals = (narrativeWhy?.evidence_signals ?? []).filter((s) => s && s.trim());
  const recs = adv?.recommendations ?? [];
  const plan = adv?.plan_90 ?? {};
  const citations = report?.citations ?? [];

  let sn = 0; // running section number (only for the family-office body sections)
  const next = () => (sn += 1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header / cover */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
            Life Briefing
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0b0b0f]">
            {report?.title || REPORT_TITLES[type] || 'Report'}
          </h1>
          {report?.version != null && (
            <p className="mt-1 text-xs text-gray-400">
              v{report.version} · evidence-grounded · same inputs → same report
            </p>
          )}
        </div>
        <a
          href={`/api/reports/${type}/pdf`}
          className="inline-flex items-center rounded-md bg-[#0f766e] px-4 py-2 text-sm font-medium text-white hover:bg-[#0c5f59]"
        >
          Download PDF
        </a>
      </div>

      {/* Cover badges */}
      {adv?.cover && (
        <div className="mb-6 flex flex-wrap gap-2">
          {adv.cover.objective && <Chip>Objective: {adv.cover.objective}</Chip>}
          {adv.cover.confidence_pct != null && <Chip>{adv.cover.confidence_pct}% confidence</Chip>}
          {adv.cover.readiness != null && <Chip>Readiness {adv.cover.readiness}</Chip>}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading your report…</p>}
      {error && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}. You can still{' '}
          <a className="font-medium underline" href={`/api/reports/${type}/pdf`}>
            download the PDF
          </a>
          .
        </div>
      )}

      {!loading && !error && report && (
        <div className="space-y-5">
          {/* Executive Summary */}
          <SectionShell title="Executive Summary">
            {isFilled(adv?.vision) ? (
              <p className="text-sm text-gray-700">{adv!.vision}</p>
            ) : isFilled(exec) ? (
              <dl className="grid grid-cols-1 gap-1 text-sm text-gray-700 sm:grid-cols-2">
                {Object.entries(exec!).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd>{Array.isArray(v) ? v.join(', ') : String(v ?? '')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Empty>Summary not yet available — add data to generate one.</Empty>
            )}
          </SectionShell>

          {/* Current Narrative — LEAD with the story */}
          <SectionShell n={next()} title="Current Narrative">
            {narrativeHeadline && (
              <p className="font-display text-lg text-[#0b0b0f]">{narrativeHeadline}</p>
            )}
            {isFilled(narrativeBody) ? (
              <p className={`text-sm text-gray-700 ${narrativeHeadline ? 'mt-2' : ''}`}>
                {narrativeBody}
              </p>
            ) : (
              <Empty>Your story is still forming — answer a few questions to ground it.</Empty>
            )}
            {brief && (brief.tension || brief.stakes || brief.next_move) && (
              <dl className="mt-3 space-y-2 text-sm">
                {brief.tension && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Tension</dt>
                    <dd className="text-gray-700">{brief.tension}</dd>
                  </div>
                )}
                {brief.stakes && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Stakes</dt>
                    <dd className="text-gray-700">{brief.stakes}</dd>
                  </div>
                )}
                {brief.next_move && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Next move</dt>
                    <dd className="text-gray-700">{brief.next_move}</dd>
                  </div>
                )}
              </dl>
            )}
          </SectionShell>

          {/* Why Arcana believes this — explainability for the dominant narrative. Renders only when the
              engine supplied a rationale (same source the dashboard reads); honest empty → section omitted. */}
          {narrativeWhy?.why && (
            <SectionShell n={next()} title="Why Arcana believes this">
              <p className="text-sm text-gray-700">{narrativeWhy.why}</p>
              {whyGoals.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Which goals contributed
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {whyGoals.map((g, i) => (
                      <Chip key={i}>{g}</Chip>
                    ))}
                  </div>
                </div>
              )}
              {whySignals.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    What evidence supports it
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-600">
                    {whySignals.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(narrativeWhy.confidence_label || narrativeWhy.confidence_pct != null) && (
                <p className="mt-3 text-[11px] text-gray-400">
                  {narrativeWhy.confidence_label
                    ? `${narrativeWhy.confidence_label} confidence`
                    : 'Confidence'}
                  {narrativeWhy.confidence_pct != null ? ` · ${narrativeWhy.confidence_pct}%` : ''}
                </p>
              )}
            </SectionShell>
          )}

          {/* Goals */}
          <SectionShell n={next()} title="Goals">
            {(lm?.primary_objective?.title || adv?.primary_objective?.title) && (
              <div className="mb-3 rounded-lg bg-[#e6f2f0] p-3">
                <p className="text-sm font-semibold text-[#0b0b0f]">
                  {lm?.primary_objective?.title || adv?.primary_objective?.title}
                  {lm?.primary_objective?.confidence != null && (
                    <span className="ml-2 text-xs font-normal text-[#0f766e]">
                      {Math.round((lm.primary_objective.confidence ?? 0) * 100)}% confidence
                    </span>
                  )}
                </p>
                {(lm?.primary_objective?.reasoning || adv?.primary_objective?.reasoning) && (
                  <p className="mt-1 text-sm text-gray-600">
                    {lm?.primary_objective?.reasoning || adv?.primary_objective?.reasoning}
                  </p>
                )}
              </div>
            )}
            {goals.length > 0 ? (
              <ul className="space-y-2">
                {goals.map((g, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-[var(--brand-line)] p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-[#0b0b0f]">{g.title}</span>
                      {g.category && (
                        <span className="ml-2 text-xs text-gray-400">{g.category}</span>
                      )}
                      {/* Confirmation state — confirmed vs persona/candidate goal. Shown only when unconfirmed. */}
                      {g.confirmation_status &&
                        g.confirmation_status !== 'confirmed' &&
                        g.confirmation_status !== 'confirmed_goal' && (
                          <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            candidate
                          </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      {g.progress != null && <Chip>{g.progress}%</Chip>}
                      {g.status && <span className="text-xs text-gray-500">{g.status}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              !(lm?.primary_objective?.title || adv?.primary_objective?.title) && (
                <Empty>No goals captured yet.</Empty>
              )
            )}
          </SectionShell>

          {/* Risks */}
          <SectionShell n={next()} title="Risks">
            {risks.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {risks.map((r, i) => (
                  <li key={i}>{typeof r === 'string' ? r : JSON.stringify(r)}</li>
                ))}
              </ul>
            ) : (
              <Empty>No risks identified yet.</Empty>
            )}
          </SectionShell>

          {/* Opportunities */}
          <SectionShell n={next()} title="Opportunities">
            {opportunities.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {opportunities.map((o, i) => (
                  <li key={i}>{typeof o === 'string' ? o : JSON.stringify(o)}</li>
                ))}
              </ul>
            ) : (
              <Empty>No opportunities identified yet.</Empty>
            )}
          </SectionShell>

          {/* Constraints */}
          <SectionShell n={next()} title="Constraints">
            {constraints.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {constraints.map((c, i) => (
                  <li key={i}>
                    {c.label}
                    {c.detail && <span className="text-gray-400"> — {c.detail}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No active constraints recorded.</Empty>
            )}
          </SectionShell>

          {/* Recommendations */}
          <SectionShell n={next()} title="Recommendations">
            {adv?.next_best_action?.title && (
              <div className="mb-3 rounded-lg border-l-4 border-[#0f766e] bg-[#e6f2f0] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
                  Next best action
                </p>
                <p className="mt-0.5 text-sm font-medium text-[#0b0b0f]">
                  {adv.next_best_action.title}
                </p>
              </div>
            )}
            {recs.length > 0 ? (
              <div className="space-y-3">
                {recs.map((r, i) => (
                  <RecCard key={i} rec={r} />
                ))}
              </div>
            ) : (
              <Empty>No recommendations yet — add data so we can compute one.</Empty>
            )}
          </SectionShell>

          {/* Decision Tradeoffs */}
          <SectionShell n={next()} title="Decision Tradeoffs">
            {tradeoffs.length > 0 ? (
              <ul className="space-y-2">
                {tradeoffs.map((t, i) => (
                  <li key={i} className="rounded-lg border border-[var(--brand-line)] p-3 text-sm">
                    <p className="font-medium text-[#0b0b0f]">
                      {Array.isArray(t.between) ? t.between.join(' vs ') : String(t.between ?? '')}
                    </p>
                    {t.reason && <p className="mt-1 text-gray-600">{t.reason}</p>}
                    {t.focus && (
                      <p className="mt-1 text-xs text-[#0f766e]">Suggested focus: {t.focus}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No competing objectives to weigh yet.</Empty>
            )}
          </SectionShell>

          {/* Action Plan */}
          <SectionShell n={next()} title="Action Plan">
            {[
              ['Now', plan.now],
              ['Next', plan.next],
              ['Later', plan.later],
            ].some(([, v]) => Array.isArray(v) && v.length > 0) ||
            (plan.blocked && plan.blocked.length > 0) ? (
              <div className="space-y-3">
                {(
                  [
                    ['Now', plan.now],
                    ['Next', plan.next],
                    ['Later', plan.later],
                  ] as [string, (string | null)[] | null | undefined][]
                ).map(([label, items]) =>
                  items && items.length > 0 ? (
                    <div key={label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
                        {label}
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                        {items.filter(Boolean).map((it, i) => (
                          <li key={i}>{it}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
                {plan.blocked && plan.blocked.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                      Blocked — needs data
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                      {plan.blocked.map((b, i) => (
                        <li key={i}>
                          {b.title}
                          {b.why && <span className="text-gray-400"> — {b.why}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <Empty>No action plan yet — add data to sequence your next steps.</Empty>
            )}
            {adv?.missing_data && adv.missing_data.length > 0 && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  What unlocks stronger recommendations
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-600">
                  {adv.missing_data.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionShell>

          {/* Sources / Evidence */}
          <SectionShell n={next()} title="Sources & Evidence">
            {adv?.appendix && (
              <div className="mb-3 flex flex-wrap gap-2">
                {adv.appendix.evidence_count != null && (
                  <Chip>{adv.appendix.evidence_count} evidence items</Chip>
                )}
                {adv.appendix.recommendation_count != null && (
                  <Chip>{adv.appendix.recommendation_count} recommendations</Chip>
                )}
                {adv.appendix.goal_count != null && <Chip>{adv.appendix.goal_count} goals</Chip>}
                {adv.appendix.avg_confidence_pct != null && (
                  <Chip>avg {adv.appendix.avg_confidence_pct}% confidence</Chip>
                )}
              </div>
            )}
            {citations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {citations.map((c, i) => (
                  <span
                    key={i}
                    className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <Empty>No source tables cited yet.</Empty>
            )}
          </SectionShell>

          {/* Governance / disclaimer */}
          {report.governance?.disclaimer_text && (
            <p className="px-1 pt-2 text-xs text-gray-400">{report.governance.disclaimer_text}</p>
          )}
        </div>
      )}
    </div>
  );
}
