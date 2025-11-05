// components/integrations/ProviderCard.tsx
'use client';

import Image from 'next/image';
import { Provider } from '@/types/integration';

interface ProviderCardProps {
  provider: Provider;
  onConnect: () => void;
}

export function ProviderCard({ provider, onConnect }: ProviderCardProps) {
  return (
    <div className="bg-white overflow-hidden rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0 h-12 w-12 relative">
            <Image
              src={provider.logo}
              alt={provider.name}
              fill
              className="object-contain"
            />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
            <p className="text-sm text-gray-500">{provider.description}</p>
          </div>
        </div>
        
        <div className="mt-5">
          <button
            onClick={onConnect}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {provider.connected ? 'Manage Connection' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}