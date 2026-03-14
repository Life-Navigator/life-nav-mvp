'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import EmptyState from '@/components/common/EmptyState';

function SkillsIcon(props: React.SVGProps<SVGSVGElement>) {
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
        d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
      />
    </svg>
  );
}

export default function SkillsPage() {
  const { data: session, status } = useSession();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchSkills = async () => {
        try {
          // TODO: Implement API endpoint for fetching skills
          // const response = await fetch('/api/career/skills');
          // const data = await response.json();
          // setSkills(data);

          // For now, set empty array - will be populated when users add skills
          setSkills([]);
        } catch (error) {
          console.error('Error fetching skills:', error);
          setSkills([]);
        } finally {
          setLoading(false);
        }
      };

      fetchSkills();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Skills & Certifications
        </h1>
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Skills & Certifications
        </h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please sign in to access Skills & Certifications
          </p>
          <a href="/auth/login" className="text-blue-600 hover:underline">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
        Skills & Certifications
      </h1>

      {skills.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <EmptyState
            icon={SkillsIcon}
            title="No skills or certifications added yet"
            description="Build your professional profile by adding your skills, certifications, and competencies. Track your progress and identify areas for growth."
            actionLabel="Add Skills"
            onAction={() => {
              // TODO: Open modal to add skills
              console.log('Add skills modal');
            }}
            secondaryActionLabel="View Career Dashboard"
            secondaryActionHref="/dashboard/career"
          />
        </div>
      ) : (
        <div>{/* Skills data will render here */}</div>
      )}
    </div>
  );
}
