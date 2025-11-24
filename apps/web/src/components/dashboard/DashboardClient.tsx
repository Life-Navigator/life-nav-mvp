'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';
import AddDataModal from '@/components/dashboard/AddDataModal';

interface DashboardData {
  financial: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    checking: number;
    savings: number;
    investments: number;
    hasData: boolean;
  };
  health: {
    nextAppointment: {
      date: string;
      title: string;
      provider: string;
    } | null;
    wellnessScore: number | null;
    medicationsDue: number;
    hasData: boolean;
  };
  career: {
    title: string | null;
    company: string | null;
    networkSize: number;
    activeApplications: number;
    hasData: boolean;
  };
  education: {
    activeCourses: number;
    completionRate: number;
    studyStreak: number;
    hasData: boolean;
  };
  hasAnyData: boolean;
}

interface DashboardClientProps {
  initialSession?: any;
}

export default function DashboardClient({ initialSession }: DashboardClientProps) {
  const currentSession = initialSession;
  const [userName, setUserName] = useState<string>('User');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votedModules, setVotedModules] = useState<Set<string>>(new Set());
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'financial' | 'health' | 'career' | 'education' | null>(null);

  const quickActions = [
    { name: 'Benefits Discovery', icon: '🎨', href: '/discovery/benefits' },
    { name: 'Create Goal', icon: '🎯', href: '/goals/create' },
    { name: 'What-What-Why', icon: '💭', href: '/conversation' },
    { name: 'Risk Assessment', icon: '📊', href: '/dashboard/goals' },
    { name: 'Calculators', icon: '🧮', href: '/dashboard/calculators' },
    { name: 'Family', icon: '👨‍👩‍👧‍👦', href: '/dashboard/family' }
  ];

  const futureModules = [
    { id: 'habit-tracker', name: 'Habit Tracker', description: 'Track daily habits and build consistent routines', votes: 127 },
    { id: 'social-network', name: 'Social Network', description: 'Connect with like-minded individuals', votes: 95 },
    { id: 'ai-coach', name: 'AI Life Coach', description: 'Get personalized coaching powered by AI', votes: 203 },
    { id: 'milestone-celebrations', name: 'Milestone Celebrations', description: 'Celebrate achievements with friends', votes: 78 }
  ];

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('access_token');
      if (!token && !currentSession?.user?.name) return;

      // Use NextAuth session name if available
      if (currentSession?.user?.name) {
        setUserName(currentSession.user.name);
        return;
      }

      // Otherwise fetch from API
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1'}/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const userData = await response.json();
          const firstName = userData.first_name || userData.name || 'User';
          setUserName(firstName);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    fetchUserProfile();
  }, [currentSession]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Get token from localStorage (used by custom auth)
      const token = localStorage.getItem('access_token');

      if (!token && !currentSession?.user?.id) {
        // No authentication at all - show empty dashboard
        setDataLoading(false);
        setDashboardData({
          financial: { netWorth: 0, totalAssets: 0, totalLiabilities: 0, checking: 0, savings: 0, investments: 0, hasData: false },
          health: { nextAppointment: null, wellnessScore: null, medicationsDue: 0, hasData: false },
          career: { title: null, company: null, networkSize: 0, activeApplications: 0, hasData: false },
          education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
          hasAnyData: false
        });
        return;
      }

      try {
        setDataLoading(true);
        const headers: HeadersInit = { 'Content-Type': 'application/json' };

        // Add authorization header if we have a custom token
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/dashboard/summary', { headers });

        if (!response.ok) {
          // If API fails, show empty dashboard instead of error
          console.warn('Dashboard API returned error, showing empty dashboard');
          setDashboardData({
            financial: { netWorth: 0, totalAssets: 0, totalLiabilities: 0, checking: 0, savings: 0, investments: 0, hasData: false },
            health: { nextAppointment: null, wellnessScore: null, medicationsDue: 0, hasData: false },
            career: { title: null, company: null, networkSize: 0, activeApplications: 0, hasData: false },
            education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
            hasAnyData: false
          });
          setDataLoading(false);
          return;
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        // Show empty dashboard on error instead of error message
        setDashboardData({
          financial: { netWorth: 0, totalAssets: 0, totalLiabilities: 0, checking: 0, savings: 0, investments: 0, hasData: false },
          health: { nextAppointment: null, wellnessScore: null, medicationsDue: 0, hasData: false },
          career: { title: null, company: null, networkSize: 0, activeApplications: 0, hasData: false },
          education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
          hasAnyData: false
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentSession]);

  const handleVote = (moduleId: string) => {
    setVotedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

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
        <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-800 dark:text-red-200 max-w-md text-center border border-red-200 dark:border-red-700">
          <p className="text-lg font-medium">{error}</p>
          <p className="mt-2">Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="py-6 px-6 max-w-[1400px] mx-auto">
        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-white">
            Welcome back, {userName}!
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Here's your life overview for today
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all transform hover:scale-105"
              >
                <div className="text-3xl mb-2">{action.icon}</div>
                <p className="text-xs font-medium text-center text-gray-900 dark:text-white">{action.name}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Metric Cards - 2x2 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Financial Overview Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-t-4 border-green-600 dark:border-green-500 shadow-md">
            <div className="p-6">
              <Link href="/dashboard/finance">
                <h3 className="text-base font-bold mb-4 hover:underline cursor-pointer text-gray-900 dark:text-white">
                  Financial Overview
                </h3>
              </Link>
              {dashboardData?.financial.hasData ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">Net Worth</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${dashboardData.financial.netWorth.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Current
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">Total Assets</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${dashboardData.financial.totalAssets.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Accounts & Investments
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">Total Liabilities</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${dashboardData.financial.totalLiabilities.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Debts & Loans
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Checking</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ${dashboardData.financial.checking.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Savings</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ${dashboardData.financial.savings.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Investments</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ${dashboardData.financial.investments.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No financial data yet. Add your accounts to get started.
                  </p>
                  <button
                    onClick={() => setActiveModal('financial')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                  >
                    Add Financial Data
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Healthcare Overview Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-t-4 border-red-600 dark:border-red-500 shadow-md">
            <div className="p-6">
              <Link href="/dashboard/healthcare">
                <h3 className="text-base font-bold mb-4 hover:underline cursor-pointer text-gray-900 dark:text-white">
                  Healthcare Overview
                </h3>
              </Link>
              {dashboardData?.health.hasData ? (
                <>
                  {dashboardData.health.nextAppointment && (
                    <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">Next Appointment</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {dashboardData.health.nextAppointment.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(dashboardData.health.nextAppointment.date).toLocaleDateString()} - {dashboardData.health.nextAppointment.provider}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {dashboardData.health.wellnessScore !== null && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Wellness Score</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {dashboardData.health.wellnessScore}/100
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Meds Due</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {dashboardData.health.medicationsDue}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No healthcare data yet. Add your health information.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Link
                      href="/dashboard/healthcare"
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                    >
                      Go to Healthcare
                    </Link>
                    <button
                      onClick={() => setActiveModal('health')}
                      className="inline-flex items-center justify-center px-4 py-2 border border-red-600 dark:border-red-500 text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Import Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Career Overview Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-t-4 border-purple-600 dark:border-purple-500 shadow-md">
            <div className="p-6">
              <Link href="/dashboard/career">
                <h3 className="text-base font-bold mb-4 hover:underline cursor-pointer text-gray-900 dark:text-white">
                  Career Overview
                </h3>
              </Link>
              {dashboardData?.career.hasData ? (
                <>
                  {(dashboardData.career.title || dashboardData.career.company) && (
                    <div className="mb-4">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {dashboardData.career.title || 'Position'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {dashboardData.career.company || 'Company'}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Network</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {dashboardData.career.networkSize}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Applications</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {dashboardData.career.activeApplications}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No career data yet. Add your career information.
                  </p>
                  <button
                    onClick={() => setActiveModal('career')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                  >
                    Add Career Data
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Education Overview Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-t-4 border-blue-600 dark:border-blue-500 shadow-md">
            <div className="p-6">
              <Link href="/dashboard/education">
                <h3 className="text-base font-bold mb-4 hover:underline cursor-pointer text-gray-900 dark:text-white">
                  Education Overview
                </h3>
              </Link>
              {dashboardData?.education.hasData ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Active Courses</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dashboardData.education.activeCourses}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Completion</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dashboardData.education.completionRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Study Streak</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dashboardData.education.studyStreak} days
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No education data yet. Add your learning activities.
                  </p>
                  <button
                    onClick={() => setActiveModal('education')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Add Education Data
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Daily Tasks and Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Tasks */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Today's Tasks</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {/* Task items will be populated from API */}
              <div className="text-center py-8">
                <span className="text-5xl mb-2 block">📅</span>
                <p className="text-gray-500 dark:text-gray-400 mb-3">No calendar connected</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                  Connect your calendar to see today's tasks and events
                </p>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                  Connect Calendar
                </button>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Alerts & Notifications</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                Mark All Read
              </button>
            </div>

            <div className="space-y-3">
              {/* Alert items will be populated from API */}
              <div className="text-center py-8">
                <span className="text-5xl mb-2 block">🔔</span>
                <p className="text-gray-500 dark:text-gray-400">No new alerts</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">You're all up to date!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Future Modules Voting Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="mb-4">
            <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Help Shape the Future</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Vote for the features you'd like to see next</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {futureModules.map((module) => {
              const hasVoted = votedModules.has(module.id);
              const displayVotes = module.votes + (hasVoted ? 1 : 0);
              return (
                <div
                  key={module.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    hasVoted
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">{module.name}</h4>
                      <p className="text-xs mb-3 text-gray-600 dark:text-gray-400">{module.description}</p>
                    </div>
                    <button
                      onClick={() => handleVote(module.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                        hasVoted
                          ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600'
                      } border`}
                    >
                      {hasVoted ? '✓ Voted' : 'Vote'} ({displayVotes})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Data Modal */}
      {activeModal && (
        <AddDataModal
          isOpen={activeModal !== null}
          onClose={() => setActiveModal(null)}
          domain={activeModal}
        />
      )}
    </div>
  );
}
