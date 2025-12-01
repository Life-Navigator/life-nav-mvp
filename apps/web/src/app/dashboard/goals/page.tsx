'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';
import { useAuth, getAuthHeaders } from '@/hooks/useAuth';

export default function GoalsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const [dashboardData, setDashboardData] = useState<any>({
    goals: [],
    riskAssessment: null,
    metrics: {}
  });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isAuthenticated) return;

      try {
        setDataLoading(true);

        const headers = getAuthHeaders();

        const goalsRes = await fetch('/api/goals', { headers });
        const goalsData = goalsRes.ok ? await goalsRes.json() : { goals: [] };

        const riskRes = await fetch('/api/risk-assessment', { headers });
        const riskData = riskRes.ok ? await riskRes.json() : [];

        setDashboardData({
          goals: goalsData.goals || [],
          riskAssessment: Array.isArray(riskData) && riskData.length > 0 ? riskData[0] : null,
          metrics: {}
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useAuth hook
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-800 dark:text-red-200 max-w-md text-center">
          <p className="text-lg font-medium">{error}</p>
          <p className="mt-2">Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Goals & Risk Assessment</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Track your goals and understand your risk profile
        </p>
      </div>

      <div className="mx-auto px-4 sm:px-6 md:px-8">
        {/* Goals Overview */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Your Goals</h2>
            <Link
              href="/goals/create"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Create New Goal
            </Link>
          </div>
          {dashboardData.goals.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {dashboardData.goals.map((goal: any) => (
                <div
                  key={goal.id}
                  className="bg-white dark:bg-gray-800 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">{goal.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{goal.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          goal.priority === 'HIGH' || goal.priority === 'CRITICAL'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            : goal.priority === 'MEDIUM'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {goal.priority}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          goal.status === 'COMPLETED'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : goal.status === 'ACTIVE'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {goal.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Progress</span>
                      <span className="font-medium text-gray-900 dark:text-white">{goal.progressPercentage || 0}%</span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                        style={{ width: `${goal.progressPercentage || 0}%` }}
                      />
                    </div>
                  </div>
                  {goal.targetDate && (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't set any goals yet.</p>
              <Link
                href="/goals/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Create Your First Goal
              </Link>
            </div>
          )}
        </div>

        {/* Risk Assessment Status */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Risk Assessment</h2>
            {dashboardData.riskAssessment?.status !== 'IN_PROGRESS' && (
              <Link
                href="/dashboard/risk-assessment"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              >
                {dashboardData.riskAssessment ? 'Retake Assessment' : 'Start Assessment'}
              </Link>
            )}
          </div>
          {dashboardData.riskAssessment ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Assessment Status</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {dashboardData.riskAssessment.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                  </p>
                </div>
                {dashboardData.riskAssessment.overallScore !== undefined && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Risk Score</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round(dashboardData.riskAssessment.overallScore)}
                    </p>
                  </div>
                )}
              </div>
              {dashboardData.riskAssessment.riskLevel && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Risk Level:</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    dashboardData.riskAssessment.riskLevel === 'HIGH'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      : dashboardData.riskAssessment.riskLevel === 'MEDIUM'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                  }`}>
                    {dashboardData.riskAssessment.riskLevel}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">Complete your risk assessment to get personalized recommendations.</p>
              <Link
                href="/dashboard/risk-assessment"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              >
                Start Risk Assessment
              </Link>
            </div>
          )}
        </div>

        {/* Getting Started */}
        {!dashboardData.goals.length && !dashboardData.riskAssessment && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Welcome to Goals & Risk Assessment!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get started by completing your risk assessment and setting your first goals.
            </p>
            <div className="flex gap-4">
              <Link
                href="/dashboard/risk-assessment"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              >
                Take Risk Assessment
              </Link>
              <Link
                href="/goals/create"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Create Goal
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
