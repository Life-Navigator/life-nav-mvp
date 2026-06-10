// Standard domain states — the SAME everywhere. The empty state is NEVER "No data / Coming soon":
// it tells the user what we know, what we need, what it unlocks, and the next step.
import Link from 'next/link';

export interface DomainEmptyStateProps {
  title?: string;
  known?: string[];
  missing: string[];
  unlocks?: string[];
  nextAction?: { label: string; href?: string } | null;
}

export function DomainEmptyState({
  title,
  known,
  missing,
  unlocks,
  nextAction,
}: DomainEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-600 dark:bg-gray-800/50">
      {title && (
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      )}
      {known && known.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            We currently know
          </p>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {known.map((k) => (
              <li key={k} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                {k}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          To improve accuracy we still need
        </p>
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {missing.map((m) => (
            <li key={m} className="flex gap-2">
              <span className="text-amber-500">•</span>
              {m}
            </li>
          ))}
        </ul>
      </div>
      {unlocks && unlocks.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            This would unlock
          </p>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {unlocks.map((u) => (
              <li key={u} className="flex gap-2">
                <span className="text-indigo-500">→</span>
                {u}
              </li>
            ))}
          </ul>
        </div>
      )}
      {nextAction &&
        (nextAction.href ? (
          <Link
            href={nextAction.href}
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {nextAction.label}
          </Link>
        ) : (
          <span className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
            {nextAction.label}
          </span>
        ))}
    </div>
  );
}

export function DomainLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="animate-pulse space-y-4" aria-label={label}>
      <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  );
}

export function DomainErrorState({
  message = "We couldn't load this section just now.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
      <p className="mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 dark:border-red-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}
