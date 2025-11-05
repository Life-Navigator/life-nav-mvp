'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AcademicCapIcon, BookOpenIcon, ClipboardDocumentListIcon, TrophyIcon } from '@heroicons/react/24/outline';

export default function EducationOverviewComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would send this to your API
    console.log('Submitted email for education overview notification:', email);
    setSubmitted(true);
    setEmail('');
  };
  
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
            <AcademicCapIcon className="h-16 w-16 text-emerald-500 dark:text-emerald-400" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
          Education Dashboard Coming Soon
        </h1>
        
        <p className="text-lg mb-8 text-gray-600 dark:text-gray-300">
          We're building a comprehensive education tracking system to help you manage your learning journey, courses, and skills development.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <BookOpenIcon className="h-10 w-10 text-emerald-500 mb-4 mx-auto" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Course Tracking</h2>
            <p className="text-gray-600 dark:text-gray-300">Monitor your progress across online courses, degrees, and certifications in one place.</p>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <ClipboardDocumentListIcon className="h-10 w-10 text-emerald-500 mb-4 mx-auto" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Skills Development</h2>
            <p className="text-gray-600 dark:text-gray-300">Visualize your skills growth and identify areas for improvement with personalized recommendations.</p>
          </div>
        </div>
        
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg border border-emerald-100 dark:border-emerald-800 mb-8">
          <h3 className="text-lg font-semibold mb-2 text-emerald-800 dark:text-emerald-300">
            Launching Soon
          </h3>
          <p className="text-emerald-700 dark:text-emerald-200 mb-4">
            Our education dashboard is in final development and will be available soon. 
            Track your learning journey, manage assignments, and receive personalized recommendations to maximize your educational growth.
          </p>
          
          {!submitted ? (
            <form onSubmit={handleSubmit} className="mt-4">
              <label htmlFor="notification-email" className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 text-left mb-1">
                Get notified when the education dashboard launches:
              </label>
              <div className="flex gap-2">
                <input
                  id="notification-email"
                  type="email"
                  placeholder="Your email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-2 border border-emerald-300 dark:border-emerald-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors"
                >
                  Notify Me
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md">
              Thanks! We'll notify you when the education dashboard launches.
            </div>
          )}
        </div>
        
        <div className="flex justify-center space-x-4">
          <Link 
            href="/dashboard" 
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
          
          <Link 
            href="/dashboard/download" 
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md font-medium transition-colors"
          >
            Join Desktop Waitlist
          </Link>
        </div>
      </div>
    </div>
  );
}