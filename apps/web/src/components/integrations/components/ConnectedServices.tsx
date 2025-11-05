// components/integrations/components/ConnectedServices.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useConnectedServices } from '@/hooks/useConnectedServices';
import { ConnectedService } from '@/types/integration';

export function ConnectedServices() {
  const { services, removeService, refreshData } = useConnectedServices();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Connected Services</h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full 
            ${isRefreshing 
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
        >
          <svg
            className={`-ml-0.5 mr-1.5 h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
      
      {services.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-500">You haven't connected any services yet.</p>
          <p className="text-sm text-gray-400 mt-1">Connect services below to get started.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {services.map((service) => (
            <li key={service.id} className="py-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 relative">
                  <Image
                    src={service.logoUrl}
                    alt={service.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{service.name}</p>
                  <p className="text-xs text-gray-500">Connected {service.connectedDate}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs rounded-full ${service.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'}`}>
                  {service.status === 'active' ? 'Active' : 'Needs Attention'}
                </span>
                <button
                  onClick={() => removeService(service.id)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Disconnect</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}