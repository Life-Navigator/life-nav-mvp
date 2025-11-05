'use client';

import Link from 'next/link';
import { AcademicCapIcon, BookOpenIcon, ChartBarIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

export default function EducationLandingPage() {
  const features = [
    {
      id: 1,
      name: 'Education Overview',
      description: 'Track your courses, degrees, and learning progress all in one place.',
      icon: BookOpenIcon,
      color: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      href: '/dashboard/education/overview'
    },
    {
      id: 2,
      name: 'Progress Tracking',
      description: 'Monitor assignments, grades, and study habits to optimize your learning.',
      icon: ChartBarIcon,
      color: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      href: '/dashboard/education/progress'
    },
    {
      id: 3,
      name: 'Certifications',
      description: 'Manage professional certifications, credentials, and exam preparation.',
      icon: CheckBadgeIcon,
      color: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      href: '/dashboard/education/certifications'
    }
  ];

  return (
    <div className="h-full w-full p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <div className="mr-4 p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <AcademicCapIcon className="h-10 w-10 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Education Hub</h1>
            <p className="text-gray-600 dark:text-gray-300">Manage and track your educational journey</p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {features.map((feature) => (
            <Link key={feature.id} href={feature.href}>
              <div className="h-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
                <div className={`inline-flex items-center justify-center p-3 rounded-full ${feature.color} mb-4`}>
                  <feature.icon className={`h-8 w-8 ${feature.iconColor}`} />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{feature.name}</h2>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
                <div className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  View details &rarr;
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Education Features Coming Soon</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Our education management tools are currently in development. Click on any section above to learn more about upcoming features and sign up for notifications when they launch.
          </p>
          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <Link
              href="/dashboard"
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-medium transition-colors text-center"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/dashboard/download"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md font-medium transition-colors text-center"
            >
              Join Desktop Waitlist
            </Link>
          </div>
        </div>

        {/* Educational Resources */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-emerald-300">
            Recommended Resources
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md border border-emerald-100 dark:border-emerald-800">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Free Online Courses</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Explore thousands of free courses from top universities on platforms like Coursera, edX, and Khan Academy.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md border border-emerald-100 dark:border-emerald-800">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Professional Certifications</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Advance your career with in-demand certifications in technology, business, healthcare, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}