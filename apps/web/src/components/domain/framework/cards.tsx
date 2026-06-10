// Shared domain metric cards — every domain + the dashboard consume THESE (no custom copies).
import Link from 'next/link';
import type { Confidence, DomainStatus, SourceAttribution } from './types';

function pctColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-gray-500 dark:text-gray-400';
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'Unknown',
};
const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  none: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};
const STATUS_LABEL: Record<DomainStatus, string> = {
  not_started: 'Not started',
  started: 'Started',
  partial: 'In progress',
  complete: 'Complete',
};

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {title && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function CoverageCard({ pct, label = 'Coverage' }: { pct: number; label?: string }) {
  return (
    <Card title={label}>
      <div className={`text-3xl font-bold ${pctColor(pct)}`}>{Math.round(pct)}%</div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className="h-1.5 rounded-full bg-indigo-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </Card>
  );
}

export function ConfidenceCard({ pct, level }: { pct?: number; level?: Confidence }) {
  const lvl: Confidence =
    level ?? (pct == null ? 'none' : pct >= 75 ? 'high' : pct >= 40 ? 'medium' : 'low');
  return (
    <Card title="Confidence">
      <div className="flex items-center gap-2">
        {pct != null && (
          <span className={`text-3xl font-bold ${pctColor(pct)}`}>{Math.round(pct)}%</span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLOR[lvl]}`}>
          {CONFIDENCE_LABEL[lvl]}
        </span>
      </div>
    </Card>
  );
}

export function DomainStatusCard({ status }: { status: DomainStatus }) {
  return (
    <Card title="Status">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {STATUS_LABEL[status]}
      </span>
    </Card>
  );
}

export function MissingDataCard({ items }: { items: string[] }) {
  return (
    <Card title="What we still need">
      {items.length ? (
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {items.map((m) => (
            <li key={m} className="flex gap-2">
              <span className="text-amber-500">•</span>
              {m}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Nothing outstanding — this domain is well covered.
        </p>
      )}
    </Card>
  );
}

export function NextActionCard({ action }: { action?: { label: string; href?: string } | null }) {
  if (!action) return null;
  const inner = (
    <span className="font-medium text-indigo-700 dark:text-indigo-300">{action.label} →</span>
  );
  return (
    <Card title="Recommended next step">
      {action.href ? <Link href={action.href}>{inner}</Link> : inner}
    </Card>
  );
}

export function SourceAttributionCard({ source }: { source?: SourceAttribution }) {
  if (!source) return null;
  return (
    <Card title="Source">
      <div className="space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
        <div>
          <span className="text-gray-400">Source:</span> {source.source}
        </div>
        {source.updated && (
          <div>
            <span className="text-gray-400">Updated:</span> {source.updated}
          </div>
        )}
        {source.confidence && (
          <div>
            <span className="text-gray-400">Confidence:</span> {CONFIDENCE_LABEL[source.confidence]}
          </div>
        )}
      </div>
    </Card>
  );
}

/** A compact row of labelled metrics (each with optional source/confidence) — no mystery numbers. */
export function DomainMetricsRow({
  metrics,
}: {
  metrics: { label: string; value: string; source?: string; confidence?: Confidence }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} title={m.label}>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{m.value}</div>
          {(m.source || m.confidence) && (
            <div className="mt-1 text-[11px] text-gray-400">
              {m.source}
              {m.source && m.confidence ? ' · ' : ''}
              {m.confidence ? CONFIDENCE_LABEL[m.confidence] : ''}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
