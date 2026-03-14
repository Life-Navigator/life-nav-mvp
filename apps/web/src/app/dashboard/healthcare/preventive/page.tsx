'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import EmptyState from '@/components/common/EmptyState';

function PreventiveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

export default function PreventivePage() {
  const { data: session, status } = useSession();
  const [preventiveCare, setPreventiveCare] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      // TODO: Fetch from API
      setPreventiveCare([]);
      setLoading(false);
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Preventive Care
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
        Preventive Care
      </h1>

      {preventiveCare.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <EmptyState
            icon={PreventiveIcon}
            title="No preventive care records"
            description="Track your vaccinations, screenings, and checkups to stay on top of your preventive care schedule. We'll remind you when it's time for your next appointment."
            actionLabel="Add Preventive Care Record"
            actionHref="/dashboard/healthcare/records"
            secondaryActionLabel="Schedule Checkup"
            secondaryActionHref="/dashboard/healthcare"
          />
        </div>
      ) : (
        <div>{/* Preventive care data will render here */}</div>
      )}
    </div>
  );
}
