// components/integrations/components/ProviderGrid.tsx
'use client';

import { useState } from 'react';
import { ProviderCard } from './ProviderCard';
import { IntegrationModal } from './IntegrationModal';
import { PROVIDER_CONFIG } from '@/lib/integrations/providers';
import { Provider } from '@/types/integration';

interface ProviderGridProps {
  category: 'finance' | 'education' | 'career' | 'healthcare' | 'automotive' | 'smarthome';
}

export function ProviderGrid({ category }: ProviderGridProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Cast PROVIDER_CONFIG to Provider[] to ensure type compatibility
  const typedProviders = PROVIDER_CONFIG as Provider[];
  
  // Filter providers by category
  const providers = typedProviders.filter(provider => 
    provider.category === category
  );
  
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onConnect={() => setSelectedProvider(provider.id)}
          />
        ))}
      </div>
      
      {selectedProvider && (
        <IntegrationModal
          providerId={selectedProvider}
          isOpen={!!selectedProvider}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
}