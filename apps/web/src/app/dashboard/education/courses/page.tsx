'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import EmptyState from '@/components/common/EmptyState';

function CoursesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

export default function CoursesPage() {
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchCourses = async () => {
        try {
          // TODO: Implement API endpoint for fetching courses
          // const response = await fetch('/api/education/courses');
          // const data = await response.json();
          // setCourses(data);

          // For now, set empty array - will be populated when users enroll in courses
          setCourses([]);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching courses:', error);
          setCourses([]);
          setLoading(false);
        }
      };

      fetchCourses();
    }
  }, [status]);

  const handleJoinWaitlist = async () => {
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'courses' }),
      });
      if (response.ok) {
        alert('Thanks for your interest! We\'ll notify you when Course Integration launches.');
      } else {
        alert('Failed to join waitlist. Please try again.');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Failed to join waitlist. Please try again.');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">My Courses</h1>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">My Courses</h1>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Coming Soon</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Course Integration is currently in development. Connect your learning platforms like Udemy, Coursera, and LinkedIn Learning to automatically track your educational progress and certifications.
            </p>
            <button
              onClick={handleJoinWaitlist}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <EmptyState
            icon={CoursesIcon}
            title="No courses enrolled yet"
            description="Start your learning journey by enrolling in courses. Connect your learning platforms or manually track courses to monitor your educational progress."
            actionLabel="Connect Learning Platform"
            actionHref="/dashboard/integrations"
            secondaryActionLabel="Add Course Manually"
            onSecondaryAction={() => {
              // TODO: Open modal to add course
              console.log('Add course modal');
            }}
          />
        </div>
      ) : (
        <div>
          {/* Courses data will render here */}
        </div>
      )}
    </div>
  );
}
