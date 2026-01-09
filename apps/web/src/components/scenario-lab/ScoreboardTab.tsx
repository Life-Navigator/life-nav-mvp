'use client';

/**
 * Scoreboard Tab Component
 * Shows goal probabilities with pin/unpin controls
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';
import ProbabilitySparkline from './ProbabilitySparkline';

interface Goal {
  goal_id: string;
  probability: number;
  p10: number;
  p50: number;
  p90: number;
  status: string;
  top_drivers: Array<{ field: string; impact: number }>;
  top_risks: Array<{ field: string; impact: number }>;
}

interface ScoreboardTabProps {
  scenarioId: string;
  versionId: string | null;
  scenarioStatus: string;
}

export default function ScoreboardTab({
  scenarioId,
  versionId,
  scenarioStatus,
}: ScoreboardTabProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinnedGoalId, setPinnedGoalId] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);

  useEffect(() => {
    if (versionId) {
      fetchGoals();
      fetchCurrentPin();
    } else {
      setLoading(false);
    }
  }, [versionId]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Fetch latest simulation run
      const simResponse = await fetch(
        `/api/scenario-lab/versions/${versionId}/simulations?limit=1`,
        { headers }
      );

      if (simResponse.ok) {
        const simData = await simResponse.json();
        if (simData.simulations && simData.simulations.length > 0) {
          const latestSim = simData.simulations[0];

          // Fetch goal snapshots
          const goalsResponse = await fetch(
            `/api/scenario-lab/simulations/${latestSim.id}/goals`,
            { headers }
          );

          if (goalsResponse.ok) {
            const goalsData = await goalsResponse.json();
            setGoals(goalsData.goals || []);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPin = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/scenario-lab/pins', { headers });

      if (response.ok) {
        const data = await response.json();
        if (data.pin && data.pin.scenarioId === scenarioId) {
          setPinnedGoalId(data.pin.goalId);
        }
      }
    } catch (error) {
      console.error('Error fetching pin:', error);
    }
  };

  const handlePin = async (goalId: string) => {
    if (!versionId) return;

    try {
      setPinning(goalId);
      const headers = getAuthHeaders();

      const response = await fetch('/api/scenario-lab/pins', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId,
          versionId,
          goalId,
        }),
      });

      if (response.ok) {
        setPinnedGoalId(goalId);
        alert('Goal pinned to dashboard!');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to pin goal');
      }
    } catch (error) {
      console.error('Error pinning goal:', error);
      alert('Failed to pin goal');
    } finally {
      setPinning(null);
    }
  };

  const handleUnpin = async () => {
    try {
      setPinning('unpin');
      const headers = getAuthHeaders();

      const response = await fetch('/api/scenario-lab/pins', {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        setPinnedGoalId(null);
      }
    } catch (error) {
      console.error('Error unpinning:', error);
    } finally {
      setPinning(null);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('ahead'))
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (statusLower.includes('track'))
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    if (statusLower.includes('behind'))
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    if (statusLower.includes('risk'))
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!versionId) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p className="text-yellow-800 dark:text-yellow-200">
          No version available. Please create a version first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <div className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600 mb-4">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Simulation Results Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Run a simulation on the Decisions tab to see goal probabilities here.
        </p>
      </div>
    );
  }

  const canPin = scenarioStatus === 'committed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Goal Probabilities
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          View simulation results and pin your most important goal to the dashboard.
        </p>
        {!canPin && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Tip:</strong> Commit this scenario to pin goals to your dashboard.
            </p>
          </div>
        )}
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {goals.map((goal) => {
          const isPinned = pinnedGoalId === goal.goal_id;
          const isPinning = pinning === goal.goal_id;

          return (
            <div
              key={goal.goal_id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {goal.goal_id}
                </h3>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
                  {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6">
                {/* Probability */}
                <div className="mb-6">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {formatCurrency(goal.p50)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Expected outcome (P50)
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                    <span>Range: {formatCurrency(goal.p10)}</span>
                    <span>—</span>
                    <span>{formatCurrency(goal.p90)}</span>
                  </div>
                </div>

                {/* Drivers & Risks */}
                {(goal.top_drivers.length > 0 || goal.top_risks.length > 0) && (
                  <div className="mb-6 space-y-3">
                    {goal.top_drivers.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Top Drivers
                        </div>
                        <div className="space-y-1">
                          {goal.top_drivers.slice(0, 3).map((driver, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-gray-600 dark:text-gray-400"
                            >
                              • {driver.field.replace(/_/g, ' ')} ({(driver.impact * 100).toFixed(1)}%)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {goal.top_risks.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Top Risks
                        </div>
                        <div className="space-y-1">
                          {goal.top_risks.slice(0, 3).map((risk, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-gray-600 dark:text-gray-400"
                            >
                              • {risk.field.replace(/_/g, ' ')} ({(risk.impact * 100).toFixed(1)}%)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pin Button */}
                <div>
                  {isPinned ? (
                    <button
                      onClick={handleUnpin}
                      disabled={pinning === 'unpin'}
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Pinned to Dashboard
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePin(goal.goal_id)}
                      disabled={!canPin || isPinning}
                      title={!canPin ? 'Commit scenario to pin goals' : ''}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                      {isPinning ? 'Pinning...' : 'Pin to Dashboard'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
