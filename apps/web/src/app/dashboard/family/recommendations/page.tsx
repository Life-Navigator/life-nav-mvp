'use client';

// Family → Recommendations: REAL family recommendations from /api/family/summary (Core API). No fabricated
// cards — empty until the protection/estate/dependent picture surfaces real recommendations.
import { useEffect, useState } from 'react';
import { DomainLoadingState } from '@/components/domain/framework';

interface Rec {
  title?: string;
  description?: string | null;
  priority?: string | null;
  recommendation_type?: string | null;
}

export default function FamilyRecommendationsPage() {
  const [recs, setRecs] = useState<Rec[] | null>(null);

  useEffect(() => {
    fetch('/api/family/summary', { cache: 'no-store' })
      .then(async (r) => (r.ok ? await r.json() : null))
      .then((d) => setRecs(Array.isArray(d?.recommendations) ? d.recommendations : []))
      .catch(() => setRecs([]));
  }, []);

  if (recs === null)
    return (
      <div className="p-6">
        <DomainLoadingState />
      </div>
    );

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Family recommendations</h2>
      {recs.length === 0 ? (
        <p className="text-sm text-gray-500">
          No family-specific recommendations yet — they appear as your protection, estate, and
          dependent picture fills in (add beneficiaries, emergency contacts, a will, or a
          guardianship plan).
        </p>
      ) : (
        <ul className="space-y-3">
          {recs.map((r, i) => (
            <li
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {r.title ?? 'Recommendation'}
                </span>
                {r.priority && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {r.priority}
                  </span>
                )}
              </div>
              {r.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{r.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        LifeNavigator is not a law firm and does not provide legal advice.
      </p>
    </div>
  );
}
