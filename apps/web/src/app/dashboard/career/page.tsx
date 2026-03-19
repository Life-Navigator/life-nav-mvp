'use client';

import React from 'react';
import Link from 'next/link';
import { useJobApplications } from '@/hooks/useCareer';

export default function CareerDashboard() {
  const { applications, isLoading } = useJobApplications();

  const stats = {
    total: applications.length,
    applied: applications.filter((a) => a.status === 'applied').length,
    interview: applications.filter((a) => a.status === 'interview').length,
    offered: applications.filter((a) => a.status === 'offered').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const recentApplications = [...applications]
    .sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Career Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your professional development and opportunities
          </p>
        </div>
        <Link
          href="/dashboard/career/applications"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          View All Applications
        </Link>
      </header>

      {/* Application Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Applied', value: stats.applied, color: 'text-blue-600 dark:text-blue-400' },
          {
            label: 'Interview',
            value: stats.interview,
            color: 'text-yellow-600 dark:text-yellow-400',
          },
          { label: 'Offered', value: stats.offered, color: 'text-green-600 dark:text-green-400' },
          {
            label: 'Accepted',
            value: stats.accepted,
            color: 'text-emerald-600 dark:text-emerald-400',
          },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm text-center"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{isLoading ? '-' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            Recent Applications
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : recentApplications.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentApplications.map((app) => (
                <div key={app.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{app.jobTitle}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{app.companyName}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      app.status === 'applied'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : app.status === 'interview'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : app.status === 'offered'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : app.status === 'rejected'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
                No applications yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Start tracking your job applications
              </p>
              <Link
                href="/dashboard/career/applications"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-block"
              >
                Add Application
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Career Tools</h2>
          <div className="space-y-3">
            <Link
              href="/dashboard/career/applications"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Applications Tracker</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage all your job applications
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Skills Assessment</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Coming soon</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-2xl">🤝</span>
              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Networking</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Coming soon</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Resume Builder</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
