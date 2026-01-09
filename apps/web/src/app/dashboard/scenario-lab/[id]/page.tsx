'use client';

/**
 * Scenario Detail Page
 * Workspace with tabs: Decisions, Scoreboard, Roadmap, Reports
 */

import { useState, useEffect } from 'react';
import { useAuth, getAuthHeaders } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';
import Link from 'next/link';
import DecisionsTab from '@/components/scenario-lab/DecisionsTab';
import ScoreboardTab from '@/components/scenario-lab/ScoreboardTab';
import RoadmapTab from '@/components/scenario-lab/RoadmapTab';
import ReportsTab from '@/components/scenario-lab/ReportsTab';

type Tab = 'decisions' | 'scoreboard' | 'roadmap' | 'reports';

export default function ScenarioDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams();
  const scenarioId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>('decisions');
  const [scenario, setScenario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && scenarioId) {
      fetchScenario();
    }
  }, [isAuthenticated, scenarioId]);

  const fetchScenario = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/scenario-lab/scenarios/${scenarioId}`, { headers });

      if (response.ok) {
        const data = await response.json();
        setScenario(data.scenario);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load scenario');
      }
    } catch (err) {
      console.error('Error fetching scenario:', err);
      setError('Failed to load scenario');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !scenario) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
              Error
            </h2>
            <p className="text-red-800 dark:text-red-200 mb-4">
              {error || 'Scenario not found'}
            </p>
            <Link
              href="/dashboard/scenario-lab"
              className="text-red-600 dark:text-red-400 hover:underline"
            >
              ← Back to Scenario Lab
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'decisions', label: 'Decisions', icon: '📝' },
    { id: 'scoreboard', label: 'Scoreboard', icon: '📊' },
    { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
    { id: 'reports', label: 'Reports', icon: '📄' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/scenario-lab"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ← Back
              </Link>
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${scenario.color}20` }}
              >
                {scenario.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {scenario.name}
                </h1>
                {scenario.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {scenario.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  scenario.status === 'draft'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    : scenario.status === 'committed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                }`}
              >
                {scenario.status.charAt(0).toUpperCase() + scenario.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === 'decisions' && (
          <DecisionsTab scenarioId={scenarioId} versionId={scenario.current_version_id} />
        )}

        {activeTab === 'scoreboard' && (
          <ScoreboardTab
            scenarioId={scenarioId}
            versionId={scenario.current_version_id}
            scenarioStatus={scenario.status}
          />
        )}

        {activeTab === 'roadmap' && (
          <RoadmapTab
            scenarioId={scenarioId}
            versionId={scenario.current_version_id}
            scenarioStatus={scenario.status}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            scenarioId={scenarioId}
            versionId={scenario.current_version_id}
            scenarioStatus={scenario.status}
          />
        )}
      </div>
    </div>
  );
}
