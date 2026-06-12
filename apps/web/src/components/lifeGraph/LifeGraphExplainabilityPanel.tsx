'use client';

import { ShieldCheck, GitBranch, Calculator, Database } from 'lucide-react';
import type {
  LifeGraphNode,
  GraphRecommendation,
  DataSource,
  ScoreCalculation,
} from '@/types/lifeGraph';
import { DOMAIN_META } from '@/types/lifeGraph';

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-violet-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function Calc({ calc }: { calc: ScoreCalculation }) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {calc.formula}
      </div>
      <div className="space-y-1">
        {calc.terms.map((t) => (
          <div key={t.label} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-slate-400">{t.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400"
                style={{ width: `${t.weight * 100}%` }}
              />
            </div>
            <span className="w-9 text-right text-slate-500">{Math.round(t.weight * 100)}%</span>
          </div>
        ))}
      </div>
      {calc.adjustments.length > 0 && (
        <div className="mt-2 space-y-0.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Adjustments</div>
          {calc.adjustments.map((a) => (
            <div key={a.label} className="flex justify-between text-xs">
              <span className="text-slate-400">{a.label}</span>
              <span className={a.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {a.delta >= 0 ? '+' : ''}
                {Math.round(a.delta * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LifeGraphExplainabilityPanel({
  node,
  recommendations,
  sources,
}: {
  node: LifeGraphNode | null;
  recommendations: GraphRecommendation[];
  sources: DataSource[];
}) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-500">
        Explainability — select a node to see the data, sources, and recommendations behind it.
      </div>
    );
  }

  const recs = recommendations.filter(
    (r) =>
      node.recommendationIds?.includes(r.id) ||
      r.affectedGoals.includes(node.label) ||
      r.domain === node.domain
  );
  const domainSources = sources.filter((s) => s.domain === node.domain);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-white/5 bg-gradient-to-b from-violet-500/10 to-transparent p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-violet-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Why you can trust this
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Every node traces to real records. Here is the data used, where it came from, the
          calculation, and what it drives.
        </p>
      </div>

      {node.calculation && (
        <Section icon={Calculator} title="Score calculation">
          <Calc calc={node.calculation} />
        </Section>
      )}

      <Section icon={Database} title="Data sources">
        {domainSources.length ? (
          <ul className="space-y-1.5">
            {domainSources.map((s) => (
              <li key={s.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-200">{s.label}</span>
                  <span className="text-[13px] font-semibold text-white">{s.value}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500">{s.source}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      s.status === 'Verified'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            No connected datapoints for this domain yet. Connect an account or add data to populate
            the source trail.
          </p>
        )}
      </Section>

      <Section icon={GitBranch} title="Recommendation lineage">
        {recs.length ? (
          <ul className="space-y-2.5">
            {recs.slice(0, 8).map((r) => {
              const m = DOMAIN_META[r.domain] || DOMAIN_META.core;
              return (
                <li key={r.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium leading-snug text-slate-100">
                      {r.title}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: `${m.color}22`, color: m.glow }}
                    >
                      {pct(r.confidence)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-emerald-400">{r.expectedImpact}</div>
                  {r.dataDependencies.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Evidence
                      </div>
                      <ul className="mt-0.5 space-y-0.5">
                        {r.dataDependencies.slice(0, 3).map((d, i) => (
                          <li key={i} className="truncate text-[11px] text-slate-400">
                            • {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.affectedGoals.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.affectedGoals.slice(0, 4).map((g, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            No recommendations currently trace to this node.
          </p>
        )}
      </Section>
    </div>
  );
}
