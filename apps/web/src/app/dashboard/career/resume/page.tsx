'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import EmptyState from '@/components/common/EmptyState';

function ResumeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

export default function ResumePage() {
  const { data: session, status } = useSession();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchResumes = async () => {
        try {
          // TODO: Implement API endpoint for fetching resumes
          // const response = await fetch('/api/career/resumes');
          // const data = await response.json();
          // setResumes(data);

          // For now, set empty array - will be populated when users upload resumes
          setResumes([]);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching resumes:', error);
          setResumes([]);
          setLoading(false);
        }
      };

      fetchResumes();
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Resume Builder</h1>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Resume Builder</h1>

      {resumes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <EmptyState
            icon={ResumeIcon}
            title="No resumes created yet"
            description="Create professional resumes tailored to your target roles. Upload existing resumes or build new ones from your profile data."
            actionLabel="Create Resume"
            onAction={() => {
              // TODO: Open resume builder
              console.log('Create resume');
            }}
            secondaryActionLabel="Upload Existing Resume"
            onSecondaryAction={() => {
              // TODO: Open upload dialog
              console.log('Upload resume');
            }}
          />
        </div>
      ) : (
        <div>
          {/* Resume data will render here */}
        </div>
      )}
    </div>
  );
}
