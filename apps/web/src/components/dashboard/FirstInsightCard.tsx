import Link from 'next/link';
import type { FirstInsight } from '@/lib/finance/first-insight';
import AskAdvisorButton from '@/components/chat/AskAdvisorButton';

const TONE: Record<string, { ring: string; chip: string; bar: string }> = {
  risk: {
    ring: 'border-red-200 dark:border-red-900/50',
    chip: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
    bar: 'bg-red-500',
  },
  caution: {
    ring: 'border-amber-200 dark:border-amber-900/50',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  positive: {
    ring: 'border-emerald-200 dark:border-emerald-900/50',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  neutral: {
    ring: 'border-gray-200 dark:border-gray-800',
    chip: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    bar: 'bg-gray-400',
  },
};

/**
 * "Today's brief" — the server-computed First Insight, rendered at the top of
 * the dashboard so a freshly-activated user sees a specific, true, money-
 * relevant fact about their finances in < 10 seconds.
 */
export default function FirstInsightCard({ insight }: { insight: FirstInsight | null }) {
  if (!insight) return null;
  const tone = TONE[insight.severity] ?? TONE.neutral;
  const advisorPrefill = insight.headline
    ? `About my brief: "${insight.headline}" — what should I do about this?`
    : undefined;

  return (
    <section
      className={`relative mb-8 overflow-hidden rounded-2xl border ${tone.ring} bg-white dark:bg-gray-900 shadow-sm`}
      aria-label="Today's brief"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone.chip}`}
          >
            Today&rsquo;s brief
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Governed
          </span>
        </div>

        {insight.metric && (
          <p className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            {insight.metric}
          </p>
        )}
        <p
          className={`${insight.metric ? 'mt-1' : 'mt-3'} text-xl sm:text-2xl font-semibold leading-snug text-gray-900 dark:text-white`}
        >
          {insight.headline}
        </p>
        {insight.detail && (
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {insight.detail}
          </p>
        )}

        {insight.recommendation && (
          <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
            <span className="font-medium text-gray-500 dark:text-gray-400">Recommended · </span>
            {insight.recommendation}
          </div>
        )}

        {insight.has_data ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AskAdvisorButton
              prefill={advisorPrefill}
              className="inline-flex items-center rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:opacity-90 transition"
            >
              Ask your advisor about this
            </AskAdvisorButton>
            <Link
              href="/dashboard/finance"
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              See the full picture →
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <Link
              href="/onboarding/financial-profile"
              className="inline-flex items-center rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:opacity-90 transition"
            >
              Choose a sample profile
            </Link>
          </div>
        )}

        {insight.has_data && (
          <p className="mt-4 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            General information based on your sample profile — not financial, tax, or legal advice.
          </p>
        )}
      </div>
    </section>
  );
}
