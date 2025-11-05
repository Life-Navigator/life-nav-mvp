// components/integrations/IntegrationModal.tsx
'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { PROVIDER_CONFIG } from '../../../lib/integrations/providers';
import { useIntegration } from '../../../hooks/useIntegration';

interface IntegrationModalProps {
  providerId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function IntegrationModal({ providerId, isOpen, onClose }: IntegrationModalProps) {
  const provider = PROVIDER_CONFIG.find((p: { id: string }) => p.id === providerId);
  const { initOAuthFlow, connectionStatus } = useIntegration();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Handle OAuth connection
  const handleConnect = async () => {
    if (!provider) return;
    
    setIsConnecting(true);
    try {
      await initOAuthFlow(provider.id);
    } catch (error) {
      console.error('Failed to initiate OAuth flow:', error);
      // Show error message
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Close modal when connection is successful
  useEffect(() => {
    if (connectionStatus === 'connected') {
      onClose();
    }
  }, [connectionStatus, onClose]);
  
  if (!provider) return null;
  
  return (
    <Transition.Root show={isOpen} as={Fragment}>

      <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={onClose}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          {/* Center modal */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900">
                    Connect {provider.name}
                  </Dialog.Title>
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      {provider.modalDescription || `Connect your ${provider.name} account to import your data securely. We only access the data you authorize.`}
                    </p>
                    
                    <div className="mt-6 space-y-4">
                      <h4 className="text-sm font-medium text-gray-900">This will allow Life Navigator to:</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-500 space-y-2">
                        {provider.permissions.map((permission: string, index: number) => (
                          <li key={index}>{permission}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm
                    ${isConnecting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}