'use client';

import { useState } from 'react';
import { JobMatches } from '@/components/career/opportunities/components/JobMatches';
import { ApplicationTracker } from '@/components/career/opportunities/components/ApplicationTracker';
import { InterviewPrep } from '@/components/career/opportunities/components/InterviewPrep';
import { Button } from '@/components/ui/buttons/Button';

export default function OpportunitiesPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'tracking' | 'interview'>('search');

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Career Opportunities</h1>
      
      <div className="mb-6">
        <div className="border-b flex">
          <Button
            onClick={() => setActiveTab('search')}
            variant={activeTab === 'search' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'search' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Find Jobs
          </Button>
          <Button
            onClick={() => setActiveTab('tracking')}
            variant={activeTab === 'tracking' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'tracking' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Application Tracker
          </Button>
          <Button
            onClick={() => setActiveTab('interview')}
            variant={activeTab === 'interview' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'interview' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Interview Prep
          </Button>
        </div>
      </div>
      
      <div className="mt-6">
        {activeTab === 'search' && <JobMatches />}
        {activeTab === 'tracking' && <ApplicationTracker />}
        {activeTab === 'interview' && <InterviewPrep />}
      </div>
    </div>
  );
}