'use client';

/**
 * Scenario Lab - Main Page
 *
 * Allows users to create and manage "what-if" scenarios
 * with Monte Carlo simulation and explainable outputs
 */

import { useState, useEffect } from 'react';
import { useAuth, getAuthHeaders } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';
import ScenarioCard from '@/components/scenario-lab/ScenarioCard';
import CreateScenarioModal from '@/components/scenario-lab/CreateScenarioModal';

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  status: 'draft' | 'active' | 'committed' | 'archived';
  created_at: string;
  updated_at: string;
}

export default function ScenarioLabPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check feature flag
  const featureEnabled = process.env.NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED === 'true';

  useEffect(() => {
    if (isAuthenticated && featureEnabled) {
      fetchScenarios();
    }
  }, [isAuthenticated, featureEnabled]);

  const fetchScenarios = async () => {
    try {
      setDataLoading(true);
      setError(null); // Clear any previous errors
      const headers = getAuthHeaders();
      const response = await fetch('/api/scenario-lab/scenarios', { headers });

      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      } else if (response.status === 404) {
        // No scenarios found is not an error - show empty state
        setScenarios([]);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load scenarios');
      }
    } catch (err) {
      console.error('Error fetching scenarios:', err);
      // Only show error for actual failures, not empty states
      setError('Unable to connect to server. Please check your connection.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleCreateScenario = async (data: { name: string; description: string; icon: string; color: string }) => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/scenario-lab/scenarios', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowCreateModal(false);
        fetchScenarios(); // Refresh list
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create scenario');
      }
    } catch (err) {
      console.error('Error creating scenario:', err);
      alert('Failed to create scenario');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!featureEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Feature Not Available
            </h2>
            <p className="text-yellow-800 dark:text-yellow-200">
              The Scenario Lab feature is currently disabled. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Scenario Lab
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Create "what-if" scenarios, run simulations, and explore possibilities
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Scenario
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <>
            {/* Scenarios Grid */}
            {scenarios.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-gray-400 dark:text-gray-600 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No scenarios yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create your first scenario to start exploring possibilities
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Your First Scenario
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onUpdate={fetchScenarios}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateScenarioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateScenario}
        />
      )}
    </div>
  );
}
