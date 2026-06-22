'use client';

// Recommendation Roadmap (Sprint 28) — Now / Next / Later, not an unordered list. One highest-
// leverage action, then the next, then later. Each card is quantified (current→target→impact) with
// the visible priority formula + lifecycle actions. Same OS the dashboard/chat/reports/graph read.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  Database,
  GitBranch,
  HelpCircle,
  ShieldCheck,
  Gauge,
  FileWarning,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import TrustPrompt from '@/components/feedback/TrustPrompt';
import RecommendationQualityPrompt from '@/components/feedback/RecommendationQualityPrompt';
import ReturnIntentPrompt from '@/components/feedback/ReturnIntentPrompt';
import NpsPrompt from '@/components/feedback/NpsPrompt';

interface Formula {
  impact: number;
  confidence: number;
  urgency: number;
  evidence_strength: number;
  effort: number;
  priority_score: number;
}
interface Action {
  id: string;
  title: string;
  rec_type: string;
  source_module: string;
  confidence: number | null;
  current_state?: string | null;
  target_state?: string | null;
  delta?: string | null;
  quantified_impact?: Record<string, unknown>;
  why: string;
  recommended_action?: string;
  expected_benefit?: string;
  finding?: string;
  formula?: Formula;
  merged_from?: string[];
  impacted_domains?: string[];
  priority?: string;
  category?: string;
  // Explainability (real, persisted via recommendations_os; honest empties when absent)
  evidence?: { statement?: string; source_table?: string }[] | null;
  assumptions?: { label?: string; value?: string }[] | null;
  narrative?: {
    current?: string | null;
    target?: string | null;
    delta?: string | null;
    why?: string | null;
    expected_impact?: Record<string, unknown> | null;
  } | null;
  updated_at?: string | null;
}
interface Conflict {
  type: string;
  resource: string;
  reason: string;
  suggested_sequence: string[];
}
interface Roadmap {
  now: Action[];
  next: Action[];
  later: Action[];
  blocked_by: { id: string; title: string; why: string }[];
  conflicts: Conflict[];
  why_now?: string;
  note: string;
}

const TYPE: Record<string, string> = {
  ACTION: 'bg-indigo-100 text-indigo-700',
  RISK: 'bg-rose-100 text-rose-700',
  OPPORTUNITY: 'bg-emerald-100 text-emerald-700',
  DEPENDENCY: 'bg-amber-100 text-amber-700',
  INFORMATION: 'bg-gray-100 text-gray-600',
};

function Sec({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}
const Muted = ({ text }: { text: string }) => (
  <p className="text-xs italic text-gray-400">{text}</p>
);

// Recommendation explainability — surfaces ONLY the real persisted fields. Honest empties; never fabricates.
function Explainability({ a }: { a: Action }) {
  const qi = a.quantified_impact || {};
  const evidence = (a.evidence || []).filter((e) => e && (e.statement || e.source_table));
  const assumptions = (a.assumptions || []).filter((x) => x && (x.label || x.value));
  const unlocks = (qi.unlocked_capabilities as string[] | undefined) || [];
  const domains = a.impacted_domains || [];
  const impactBits: string[] = [];
  if (qi.financial_impact_annual)
    impactBits.push(`+$${Number(qi.financial_impact_annual).toLocaleString()}/yr`);
  if (qi.readiness_before != null && qi.readiness_after != null)
    impactBits.push(`readiness ${qi.readiness_before} → ${qi.readiness_after}`);
  if (qi.coverage_gap) impactBits.push(`coverage gap $${Number(qi.coverage_gap).toLocaleString()}`);
  if (a.expected_benefit) impactBits.push(a.expected_benefit);

  return (
    <div className="mt-3 grid gap-4 rounded-lg border border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2">
      {/* Why this matters */}
      <div className="sm:col-span-2">
        <Sec icon={HelpCircle} title="Why this matters">
          <p className="text-sm leading-relaxed text-gray-700">
            {a.narrative?.why || a.why || 'No explanation recorded yet.'}
          </p>
        </Sec>
      </div>

      {/* Data used */}
      <Sec icon={Database} title="Data used">
        {evidence.length ? (
          <ul className="space-y-1">
            {evidence.map((e, i) => (
              <li key={i} className="text-xs text-gray-700">
                • {e.statement || '(datapoint)'}
              </li>
            ))}
          </ul>
        ) : (
          <Muted text="No evidence attached yet." />
        )}
      </Sec>

      {/* Sources / evidence lineage */}
      <Sec icon={GitBranch} title="Source / evidence lineage">
        {evidence.some((e) => e.source_table) ? (
          <ul className="space-y-1">
            {evidence
              .filter((e) => e.source_table)
              .map((e, i) => (
                <li key={i} className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-500 ring-1 ring-gray-200">
                    {e.source_table}
                  </span>
                  <span className="text-gray-400">→ this recommendation</span>
                </li>
              ))}
          </ul>
        ) : (
          <Muted text="No source lineage recorded yet." />
        )}
      </Sec>

      {/* Missing data */}
      <Sec icon={FileWarning} title="Missing data">
        {unlocks.length ? (
          <div>
            <p className="text-xs text-gray-600">Add the underlying data to unlock:</p>
            <ul className="mt-0.5 space-y-0.5">
              {unlocks.slice(0, 4).map((u, i) => (
                <li key={i} className="text-xs text-amber-700">
                  • {u}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Muted text="No missing-data analysis available yet." />
        )}
      </Sec>

      {/* Assumptions */}
      <Sec icon={ShieldCheck} title="Assumptions">
        {assumptions.length ? (
          <ul className="space-y-1">
            {assumptions.map((x, i) => (
              <li key={i} className="text-xs text-gray-700">
                <span className="font-medium">{x.label || 'Assumption'}:</span> {x.value}
              </li>
            ))}
          </ul>
        ) : (
          <Muted text="No assumptions recorded yet." />
        )}
      </Sec>

      {/* Confidence + formula */}
      <Sec icon={Gauge} title="Confidence">
        <div className="text-xs text-gray-700">
          {a.confidence != null
            ? `${Math.round(a.confidence * 100)}% confidence`
            : 'Confidence not scored'}
        </div>
        {a.formula && (
          <div className="mt-1 font-mono text-[10px] text-gray-400">
            priority {a.formula.priority_score} = impact {a.formula.impact} × conf{' '}
            {a.formula.confidence} × urgency {a.formula.urgency} × evidence{' '}
            {a.formula.evidence_strength} ÷ effort {a.formula.effort}
          </div>
        )}
      </Sec>

      {/* Expected impact */}
      <Sec icon={GitBranch} title="Expected impact">
        {impactBits.length || a.narrative?.delta ? (
          <ul className="space-y-0.5">
            {impactBits.map((b, i) => (
              <li key={i} className="text-xs font-medium text-emerald-700">
                {b}
              </li>
            ))}
            {a.narrative?.delta && <li className="text-xs text-gray-600">{a.narrative.delta}</li>}
          </ul>
        ) : (
          <Muted text="No quantified impact recorded yet." />
        )}
      </Sec>

      {/* Affected domains + goals + last updated */}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
        <span>
          Affected domains:{' '}
          {domains.length ? (
            domains.map((dn) => (
              <span
                key={dn}
                className="mr-1 rounded-full bg-white px-2 py-0.5 capitalize text-gray-600 ring-1 ring-gray-200"
              >
                {dn}
              </span>
            ))
          ) : (
            <span className="italic text-gray-400">none recorded</span>
          )}
        </span>
        <span className="italic text-gray-400">Affected goals: none linked yet</span>
        {a.updated_at && <span>Updated {new Date(a.updated_at).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

// Pull every "estimated impact" datapoint we already compute into short, human chips.
function impactChips(a: Action): string[] {
  const qi = a.quantified_impact || {};
  const bits: string[] = [];
  if (qi.financial_impact_annual)
    bits.push(`+$${Number(qi.financial_impact_annual).toLocaleString()}/yr`);
  if (qi.readiness_before != null && qi.readiness_after != null)
    bits.push(`readiness ${qi.readiness_before} → ${qi.readiness_after}`);
  if (qi.coverage_gap) bits.push(`coverage gap $${Number(qi.coverage_gap).toLocaleString()}`);
  if (qi.estimated_value) bits.push(String(qi.estimated_value));
  if (a.expected_benefit) bits.push(a.expected_benefit);
  return bits;
}

function Card({
  a,
  lead,
  whyNumberOne,
  onAct,
  busy,
}: {
  a: Action;
  lead?: boolean;
  whyNumberOne?: string;
  onAct: (id: string, s: string) => void;
  busy: string;
}) {
  const qi = a.quantified_impact || {};
  const [open, setOpen] = useState(false);
  const chips = impactChips(a);
  const evidenceCount = (a.evidence || []).filter(
    (e) => e && (e.statement || e.source_table)
  ).length;
  return (
    <div
      className={`bg-white rounded-xl border p-5 ${lead ? 'border-indigo-300 shadow-md' : 'border-gray-100 shadow-sm'}`}
    >
      {/* Why this is #1 — surfaces the already-computed ranking rationale (why_ranking.why_number_one,
          delivered as roadmap.why_now). Only on the lead card; honest empty otherwise. */}
      {lead && whyNumberOne && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
          <span>
            <b>Why this is #1:</b> {whyNumberOne}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TYPE[a.rec_type] ?? TYPE.INFORMATION}`}
        >
          {a.rec_type}
        </span>
        <h3 className="font-semibold text-gray-900">{a.title}</h3>
      </div>
      {(a.current_state || a.target_state) && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
            Now: {a.current_state ?? '—'}
          </span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
            Target: {a.target_state ?? '—'}
          </span>
          {a.delta && <span className="text-emerald-600 font-medium">{a.delta}</span>}
        </div>
      )}
      <p className="text-sm text-gray-600 mt-2">{a.why}</p>
      {a.recommended_action && (
        <p className="text-sm text-gray-700 mt-1">
          <b>Do:</b> {a.recommended_action}
        </p>
      )}
      {/* Estimated impact — every quantified_impact / expected_benefit datapoint we already compute,
          shown up front (was previously dropped or buried in the drawer). */}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          {chips.map((c, i) => (
            <span
              key={i}
              className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-xs text-gray-400">
        {a.source_module} · confidence {Math.round((a.confidence ?? 0) * 100)}%
        {evidenceCount
          ? ` · ${evidenceCount} supporting datapoint${evidenceCount > 1 ? 's' : ''}`
          : ''}
        {a.merged_from?.length ? ` · merged ${a.merged_from.length} related finding(s)` : ''}
        {a.formula
          ? ` · priority ${a.formula.priority_score} = I${a.formula.impact}×C${a.formula.confidence}×U${a.formula.urgency}×E${a.formula.evidence_strength}÷${a.formula.effort}`
          : ''}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide' : 'Why, impact & evidence'}
      </button>
      {open && <Explainability a={a} />}
      <div className="mt-3 flex gap-2 flex-wrap">
        {[
          ['accepted', 'Accept'],
          ['in_progress', 'Start'],
          ['deferred', 'Defer'],
          ['completed', 'Complete'],
          ['dismissed', 'Dismiss'],
        ].map(([s, label]) => (
          <button
            key={s}
            disabled={busy === a.id}
            onClick={() => onAct(a.id, s)}
            className={`text-xs px-2.5 py-1 rounded-md border ${s === 'dismissed' ? 'border-gray-200 text-gray-500' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'} disabled:opacity-40`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pilot feedback for the roadmap. Trust + quality are tied to the lead (Now #1) recommendation; the
// session-level return-intent + NPS prompts show at most once per browser session (sessionStorage
// guard) so we never nag. Everything is skippable and nothing is sent unless the user submits.
function RecommendationsFeedback({ leadId }: { leadId?: string }) {
  const [recDismissed, setRecDismissed] = useState(false);
  // Read the per-session "already shown" flag lazily so SSR and the first client render agree.
  const [showSession, setShowSession] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('ln_session_feedback_shown') !== '1') {
        sessionStorage.setItem('ln_session_feedback_shown', '1');
        setShowSession(true);
      }
    } catch {
      // sessionStorage unavailable (private mode / SSR) — just skip the session prompt.
    }
  }, []);

  return (
    <section className="mt-8 space-y-3 border-t border-gray-100 pt-6" aria-label="Pilot feedback">
      {leadId && !recDismissed && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TrustPrompt recommendationId={leadId} onDismiss={() => setRecDismissed(true)} />
          <RecommendationQualityPrompt
            recommendationId={leadId}
            onDismiss={() => setRecDismissed(true)}
          />
        </div>
      )}
      {showSession && !sessionDismissed && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReturnIntentPrompt onDismiss={() => setSessionDismissed(true)} />
          <NpsPrompt onDismiss={() => setSessionDismissed(true)} />
        </div>
      )}
    </section>
  );
}

export default function RecommendationsPage() {
  const [d, setD] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/recommendations')
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null);
    setD(r);
    setLoading(false);
  }, []);
  useEffect(() => {
    // Render the existing roadmap IMMEDIATELY (the GET is fast), then refresh via the slow sync in the
    // background. Previously the page awaited the POST sync before its first GET, so a user with a real
    // roadmap stared at "Building your roadmap…" for 6–16s — it looked blank. Stale-while-revalidate.
    load();
    fetch('/api/recommendations', { method: 'POST' })
      .catch(() => {})
      .finally(() => load());
  }, [load]);

  const onAct = async (id: string, status: string) => {
    setBusy(id);
    await fetch('/api/recommendations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
    await load();
    setBusy('');
  };

  if (loading)
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Building your roadmap…</div>;
  if (!d)
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;

  const empty = !d.now.length && !d.next.length && !d.later.length;
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Your Roadmap</h1>
      <p className="text-sm text-gray-500 mt-1">
        Do <b>Now</b> first, then <b>Next</b>, then <b>Later</b> — your highest-leverage actions in
        sequence.
      </p>

      {d.conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {d.conflicts.map((c, i) => (
            <div key={i}>
              {c.reason}{' '}
              <span className="text-amber-600">Order: {c.suggested_sequence.join(' → ')}</span>
            </div>
          ))}
        </div>
      )}

      {empty ? (
        <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          No actions yet — upload a document (offer letter, 401k, benefits) and your roadmap appears
          here.
        </div>
      ) : (
        <>
          {d.now.length > 0 && (
            <section className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  Now
                </span>
              </div>
              <div className="space-y-3">
                {d.now.map((a) => (
                  <Card key={a.id} a={a} lead whyNumberOne={d.why_now} onAct={onAct} busy={busy} />
                ))}
              </div>
            </section>
          )}
          {d.next.length > 0 && (
            <section className="mt-6">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                Next
              </div>
              <div className="space-y-3">
                {d.next.map((a) => (
                  <Card key={a.id} a={a} onAct={onAct} busy={busy} />
                ))}
              </div>
            </section>
          )}
          {d.later.length > 0 && (
            <section className="mt-6">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                Later
              </div>
              <div className="space-y-3">
                {d.later.map((a) => (
                  <Card key={a.id} a={a} onAct={onAct} busy={busy} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {d.blocked_by.length > 0 && (
        <section className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">
            Unlock more by uploading
          </div>
          <div className="space-y-2">
            {d.blocked_by.map((b) => (
              <a
                key={b.id}
                href="/dashboard/documents"
                className="block bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 hover:bg-amber-100"
              >
                {b.title} <span className="text-amber-600">— {b.why}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <p className="mt-6 text-xs text-gray-400">{d.note}</p>

      {/* Non-blocking pilot feedback — tied to the lead (Now #1) recommendation, plus a once-per-
          session "how's it going?" return-intent + NPS. Only shown once there is a real roadmap. */}
      {!empty && <RecommendationsFeedback leadId={d.now[0]?.id} />}
    </div>
  );
}
