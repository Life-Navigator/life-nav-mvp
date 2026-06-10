'use client';

// One fetch per finance section. The provider (mounted in the finance layout) fetches the canonical
// summary AND the backend analytics ONCE; FinanceSidebar, AccountsSummary, and the Overview widgets
// consume this context instead of each fetching independently (kills the 3× canonical fetch and the
// per-widget transaction fetches). no-store + AbortController for reliable user-data fetches.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Status = 'loading' | 'ready' | 'error';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

interface FinanceData {
  summary: Json | null;
  analytics: Json | null;
  summaryStatus: Status;
  analyticsStatus: Status;
  refresh: () => void;
}

const Ctx = createContext<FinanceData | null>(null);

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<Json | null>(null);
  const [analytics, setAnalytics] = useState<Json | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<Status>('loading');
  const [analyticsStatus, setAnalyticsStatus] = useState<Status>('loading');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setSummaryStatus('loading');
    setAnalyticsStatus('loading');
    fetch('/api/finance/canonical-summary', { cache: 'no-store', signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`summary ${r.status}`);
        const d = await r.json();
        setSummary(d && typeof d.net_worth === 'number' ? d : null);
        setSummaryStatus('ready');
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setSummaryStatus('error');
      });
    fetch('/api/finance/analytics', { cache: 'no-store', signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`analytics ${r.status}`);
        setAnalytics(await r.json());
        setAnalyticsStatus('ready');
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setAnalyticsStatus('error');
      });
    return () => ac.abort();
  }, [tick]);

  return (
    <Ctx.Provider
      value={{
        summary,
        analytics,
        summaryStatus,
        analyticsStatus,
        refresh: () => setTick((t) => t + 1),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// Returns null when used outside the provider (callers fall back to their own fetch if needed).
export function useFinanceData(): FinanceData | null {
  return useContext(Ctx);
}
