// The standard domain Overview — renders the 11-point overview from a CoverageModel so every domain
// answers the same questions: what we know, what we're missing, why it matters, next action, source,
// confidence, last updated. No domain hand-rolls its own overview.
import type { ReactNode } from 'react';
import {
  CoverageCard,
  ConfidenceCard,
  MissingDataCard,
  NextActionCard,
  SourceAttributionCard,
} from './cards';
import { DomainEmptyState } from './states';
import type { CoverageModel, DomainConfig } from './types';

export function DomainOverview({
  config,
  model,
  children,
}: {
  config: DomainConfig;
  model: CoverageModel;
  children?: ReactNode;
}) {
  const hasData = model.coverage_pct > 0 || model.known.length > 0;
  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {config.label} Snapshot
        </h2>
        {model.last_updated && (
          <p className="text-xs text-gray-400">Last updated: {model.last_updated}</p>
        )}
      </div>

      {!hasData ? (
        <DomainEmptyState
          title={`Let's build your ${config.label.toLowerCase()} picture`}
          known={model.known}
          missing={model.missing}
          unlocks={model.unlocks}
          nextAction={model.next_action}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CoverageCard pct={model.coverage_pct} />
            <ConfidenceCard pct={model.confidence_pct} />
            <NextActionCard action={model.next_action} />
            <SourceAttributionCard source={model.source} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                What we know
              </div>
              {model.known.length ? (
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {model.known.map((k) => (
                    <li key={k} className="flex gap-2">
                      <span className="text-emerald-500">✓</span>
                      {k}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">We're just getting started here.</p>
              )}
            </div>
            <MissingDataCard items={model.missing} />
          </div>

          {model.unlocks && model.unlocks.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/20">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-400">
                Why it matters — this unlocks
              </div>
              <ul className="space-y-1 text-sm text-indigo-900 dark:text-indigo-200">
                {model.unlocks.map((u) => (
                  <li key={u} className="flex gap-2">
                    <span>→</span>
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {children}
        </>
      )}
    </div>
  );
}
