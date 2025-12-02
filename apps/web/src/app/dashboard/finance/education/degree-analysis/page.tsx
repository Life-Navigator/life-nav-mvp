'use client';

import { SparklesIcon } from '@heroicons/react/24/outline';

export default function DegreeAnalysisPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white text-center">
          <SparklesIcon className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Degree Decision Matrix</h1>
          <p className="text-lg mb-6 text-blue-100">
            Comprehensive degree analysis with financial-planner-grade precision
          </p>
          <div className="bg-white/10 rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
            <p className="text-blue-100">
              Advanced degree analysis tools are currently in development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
