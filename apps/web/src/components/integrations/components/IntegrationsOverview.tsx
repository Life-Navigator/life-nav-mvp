// components/integrations/IntegrationsOverview.tsx
'use client';

import { useState } from 'react';
import { IntegrationCategoryTabs } from './IntegrationCategoryTabs';
import { ProviderGrid } from './ProviderGrid';
import { ConnectedServices } from './ConnectedServices';
import { DataSyncStatus } from './DataSyncStatus';

const INTEGRATION_CATEGORIES = [
  { id: 'finance', name: 'Financial', count: 16 },
  { id: 'education', name: 'Education', count: 8 },
  { id: 'career', name: 'Career', count: 15 },
  { id: 'health', name: 'Healthcare', count: 16 },
  { id: 'automotive', name: 'Automotive', count: 12 },
  { id: 'smarthome', name: 'Smart Home', count: 15 },
];

export function IntegrationsOverview() {
  const [activeCategory, setActiveCategory] = useState('finance');
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <ConnectedServices />
        </div>
        <div>
          <DataSyncStatus />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <IntegrationCategoryTabs 
          categories={INTEGRATION_CATEGORIES} 
          activeCategory={activeCategory} 
          onChange={setActiveCategory} 
        />
        
        <div className="mt-6">
          <ProviderGrid category={activeCategory as 'finance' | 'education' | 'career' | 'healthcare' | 'automotive' | 'smarthome'} />
        </div>
      </div>
    </div>
  );
}