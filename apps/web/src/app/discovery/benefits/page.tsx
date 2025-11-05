'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BenefitsDiscovery } from '@/components/discovery/BenefitsDiscovery';
import { Domain } from '@/lib/benefits/benefit-tags';

export default function BenefitsDiscoveryPage() {
  const router = useRouter();
  const [currentDomain, setCurrentDomain] = useState<Domain>('financial');
  const [completedDomains, setCompletedDomains] = useState<Domain[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<Record<Domain, string[]>>({
    financial: [],
    career: [],
    health: [],
    education: [],
    lifestyle: [],
  });

  const handleDomainComplete = (tags: string[]) => {
    // Save the selected benefits for this domain
    setSelectedBenefits(prev => ({
      ...prev,
      [currentDomain]: tags,
    }));

    // Mark domain as completed
    setCompletedDomains(prev => [...prev, currentDomain]);

    // Move to next domain or complete
    const domains: Domain[] = ['financial', 'career', 'health'];
    const currentIndex = domains.indexOf(currentDomain);
    
    if (currentIndex < domains.length - 1) {
      // Move to next domain
      setCurrentDomain(domains[currentIndex + 1]);
    } else {
      // All domains completed - save to database and move to MyBlocks
      saveBenefitsAndContinue();
    }
  };

  const saveBenefitsAndContinue = async () => {
    try {
      // Save benefits to database
      const response = await fetch('/api/discovery/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benefits: selectedBenefits }),
      });

      if (response.ok) {
        // Navigate to MyBlocks goal creation
        router.push('/goals/create');
      }
    } catch (error) {
      console.error('Failed to save benefits:', error);
    }
  };

  const handleDomainSelect = (domain: Domain) => {
    if (!completedDomains.includes(domain)) {
      setCurrentDomain(domain);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Progress Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Discovery Progress</h2>
            <div className="flex gap-4">
              {(['financial', 'career', 'health'] as Domain[]).map((domain) => (
                <button
                  key={domain}
                  onClick={() => handleDomainSelect(domain)}
                  disabled={completedDomains.includes(domain)}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all
                    ${currentDomain === domain
                      ? 'bg-blue-600 text-white'
                      : completedDomains.includes(domain)
                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  {domain === 'financial' ? '💰' : domain === 'career' ? '💼' : '🏥'} {' '}
                  {domain.charAt(0).toUpperCase() + domain.slice(1)}
                  {completedDomains.includes(domain) && ' ✓'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedDomains.length / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Benefits Discovery Component */}
      <BenefitsDiscovery
        domain={currentDomain}
        onComplete={handleDomainComplete}
      />
    </div>
  );
}