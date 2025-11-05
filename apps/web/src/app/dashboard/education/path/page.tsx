'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import EmptyState from '@/components/common/EmptyState';

function PathIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}

export default function LearningPathPage() {
  const { data: session, status } = useSession();
  const [learningPaths, setLearningPaths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchLearningPaths = async () => {
        try {
          // TODO: Implement API endpoint for fetching learning paths
          // const response = await fetch('/api/education/learning-paths');
          // const data = await response.json();
          // setLearningPaths(data);

          // For now, set empty array - will be populated when users create paths
          setLearningPaths([]);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching learning paths:', error);
          setLearningPaths([]);
          setLoading(false);
        }
      };

      fetchLearningPaths();
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Learning Paths</h1>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Learning Paths</h1>

      {learningPaths.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <EmptyState
            icon={PathIcon}
            title="No learning paths created yet"
            description="Create personalized learning paths to achieve your educational and career goals. Organize courses, certifications, and skills into structured roadmaps."
            actionLabel="Create Learning Path"
            onAction={() => {
              // TODO: Open modal to create learning path
              console.log('Create learning path modal');
            }}
            secondaryActionLabel="Browse Recommended Paths"
            onSecondaryAction={() => {
              // TODO: Navigate to recommendations
              console.log('Browse paths');
            }}
          />
        </div>
      ) : (
        <div>
          {/* Learning paths data will render here */}
        </div>
      )}
    </div>
  );
}
