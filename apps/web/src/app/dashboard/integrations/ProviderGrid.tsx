// src/app/dashboard/integrations/ProviderGrid.tsx
'use client';

import { useState } from 'react';
import { ProviderCard } from '@/components/integrations/components/ProviderCard';
import { IntegrationModal } from '@/components/integrations/components/IntegrationModal';
import { Provider } from '@/types/integration';

// Import provider data from our configuration
import { PROVIDER_CONFIG } from '@/lib/integrations/providers';

interface ProviderGridProps {
  category: string;
}

export function ProviderGrid({ category }: ProviderGridProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Filter providers by category
  const providers = PROVIDER_CONFIG.filter((provider: { category: string }) =>
    provider.category === category
  );
  
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={{
              id: provider.id,
              name: provider.name,
              description: provider.description,
              logo: provider.logo,
              category: provider.category, // Add the missing category property
              connected: provider.connected,
              permissions: provider.permissions
            }}
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