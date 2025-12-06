import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile/stats
 * Fetch comprehensive user statistics for profile page
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all user data in parallel
    const [
      user,
      goals,
      financialAccounts,
      investments,
      careerProfile,
      careerConnections,
      studyLogs,
      certifications,
      calendarEvents,
      notifications,
      wearableConnections,
      healthMetrics,
    ] = await Promise.all([
      // User data
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          createdAt: true,
          profile: true,
        },
      }),

      // Goals
      prisma.goal.count({
        where: { userId },
      }),

      // Financial accounts
      prisma.plaidItem.count({
        where: { userId },
      }),

      // Investments
      prisma.investmentHolding.count({
        where: {
          account: {
            item: {
              userId
            }
          }
        },
      }),

      // Career profile
      prisma.careerProfile.findFirst({
        where: { userId },
        select: {
          title: true,
          company: true,
          skills: true,
        },
      }),

      // Career connections
      prisma.careerConnection.count({
        where: { userId },
      }),

      // Study logs (for education streak)
      prisma.studyLog.findMany({
        where: { userId },
        select: {
          date: true,
          duration: true,
        },
        orderBy: { date: 'desc' },
        take: 365, // Last year
      }),

      // Certifications
      prisma.certification.count({
        where: { userId },
      }),

      // Calendar events (last 30 days)
      prisma.calendarEvent.count({
        where: {
          calendarConnection: {
            userId
          },
          startTime: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
      }),

      // Unread notifications
      prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      }),

      // Wearable connections
      prisma.wearableConnection.count({
        where: {
          userId,
          status: 'active',
        },
      }),

      // Recent health metrics
      prisma.wearableMetric.findMany({
        where: {
          connection: {
            userId
          },
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        select: {
          metricType: true,
          value: true,
          timestamp: true,
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 100,
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate study streak
    let studyStreak = 0;
    if (studyLogs.length > 0) {
      const studyDates = new Set(
        studyLogs.map(log => new Date(log.date).toISOString().split('T')[0])
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentDate = new Date(today);

      for (let i = 0; i < 365; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (studyDates.has(dateStr)) {
          studyStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate total study hours (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentStudyLogs = studyLogs.filter(log => new Date(log.date) >= thirtyDaysAgo);
    const totalStudyHours = recentStudyLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

    // Calculate health metrics averages
    const stepsData = healthMetrics.filter(m => m.metricType === 'steps');
    const avgSteps = stepsData.length > 0
      ? Math.round(stepsData.reduce((sum, m) => sum + parseFloat(m.value), 0) / stepsData.length)
      : 0;

    const heartRateData = healthMetrics.filter(m => m.metricType === 'heart_rate');
    const avgHeartRate = heartRateData.length > 0
      ? Math.round(heartRateData.reduce((sum, m) => sum + parseFloat(m.value), 0) / heartRateData.length)
      : 0;

    // Calculate days since joining
    const daysSinceJoining = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate achievements
    const achievements = [];

    if (goals >= 1) achievements.push({ id: 'first_goal', name: 'Goal Setter', description: 'Created your first goal', icon: '🎯' });
    if (goals >= 10) achievements.push({ id: 'goal_master', name: 'Goal Master', description: 'Created 10 goals', icon: '🏆' });
    if (financialAccounts >= 1) achievements.push({ id: 'finance_connected', name: 'Finance Connected', description: 'Connected a financial account', icon: '💰' });
    if (studyStreak >= 7) achievements.push({ id: 'study_week', name: 'Week Warrior', description: '7-day study streak', icon: '📚' });
    if (studyStreak >= 30) achievements.push({ id: 'study_month', name: 'Study Champion', description: '30-day study streak', icon: '🔥' });
    if (careerConnections >= 10) achievements.push({ id: 'networker', name: 'Networker', description: '10+ professional connections', icon: '🤝' });
    if (wearableConnections >= 1) achievements.push({ id: 'health_tracker', name: 'Health Tracker', description: 'Connected a wearable device', icon: '⌚' });
    if (user.profile && user.profile.profileCompletion >= 80) achievements.push({ id: 'profile_complete', name: 'Profile Complete', description: '80%+ profile completion', icon: '✨' });
    if (daysSinceJoining >= 30) achievements.push({ id: 'veteran', name: 'Veteran User', description: '30+ days on platform', icon: '🌟' });
    if (certifications >= 1) achievements.push({ id: 'certified', name: 'Certified', description: 'Earned a certification', icon: '🎓' });

    // Build response
    const stats = {
      overview: {
        daysSinceJoining,
        profileCompletion: user.profile?.profileCompletion || 0,
        totalAchievements: achievements.length,
        unreadNotifications: notifications,
      },
      goals: {
        total: goals,
        active: goals, // TODO: Filter by status when we add goal status
      },
      finance: {
        connectedAccounts: financialAccounts,
        totalInvestments: investments,
      },
      career: {
        title: careerProfile?.title || null,
        company: careerProfile?.company || null,
        connections: careerConnections,
        skills: careerProfile?.skills ? (Array.isArray(careerProfile.skills) ? careerProfile.skills.length : 0) : 0,
      },
      education: {
        studyStreak,
        totalStudyHours: Math.round(totalStudyHours),
        certifications,
      },
      health: {
        connectedDevices: wearableConnections,
        avgSteps,
        avgHeartRate: avgHeartRate > 0 ? avgHeartRate : null,
      },
      activity: {
        eventsLast30Days: calendarEvents,
      },
      achievements,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
