// hooks/useSyncStatus.ts
import { useState, useEffect } from 'react';
import { getSyncStatus } from '../lib/api/integrations';

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<'success' | 'in_progress' | 'failed'>('success');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  useEffect(() => {
    const loadSyncStatus = async () => {
      try {
        const { status, lastSync } = await getSyncStatus();
        setSyncStatus(status);
        setLastSyncTime(lastSync);
      } catch (err) {
        console.error('Failed to load sync status:', err);
      }
    };
    
    loadSyncStatus();
    
    // Update status every minute
    const interval = setInterval(loadSyncStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    syncStatus,
    lastSyncTime,
  };
}