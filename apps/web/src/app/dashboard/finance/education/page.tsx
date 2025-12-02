'use client';

import Link from 'next/link';
import { AcademicCapIcon, ChartBarIcon, ScaleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export default function EducationPlanningPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600 rounded-lg">
              <AcademicCapIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Education Planning
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Advanced education ROI and planning tools
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
          <p className="text-purple-100">
            Revolutionary education analysis tools are currently in development.
          </p>
        </div>

        {/* Two Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Degree Decision Matrix */}
          <Link href="/dashboard/finance/education/degree-analysis">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-blue-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Degree Decision Matrix
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Analyze degree paths with financial-planner-grade precision.
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  Coming Soon
                </p>
              </div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium mt-4">
                Learn More
                <ArrowRightIcon className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Degree Comparison Engine */}
          <Link href="/dashboard/finance/education/comparison">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-purple-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <ScaleIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Degree Comparison Engine
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Compare multiple degrees side-by-side with weighted rankings.
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  Coming Soon
                </p>
              </div>
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium mt-4">
                Learn More
                <ArrowRightIcon className="w-4 h-4" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
