'use client';

/**
 * Scenario Card Component
 * Displays a scenario preview with status and quick actions
 */

import Link from 'next/link';

interface ScenarioCardProps {
  scenario: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    status: 'draft' | 'active' | 'committed' | 'archived';
    updated_at: string;
  };
  onUpdate: () => void;
}

export default function ScenarioCard({ scenario, onUpdate }: ScenarioCardProps) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    committed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500',
  };

  const statusLabels = {
    draft: 'Draft',
    active: 'Active',
    committed: 'Committed',
    archived: 'Archived',
  };

  const updatedDate = new Date(scenario.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/dashboard/scenario-lab/${scenario.id}`}>
      <div
        className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
        style={{ borderTopColor: scenario.color, borderTopWidth: '4px' }}
      >
        {/* Icon & Status */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${scenario.color}20` }}
          >
            {scenario.icon}
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              statusColors[scenario.status]
            }`}
          >
            {statusLabels[scenario.status]}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {scenario.name}
        </h3>

        {/* Description */}
        {scenario.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {scenario.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <span>Updated {updatedDate}</span>
          <span className="text-blue-600 dark:text-blue-400 hover:underline">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
