'use client';

import { useState } from 'react';
import type { RecommendationXAIBundle } from '@/types/provider-portal';
import type { ProviderDomain } from '@/types/provider';

interface Props {
  engagementId: string;
  patientUserId: string;
  scopeDomains: ProviderDomain[];
}

export function RecommendationBuilderForm({ engagementId, patientUserId, scopeDomains }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rationale, setRationale] = useState('');
  const [domain, setDomain] = useState<ProviderDomain>(scopeDomains[0] ?? 'health');
  const [horizon, setHorizon] = useState<string>('3');
  const [strength, setStrength] = useState<string>('0.5');
  const [assumptions, setAssumptions] = useState<string>('');
  const [risks, setRisks] = useState<string>('');
  const [citations, setCitations] = useState<string>(''); // newline-separated "label||source||citation"
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [bundle, setBundle] = useState<RecommendationXAIBundle | null>(null);

  function parseCitations(): RecommendationXAIBundle['evidence_links'] {
    return citations
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, source, citation_reference] = l.split('||').map((s) => s?.trim());
        return { label, source, citation_reference };
      });
  }

  async function submit() {
    setErrors([]);
    setWarnings([]);
    setSubmitting(true);
    const draft = {
      engagement_id: engagementId,
      patient_user_id: patientUserId,
      domain,
      title,
      body,
      rationale,
      expected_horizon_months: Number(horizon) || 3,
      expected_strength: Number(strength) || 0.5,
      citations: parseCitations(),
      assumptions: assumptions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      risks: risks
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const r = await fetch('/api/provider/portal/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const j = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) {
      setErrors(j?.errors ?? [j?.error ?? `request failed (${r.status})`]);
      return;
    }
    setWarnings(j?.warnings ?? []);
    setBundle(j?.xai ?? null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field label="Domain">
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as ProviderDomain)}
            className="form-input"
          >
            {scopeDomains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            placeholder="Add 2 weekly Zone 2 sessions"
          />
        </Field>
        <Field label="Body">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="form-input"
            placeholder="Patient should …"
          />
        </Field>
        <Field label="Rationale">
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
            className="form-input"
            placeholder="Why this matters …"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horizon (months)">
            <input
              type="number"
              min={1}
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Expected strength (0–1)">
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              className="form-input"
            />
          </Field>
        </div>
        <Field label="Assumptions (one per line)">
          <textarea
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
            rows={3}
            className="form-input"
            placeholder="Assumes baseline VO2 is correct."
          />
        </Field>
        <Field label="Risks (one per line)">
          <textarea
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
            rows={3}
            className="form-input"
            placeholder="May exacerbate plantar fasciitis."
          />
        </Field>
        <Field label='Citations — "label || source || citation_reference"'>
          <textarea
            value={citations}
            onChange={(e) => setCitations(e.target.value)}
            rows={3}
            className="form-input"
            placeholder="ACSM 11th ed. || ACSM || ch.7"
          />
        </Field>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? 'Issuing…' : 'Issue recommendation'}
        </button>
        {errors.length > 0 ? (
          <ul className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:border-rose-800">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-800">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        <style jsx>{`
          .form-input {
            display: block;
            width: 100%;
            border-radius: 0.375rem;
            border: 1px solid #cbd5e1;
            background-color: #fff;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
          }
        `}</style>
      </form>

      <section>
        <h3 className="text-sm font-semibold mb-2">XAI bundle</h3>
        {bundle ? (
          <XAIPanel bundle={bundle} />
        ) : (
          <div className="text-sm text-slate-500">
            Issue the recommendation to compute the XAI bundle.
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function XAIPanel({ bundle }: { bundle: RecommendationXAIBundle }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h4 className="font-medium">Why chain</h4>
        <ol className="mt-1 list-decimal pl-5 space-y-1">
          {bundle.why_chain.steps.map((s, i) => (
            <li key={i}>
              <span className="text-slate-500 mr-1">[L{s.depth}]</span>
              {s.claim}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h4 className="font-medium">Evidence</h4>
        <ul className="mt-1 list-disc pl-5">
          {bundle.evidence_links.length === 0 ? (
            <li className="text-slate-500">No citations attached.</li>
          ) : (
            bundle.evidence_links.map((c, i) => (
              <li key={i}>
                {c.label}
                {c.source ? ` — ${c.source}` : ''}
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <h4 className="font-medium">Assumptions</h4>
        <ul className="mt-1 space-y-1">
          {bundle.assumptions.length === 0 ? (
            <li className="text-slate-500">None.</li>
          ) : (
            bundle.assumptions.map((a, i) => (
              <li key={i}>
                <span
                  className={`mr-2 inline-block rounded px-2 py-0.5 text-xs ${
                    a.severity === 'critical'
                      ? 'bg-rose-100 text-rose-800'
                      : a.severity === 'load_bearing'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {a.severity}
                </span>
                {a.text}
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <h4 className="font-medium">Counterfactuals</h4>
        <ul className="mt-1 list-disc pl-5">
          {bundle.counterfactuals.map((c, i) => (
            <li key={i}>
              <strong>{c.perturbation}</strong>: {c.expected_change}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-medium">Tradeoffs</h4>
        <ul className="mt-1 list-disc pl-5">
          {bundle.tradeoffs.map((t, i) => (
            <li key={i}>
              <strong>{t.summary}</strong> — gives up: {t.gives_up}; gains: {t.gains}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-medium">Confidence</h4>
        <p className="mt-1">{(bundle.confidence * 100).toFixed(0)}%</p>
      </div>
    </div>
  );
}
