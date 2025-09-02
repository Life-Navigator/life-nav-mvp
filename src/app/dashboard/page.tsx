'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';
// Removed mock data imports - will fetch from database

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simple loading effect to ensure session is available
    if (status === 'loading') {
      return;
    }
    
    if (status === 'unauthenticated') {
      setError('You must be logged in to view this page');
      setLoading(false);
      return;
    }
    
    // Set user data from session
    if (session?.user) {
      setUserData({
        name: session.user.name || 'User',
        email: session.user.email,
        id: session.user.id
      });
    }
    
    setLoading(false);
  }, [session, status]);

  // Initialize empty state for dashboard data
  const [dashboardData, setDashboardData] = useState<any>({
    goals: [],
    riskAssessment: null,
    metrics: {}
  });
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch real dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session?.user?.id) return;
      
      try {
        setDataLoading(true);
        
        // Fetch user's goals
        const goalsRes = await fetch('/api/goals');
        const goals = goalsRes.ok ? await goalsRes.json() : [];
        
        // Fetch risk assessment status
        const riskRes = await fetch('/api/risk-assessment');
        const riskAssessment = riskRes.ok ? await riskRes.json() : null;
        
        setDashboardData({
          goals,
          riskAssessment,
          metrics: {}
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (session?.user) {
      fetchDashboardData();
    }
  }, [session]);

  // Quick actions for user
  const quickActions = [
    { name: 'Benefits Discovery', icon: '🎨', href: '/discovery/benefits' },
    { name: 'MyBlocks Goals', icon: '🎯', href: '/goals/create' },
    { name: 'What-What-Why', icon: '💭', href: '/conversation' },
    { name: 'Risk Assessment', icon: '📊', href: '/dashboard/risk-assessment' },
    { name: 'View Progress', icon: '📈', href: '/dashboard/goals' },
    { name: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
  ];

  // Show loading spinner while fetching user data
  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Show error message if fetching user data failed
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white sr-only">Dashboard</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
          Welcome back, {userData?.name || 'User'}! Here's your life at a glance.
        </p>
      </div>
      
      <div className="mx-auto px-4 sm:px-6 md:px-8">
        {/* Quick Actions */}
        <div className="mt-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className="relative flex items-center space-x-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm hover:shadow transition-all"
              >
                <div className="flex-shrink-0 text-2xl">{action.icon}</div>
                <div className="min-w-0 flex-1">
                  <span className="absolute inset-0" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{action.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Goals Overview */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Your Goals</h2>
          {dashboardData.goals.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {dashboardData.goals.slice(0, 4).map((goal: any) => (
                <div
                  key={goal.id}
                  className="bg-white dark:bg-gray-800 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow p-4"
                >
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">{goal.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{goal.description}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Progress</span>
                      <span className="font-medium text-gray-900 dark:text-white">{goal.progress || 0}%</span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${goal.progress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't set any goals yet.</p>
              <Link
                href="/dashboard/goals/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Your First Goal
              </Link>
            </div>
          )}
        </div>
        
        {/* Risk Assessment Status */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Risk Assessment</h2>
          {dashboardData.riskAssessment ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Assessment Status</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {dashboardData.riskAssessment.status === 'completed' ? 'Completed' : 'In Progress'}
                  </p>
                </div>
                {dashboardData.riskAssessment.theta && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Risk Score</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round(dashboardData.riskAssessment.theta * 100)}
                    </p>
                  </div>
                )}
              </div>
              {dashboardData.riskAssessment.recommendations && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Recommendations:</p>
                  <ul className="space-y-1">
                    {dashboardData.riskAssessment.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">Complete your risk assessment to get personalized recommendations.</p>
              <Link
                href="/dashboard/risk-assessment"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Start Risk Assessment
              </Link>
            </div>
          )}
        </div>

        {/* Getting Started */}
        {!dashboardData.goals.length && !dashboardData.riskAssessment && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Welcome to LifeNavigator!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get started by completing your risk assessment and setting your first goals.
            </p>
            <div className="flex gap-4">
              <Link
                href="/dashboard/risk-assessment"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Take Risk Assessment
              </Link>
              <Link
                href="/dashboard/goals/new"
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