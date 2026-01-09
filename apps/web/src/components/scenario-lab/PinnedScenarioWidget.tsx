'use client';

/**
 * Pinned Scenario Widget
 * Shows pinned goal from Scenario Lab on main dashboard
 */

import { useState, useEffect } from 'react';
import { useAuth, getAuthHeaders } from '@/hooks/useAuth';
import Link from 'next/link';
import ProbabilitySparkline from './ProbabilitySparkline';

interface PinSnapshot {
  status: string;
  p10: number;
  p50: number;
  p90: number;
  drivers: string[];
  risks: string[];
  updatedAt: string;
}

interface Pin {
  id: string;
  scenarioId: string;
  versionId: string;
  goalId: string;
  scenarioName: string;
  createdAt: string;
  updatedAt: string;
  snapshot: PinSnapshot | null;
  trend: number[];
}

export default function PinnedScenarioWidget() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [unpinning, setUnpinning] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPin();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchPin = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch('/api/scenario-lab/pins', { headers });

      if (response.ok) {
        const data = await response.json();
        setPin(data.pin);
      }
    } catch (error) {
      console.error('Error fetching pin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async () => {
    if (!confirm('Remove this goal from your dashboard?')) return;

    try {
      setUnpinning(true);
      const headers = getAuthHeaders();
      const response = await fetch('/api/scenario-lab/pins', {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        setPin(null);
      }
    } catch (error) {
      console.error('Error unpinning:', error);
    } finally {
      setUnpinning(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('ahead')) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    if (statusLower.includes('track')) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    if (statusLower.includes('behind')) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
    if (statusLower.includes('risk')) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (authLoading || loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // No pin - show CTA
  if (!pin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Pin a Goal to Your Dashboard
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Track progress on your most important goal from Scenario Lab. Pin any goal from a
              committed scenario to see daily updates.
            </p>
            <Link
              href="/dashboard/scenario-lab"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Scenario Lab
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Has pin - show widget
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Pinned from Scenario Lab
          </span>
        </div>
        <button
          onClick={handleUnpin}
          disabled={unpinning}
          className="text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {unpinning ? 'Unpinning...' : 'Unpin'}
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Goal Name & Status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {pin.goalId}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              from {pin.scenarioName}
            </p>
          </div>
          {pin.snapshot && (
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(pin.snapshot.status)}`}
            >
              {pin.snapshot.status.charAt(0).toUpperCase() + pin.snapshot.status.slice(1)}
            </span>
          )}
        </div>

        {pin.snapshot ? (
          <>
            {/* Probability */}
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(pin.snapshot.p50)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-500">
                  expected (P50)
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>Range: {formatCurrency(pin.snapshot.p10)}</span>
                <span>—</span>
                <span>{formatCurrency(pin.snapshot.p90)}</span>
              </div>
            </div>

            {/* Sparkline */}
            {pin.trend && pin.trend.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Trend
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    Last {pin.trend.length} simulation{pin.trend.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-center">
                  <ProbabilitySparkline
                    data={pin.trend}
                    width={280}
                    height={60}
                    color="#3B82F6"
                  />
                </div>
              </div>
            )}

            {/* Key Factors */}
            {(pin.snapshot.drivers.length > 0 || pin.snapshot.risks.length > 0) && (
              <div className="mb-6 space-y-3">
                {pin.snapshot.drivers.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Top Drivers
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pin.snapshot.drivers.slice(0, 2).map((driver, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
                        >
                          {driver.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {pin.snapshot.risks.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Top Risks
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pin.snapshot.risks.slice(0, 2).map((risk, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded"
                        >
                          {risk.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Updated {formatDate(pin.snapshot.updatedAt)}
              </span>
              <Link
                href={`/dashboard/scenario-lab/${pin.scenarioId}?tab=scoreboard`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
              >
                View details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              No simulation data available
            </p>
            <Link
              href={`/dashboard/scenario-lab/${pin.scenarioId}`}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              Run simulation
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
