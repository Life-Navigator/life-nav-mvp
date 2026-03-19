// hooks/useSyncStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { getSyncStatus, triggerSyncNow } from '../lib/api/integrations';
import type { SyncSource, GraphRAGQueueStatus } from '@/types/integration';

export function useSyncStatus() {
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [graphrag, setGraphrag] = useState<GraphRAGQueueStatus>({
    pendingJobs: 0,
    failedJobs: 0,
    lastProcessedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null); // "provider:type" key while syncing

  const refresh = useCallback(async () => {
    try {
      const data = await getSyncStatus();
      setSources(data.sources);
      setGraphrag(data.graphrag);
    } catch (err) {
      console.error('Failed to load sync status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const triggerSync = useCallback(
    async (provider: string, type: 'email' | 'calendar') => {
      const key = `${provider}:${type}`;
      setSyncing(key);
      try {
        const result = await triggerSyncNow(provider, type);
        if (!result.success && result.retryAfterSeconds) {
          return result;
        }
        // Refresh status after sync completes
        await refresh();
        return result;
      } finally {
        setSyncing(null);
      }
    },
    [refresh]
  );

  // Derive overall status from sources and queue
  const overallStatus =
    graphrag.failedJobs > 0
      ? ('failed' as const)
      : graphrag.pendingJobs > 0
        ? ('in_progress' as const)
        : ('success' as const);

  // Derive last sync time from most recent source
  const lastSyncTime = sources.reduce<string | null>((latest, s) => {
    if (!s.lastSyncAt) return latest;
    if (!latest) return s.lastSyncAt;
    return new Date(s.lastSyncAt) > new Date(latest) ? s.lastSyncAt : latest;
  }, null);

  return {
    sources,
    graphrag,
    overallStatus,
    lastSyncTime,
    loading,
    syncing,
    triggerSync,
    refresh,
    // Backward compat
    syncStatus: overallStatus,
  };
}
