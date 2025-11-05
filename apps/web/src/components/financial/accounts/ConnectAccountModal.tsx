'use client';

import React, { useState } from 'react';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (institutionId: string) => void;
}

interface Institution {
  id: string;
  name: string;
  logo?: string;
  types: string[];
}

// Mock list of financial institutions
const INSTITUTIONS: Institution[] = [
  { id: 'chase', name: 'Chase Bank', logo: '/images/banks/chase.svg', types: ['bank', 'credit', 'investment'] },
  { id: 'bofa', name: 'Bank of America', logo: '/images/banks/bofa.svg', types: ['bank', 'credit', 'loan'] },
  { id: 'amex', name: 'American Express', logo: '/images/banks/amex.svg', types: ['credit'] },
  { id: 'fidelity', name: 'Fidelity', logo: '/images/banks/fidelity.svg', types: ['investment', 'retirement'] },
  { id: 'betterment', name: 'Betterment', logo: '/images/banks/betterment.svg', types: ['investment'] },
  { id: 'vanguard', name: 'Vanguard', logo: '/images/banks/vanguard.svg', types: ['investment', 'retirement'] },
  { id: 'wells-fargo', name: 'Wells Fargo', logo: '/images/banks/wells-fargo.svg', types: ['bank', 'loan', 'mortgage'] },
  { id: 'nelnet', name: 'Nelnet', logo: '/images/banks/nelnet.svg', types: ['loan'] },
  { id: 'coinbase', name: 'Coinbase', logo: '/images/banks/coinbase.svg', types: ['crypto'] },
  { id: 'robinhood', name: 'Robinhood', logo: '/images/banks/robinhood.svg', types: ['investment', 'crypto'] },
  { id: 'discover', name: 'Discover', logo: '/images/banks/discover.svg', types: ['bank', 'credit'] },
  { id: 'capital-one', name: 'Capital One', logo: '/images/banks/capital-one.svg', types: ['bank', 'credit'] },
];

export default function ConnectAccountModal({ isOpen, onClose, onConnect }: ConnectAccountModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter institutions based on search term
  const filteredInstitutions = INSTITUTIONS.filter(
    (institution) => institution.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Connect a Financial Account</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search for your bank or financial institution"
              className="pl-10 pr-4 py-2 w-full border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 gap-2">
              {filteredInstitutions.length > 0 ? (
                filteredInstitutions.map((institution) => (
                  <button
                    key={institution.id}
                    className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    onClick={() => onConnect(institution.id)}
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center mr-3">
                      {institution.logo ? (
                        <img src={institution.logo} alt={institution.name} className="w-6 h-6" />
                      ) : (
                        <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                          {institution.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-gray-900 dark:text-white">{institution.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {institution.types.map((type) => type.charAt(0).toUpperCase() + type.slice(1)).join(', ')}
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No institutions found. Try a different search term.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
            Don't see your institution? You can add it manually.
          </p>
          <button
            onClick={() => onConnect('manual')}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
          >
            Add Account Manually
          </button>
        </div>
      </div>
    </div>
  );
}