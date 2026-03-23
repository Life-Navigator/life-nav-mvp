'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';
import AddDataModal from '@/components/dashboard/AddDataModal';
import PinnedScenarioWidget from '@/components/scenario-lab/PinnedScenarioWidget';

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

interface CalendarTask {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  description?: string;
  status: string;
  meetingLink?: string;
  calendarName?: string;
  color?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  priority: string;
  actionUrl?: string;
  createdAt: string;
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
  const [activeModal, setActiveModal] = useState<
    'financial' | 'health' | 'career' | 'education' | null
  >(null);

  // Calendar and Notifications state
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [hasCalendarConnection, setHasCalendarConnection] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const quickActions = [
    { name: 'Benefits Discovery', icon: '🎨', href: '/discovery/benefits' },
    { name: 'Create Goal', icon: '🎯', href: '/goals/create' },
    { name: 'Discovery', icon: '💭', href: '/conversation' },
    { name: 'Risk Assessment', icon: '📊', href: '/dashboard/goals' },
    { name: 'Calculators', icon: '🧮', href: '/dashboard/calculators' },
    { name: 'Family', icon: '👨‍👩‍👧‍👦', href: '/dashboard/family' },
  ];

  const futureModules = [
    {
      id: 'habit-tracker',
      name: 'Habit Tracker',
      description: 'Track daily habits and build consistent routines',
      votes: 127,
    },
    {
      id: 'social-network',
      name: 'Social Network',
      description: 'Connect with like-minded individuals',
      votes: 95,
    },
    {
      id: 'ai-coach',
      name: 'AI Life Coach',
      description: 'Get personalized coaching powered by AI',
      votes: 203,
    },
    {
      id: 'milestone-celebrations',
      name: 'Milestone Celebrations',
      description: 'Celebrate achievements with friends',
      votes: 78,
    },
  ];

  // Fetch user profile from Supabase session
  useEffect(() => {
    const fetchUserProfile = async () => {
      // Use Supabase session user name if available via useSession hook
      if (currentSession?.user) {
        const user = currentSession.user as any;
        const name = user.user_metadata?.name || user.email || 'User';
        setUserName(name);
        return;
      }

      // Fallback: get from Supabase client directly
      try {
        const { getSupabaseClient } = await import('@/lib/supabase/client');
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserName(user.user_metadata?.name || user.email || 'User');
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
      // Auth is handled by cookies — middleware ensures we're authenticated
      const token = null; // legacy token removed, auth via Supabase cookies

      if (!currentSession?.user) {
        // Session not loaded yet — show empty dashboard
        setDataLoading(false);
        setDashboardData({
          financial: {
            netWorth: 0,
            totalAssets: 0,
            totalLiabilities: 0,
            checking: 0,
            savings: 0,
            investments: 0,
            hasData: false,
          },
          health: { nextAppointment: null, wellnessScore: null, medicationsDue: 0, hasData: false },
          career: {
            title: null,
            company: null,
            networkSize: 0,
            activeApplications: 0,
            hasData: false,
          },
          education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
          hasAnyData: false,
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
            financial: {
              netWorth: 0,
              totalAssets: 0,
              totalLiabilities: 0,
              checking: 0,
              savings: 0,
              investments: 0,
              hasData: false,
            },
            health: {
              nextAppointment: null,
              wellnessScore: null,
              medicationsDue: 0,
              hasData: false,
            },
            career: {
              title: null,
              company: null,
              networkSize: 0,
              activeApplications: 0,
              hasData: false,
            },
            education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
            hasAnyData: false,
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
          financial: {
            netWorth: 0,
            totalAssets: 0,
            totalLiabilities: 0,
            checking: 0,
            savings: 0,
            investments: 0,
            hasData: false,
          },
          health: { nextAppointment: null, wellnessScore: null, medicationsDue: 0, hasData: false },
          career: {
            title: null,
            company: null,
            networkSize: 0,
            activeApplications: 0,
            hasData: false,
          },
          education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
          hasAnyData: false,
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentSession]);

  // Fetch calendar tasks
  useEffect(() => {
    const fetchCalendarTasks = async () => {
      const token = null; /* auth via cookie */

      if (!token && !currentSession?.user?.id) {
        setTasksLoading(false);
        return;
      }

      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/dashboard/tasks', { headers });

        if (response.ok) {
          const data = await response.json();
          setCalendarTasks(data.tasks || []);
          setHasCalendarConnection(data.hasCalendarConnection || false);
        }
      } catch (err) {
        console.error('Error fetching calendar tasks:', err);
      } finally {
        setTasksLoading(false);
      }
    };

    fetchCalendarTasks();
  }, [currentSession]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      const token = null; /* auth via cookie */

      if (!token && !currentSession?.user?.id) {
        setNotificationsLoading(false);
        return;
      }

      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/dashboard/notifications', { headers });

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setNotificationsLoading(false);
      }
    };

    fetchNotifications();
  }, [currentSession]);

  const handleVote = (moduleId: string) => {
    setVotedModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleMarkAllRead = async () => {
    try {
      const token = null; /* auth via cookie */
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/dashboard/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ markAllRead: true }),
      });

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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
          <p className="mt-2">
            Please try refreshing the page or contact support if the problem persists.
          </p>
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
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all transform hover:scale-105"
              >
                <div className="text-3xl mb-2">{action.icon}</div>
                <p className="text-xs font-medium text-center text-gray-900 dark:text-white">
                  {action.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Pinned Scenario Widget */}
        <div className="mb-8">
          <PinnedScenarioWidget />
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">Current</p>
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
                      <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">
                        Total Liabilities
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${dashboardData.financial.totalLiabilities.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Debts & Loans</p>
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
                      <p className="text-xs mb-1 text-gray-600 dark:text-gray-400">
                        Next Appointment
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {dashboardData.health.nextAppointment.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(dashboardData.health.nextAppointment.date).toLocaleDateString()} -{' '}
                        {dashboardData.health.nextAppointment.provider}
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
              {hasCalendarConnection && calendarTasks.length > 0 && (
                <Link
                  href="/dashboard/calendar"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View All
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {tasksLoading ? (
                <div className="text-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : !hasCalendarConnection ? (
                <div className="text-center py-8">
                  <span className="text-5xl mb-2 block">📅</span>
                  <p className="text-gray-500 dark:text-gray-400 mb-3">No calendar connected</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                    Connect your calendar to see today's tasks and events
                  </p>
                  <Link
                    href="/dashboard/integrations"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Connect Calendar
                  </Link>
                </div>
              ) : calendarTasks.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-5xl mb-2 block">✅</span>
                  <p className="text-gray-500 dark:text-gray-400">No tasks scheduled for today</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Enjoy your free time!
                  </p>
                </div>
              ) : (
                calendarTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>
                            {task.isAllDay
                              ? 'All Day'
                              : `${formatTime(task.startTime)} - ${formatTime(task.endTime)}`}
                          </span>
                          {task.location && (
                            <>
                              <span>•</span>
                              <span>{task.location}</span>
                            </>
                          )}
                        </div>
                        {task.meetingLink && (
                          <a
                            href={task.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-1 inline-block"
                          >
                            Join Meeting →
                          </a>
                        )}
                      </div>
                      {task.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: task.color }}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Alerts & Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mark All Read
                </button>
              )}
            </div>

            <div className="space-y-3">
              {notificationsLoading ? (
                <div className="text-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-5xl mb-2 block">🔔</span>
                  <p className="text-gray-500 dark:text-gray-400">No new alerts</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    You're all up to date!
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const priorityColors = {
                    urgent: 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
                    high: 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10',
                    normal: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10',
                    low: 'border-l-gray-400 bg-gray-50 dark:bg-gray-700/50',
                  };
                  const typeIcons = {
                    info: 'ℹ️',
                    success: '✅',
                    warning: '⚠️',
                    error: '❌',
                    reminder: '⏰',
                  };

                  return (
                    <div
                      key={notification.id}
                      className={`p-3 border-l-4 rounded-lg ${priorityColors[notification.priority as keyof typeof priorityColors] || priorityColors.normal}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">
                          {typeIcons[notification.type as keyof typeof typeIcons] || '📢'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(notification.createdAt).toLocaleString()}
                            </span>
                            {notification.actionUrl && (
                              <Link
                                href={notification.actionUrl}
                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                View →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Future Modules Voting Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="mb-4">
            <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">
              Help Shape the Future
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vote for the features you'd like to see next
            </p>
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
                      <h4 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">
                        {module.name}
                      </h4>
                      <p className="text-xs mb-3 text-gray-600 dark:text-gray-400">
                        {module.description}
                      </p>
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
