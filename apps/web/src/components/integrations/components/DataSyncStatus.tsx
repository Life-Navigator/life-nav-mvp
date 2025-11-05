// components/integrations/components/DataSyncStatus.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

export function DataSyncStatus() {
  const { syncStatus, lastSyncTime } = useSyncStatus();
  const [timeAgo, setTimeAgo] = useState('');
  
  useEffect(() => {
    if (!lastSyncTime) return;
    
    const updateTimeAgo = () => {
      const minutes = Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / 60000);
      
      if (minutes < 1) {
        setTimeAgo('just now');
      } else if (minutes === 1) {
        setTimeAgo('1 minute ago');
      } else if (minutes < 60) {
        setTimeAgo(`${minutes} minutes ago`);
      } else if (minutes < 120) {
        setTimeAgo('1 hour ago');
      } else if (minutes < 1440) {
        setTimeAgo(`${Math.floor(minutes / 60)} hours ago`);
      } else {
        setTimeAgo(`${Math.floor(minutes / 1440)} days ago`);
      }
    };
    
    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000);
    
    return () => clearInterval(interval);
  }, [lastSyncTime]);
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Data Sync Status</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Last Synced:</span>
          <span className="text-sm font-medium">{timeAgo || 'Never'}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
            ${syncStatus === 'success' 
              ? 'bg-green-100 text-green-800' 
              : syncStatus === 'in_progress' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-red-100 text-red-800'}`}
          >
            {syncStatus === 'success' 
              ? 'Up to date' 
              : syncStatus === 'in_progress' 
                ? 'Syncing...' 
                : 'Sync Failed'}
          </span>
        </div>
        
        <div className="pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Services Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Financial</span>
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Education</span>
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Career</span>
              <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Healthcare</span>
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}