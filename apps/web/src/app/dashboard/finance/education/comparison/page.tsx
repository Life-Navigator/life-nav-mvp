'use client';

import { ScaleIcon } from '@heroicons/react/24/outline';

export default function DegreeComparisonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-purple-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white text-center">
          <ScaleIcon className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Degree Comparison Engine</h1>
          <p className="text-lg mb-6 text-purple-100">
            Side-by-side comparison with weighted rankings and AI recommendations
          </p>
          <div className="bg-white/10 rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
            <p className="text-purple-100">
              Advanced degree comparison tools are currently in development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
