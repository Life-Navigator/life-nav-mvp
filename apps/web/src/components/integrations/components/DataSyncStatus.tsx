// components/integrations/components/DataSyncStatus.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never';
  const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 120) return '1 hour ago';
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}

export function DataSyncStatus() {
  const { sources, graphrag, overallStatus, lastSyncTime, loading, syncing, triggerSync } =
    useSyncStatus();
  const [timeAgo, setTimeAgo] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTimeAgo(formatTimeAgo(lastSyncTime));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const handleSyncNow = async (provider: string, type: 'email' | 'calendar') => {
    setSyncError(null);
    try {
      const result = await triggerSync(provider, type);
      if (result && !result.success && result.retryAfterSeconds) {
        setSyncError(`Please wait ${result.retryAfterSeconds}s before syncing again`);
      }
    } catch (err) {
      setSyncError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Data Sync Status</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Data Sync Status</h2>

      <div className="space-y-4">
        {/* Overall status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Last Synced:</span>
          <span className="text-sm font-medium">{timeAgo || 'Never'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status:</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              overallStatus === 'success'
                ? 'bg-green-100 text-green-800'
                : overallStatus === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {overallStatus === 'success'
              ? 'Up to date'
              : overallStatus === 'in_progress'
                ? 'Syncing...'
                : 'Sync Failed'}
          </span>
        </div>

        {/* GraphRAG queue info */}
        {(graphrag.pendingJobs > 0 || graphrag.failedJobs > 0) && (
          <div className="text-xs text-gray-400 border-t pt-2">
            {graphrag.pendingJobs > 0 && <span>{graphrag.pendingJobs} pending queue jobs</span>}
            {graphrag.pendingJobs > 0 && graphrag.failedJobs > 0 && <span> &middot; </span>}
            {graphrag.failedJobs > 0 && (
              <span className="text-red-400">{graphrag.failedJobs} failed</span>
            )}
          </div>
        )}

        {/* Per-source sync status */}
        {sources.length > 0 && (
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Connected Sources</h3>
            <div className="space-y-3">
              {sources.map((source) => {
                const key = `${source.provider}:${source.type}`;
                const isSyncing = syncing === key;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          source.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400'
                        }`}
                      ></span>
                      <div>
                        <span className="text-xs text-gray-700 capitalize">
                          {source.provider} {source.type}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({source.recordCount} records)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleSyncNow(source.provider, source.type as 'email' | 'calendar')
                      }
                      disabled={isSyncing}
                      className={`text-xs px-2 py-1 rounded ${
                        isSyncing
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error feedback */}
        {syncError && <div className="text-xs text-red-600 bg-red-50 rounded p-2">{syncError}</div>}

        {/* Empty state */}
        {sources.length === 0 && (
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-400">
              Connect Google or Microsoft to sync email and calendar data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
