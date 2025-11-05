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
