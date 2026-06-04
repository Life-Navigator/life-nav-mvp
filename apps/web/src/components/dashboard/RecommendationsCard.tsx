import type { Recommendation, RecCategory } from '@/lib/finance/recommendations';
import AskAdvisorButton from '@/components/chat/AskAdvisorButton';

const CATEGORY_META: Record<RecCategory, { label: string; chip: string }> = {
  immediate_action: {
    label: 'Do this first',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  },
  risk_reduction: {
    label: 'Reduce risk',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  growth_opportunity: {
    label: 'Grow from here',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

const ORDER: RecCategory[] = ['immediate_action', 'risk_reduction', 'growth_opportunity'];

/**
 * Renders the persona-aware recommendation set (>=3 categorized recs) below the
 * hero brief. Every recommendation routes to the governed advisor for follow-up.
 */
export default function RecommendationsCard({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  if (!recommendations?.length) return null;

  // Show the first rec per category in priority order; keep any extras after.
  const seen = new Set<RecCategory>();
  const primary: Recommendation[] = [];
  const extras: Recommendation[] = [];
  for (const cat of ORDER) {
    const r = recommendations.find((x) => x.category === cat);
    if (r) {
      primary.push(r);
      seen.add(cat);
    }
  }
  for (const r of recommendations) {
    if (!primary.includes(r)) extras.push(r);
  }
  const ordered = [...primary, ...extras];

  return (
    <section
      className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
      aria-label="Your recommendations"
    >
      <div className="px-5 sm:px-6 pt-5 pb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Your top moves right now
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Governed · deterministic
        </span>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {ordered.map((r, i) => {
          const meta = CATEGORY_META[r.category];
          const prefill = `About my recommendation: "${r.title}" — walk me through how to do this.`;
          return (
            <li key={`${r.theme}-${i}`} className="px-5 sm:px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${meta.chip}`}
                >
                  {meta.label}
                </span>
                {r.metric && (
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {r.metric}
                  </span>
                )}
              </div>
              <p className="mt-2 text-base font-semibold leading-snug text-gray-900 dark:text-white">
                {r.title}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{r.detail}</p>
              <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                <span className="font-medium text-gray-500 dark:text-gray-400">Next step · </span>
                {r.action}
              </div>
              <div className="mt-2">
                <AskAdvisorButton
                  prefill={prefill}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Discuss this with your advisor →
                </AskAdvisorButton>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="px-5 sm:px-6 pb-5 pt-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
        General information based on your sample profile — not financial, tax, or legal advice.
        Estimates use historical averages and may vary.
      </p>
    </section>
  );
}
