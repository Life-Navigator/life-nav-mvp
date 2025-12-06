import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';

// Force dynamic rendering - this route depends on user session and database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify JWT and get user ID
    const userId = await getUserIdFromJWT(request);
    console.log('[Dashboard Summary] User ID from JWT:', userId);

    if (!userId) {
      console.log('[Dashboard Summary] No valid JWT token - returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Dashboard Summary] Proceeding with userId:', userId);

    // Demo mode - return empty data structure without database queries
    if (userId === 'demo-user-id') {
      const dashboardData = {
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
        education: {
          activeCourses: 0,
          completionRate: 0,
          studyStreak: 0,
          hasData: false,
        },
        hasAnyData: false,
      };
      return NextResponse.json(dashboardData);
    }

    // Fetch all dashboard data in parallel
    const [
      plaidItems,
      assets,
      healthMetrics,
      healthRecords,
      educationCourses,
      studyLogs,
      careerProfile,
      careerConnections,
      jobApplications,
    ] = await Promise.all([
      // Financial data from Plaid (source of truth for connected accounts)
      prisma.plaidItem.findMany({
        where: { userId, status: 'active' },
        include: {
          accounts: true,
        },
      }),
      // Assets (manual entries like real estate, vehicles, etc.)
      prisma.asset.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          currentValue: true,
          currency: true,
        },
      }),
      // Health metrics (last 7 days for trends)
      prisma.healthMetric.findMany({
        where: {
          userId,
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      // Upcoming health appointments
      prisma.healthRecord.findMany({
        where: {
          userId,
          date: {
            gte: new Date(),
          },
          type: 'medical_visit',
        },
        orderBy: { date: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          date: true,
          providerName: true,
          category: true,
        },
      }),
      // Active education courses
      prisma.educationCourse.findMany({
        where: {
          userId,
          status: { in: ['enrolled', 'in_progress'] },
        },
        select: {
          id: true,
          title: true,
          provider: true,
          progress: true,
          status: true,
          expectedEndDate: true,
        },
      }),
      // Study logs (last 30 days for streak calculation)
      prisma.studyLog.findMany({
        where: {
          userId,
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          durationMinutes: true,
        },
      }),
      // Career profile
      prisma.careerProfile.findFirst({
        where: { userId },
        select: {
          id: true,
          title: true,
          company: true,
          skills: true,
          linkedInUrl: true,
        },
      }),
      // Career connections (network)
      prisma.careerConnection.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          connectionStrength: true,
        },
      }),
      // Active job applications
      prisma.jobApplication.findMany({
        where: {
          userId,
          status: { in: ['applied', 'screening', 'interviewing', 'offer'] },
        },
        select: {
          id: true,
          companyName: true,
          position: true,
          status: true,
          applicationDate: true,
        },
      }),
    ]);

    // Extract all Plaid accounts from items
    const plaidAccounts = plaidItems.flatMap(item => item.accounts);

    // Calculate financial summary from Plaid accounts
    // Plaid account types: depository, investment, credit, loan, brokerage, other
    // Plaid depository subtypes: checking, savings, cd, money market, etc.
    const plaidAssets = plaidAccounts
      .filter(acc => ['depository', 'investment', 'brokerage'].includes(acc.type))
      .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

    const manualAssets = assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
    const totalAssets = plaidAssets + manualAssets;

    const checking = plaidAccounts
      .filter(acc => acc.type === 'depository' && acc.subtype === 'checking')
      .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

    const savings = plaidAccounts
      .filter(acc => acc.type === 'depository' && ['savings', 'cd', 'money market'].includes(acc.subtype || ''))
      .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

    const investments = plaidAccounts
      .filter(acc => ['investment', 'brokerage'].includes(acc.type))
      .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

    // Calculate total liabilities (credit cards, loans)
    const totalLiabilities = plaidAccounts
      .filter(acc => ['credit', 'loan'].includes(acc.type))
      .reduce((sum, acc) => Math.abs(acc.currentBalance || 0), 0);

    const netWorth = totalAssets - totalLiabilities;
    const hasPlaidConnection = plaidItems.length > 0;

    // Calculate health wellness score based on actual health metrics
    // Calculate average of wellness-related metrics if available
    let wellnessScore: number | null = null;
    if (healthMetrics.length > 0) {
      // Get metrics that could contribute to wellness score
      const wellnessMetrics = healthMetrics.filter(m =>
        ['sleep_hours', 'exercise_minutes', 'stress_level', 'mood', 'energy_level'].includes(m.metricType)
      );

      if (wellnessMetrics.length > 0) {
        // Calculate normalized wellness score based on available metrics
        let totalScore = 0;
        let count = 0;

        wellnessMetrics.forEach(metric => {
          const value = Number(metric.value) || 0;
          switch(metric.metricType) {
            case 'sleep_hours':
              // 7-8 hours is optimal (100), scale around that
              totalScore += Math.min(100, Math.max(0, 100 - Math.abs(value - 7.5) * 15));
              count++;
              break;
            case 'exercise_minutes':
              // 30+ minutes is great
              totalScore += Math.min(100, (value / 30) * 100);
              count++;
              break;
            case 'stress_level':
              // Lower is better (1-10 scale)
              totalScore += Math.max(0, 100 - (value * 10));
              count++;
              break;
            case 'mood':
            case 'energy_level':
              // Higher is better (1-10 scale)
              totalScore += Math.min(100, value * 10);
              count++;
              break;
          }
        });

        wellnessScore = count > 0 ? Math.round(totalScore / count) : null;
      }
    }

    // Next appointment
    const nextAppointment = healthRecords.length > 0
      ? {
          date: healthRecords[0].date,
          title: healthRecords[0].title,
          provider: healthRecords[0].providerName,
        }
      : null;

    // Medications due (from health records with prescriptions)
    const medicationsDue = 0; // Placeholder - would need more complex query

    // Education summary
    const activeCourses = educationCourses.filter(c => c.status === 'in_progress').length;
    const completionRate = educationCourses.length > 0
      ? Math.round(
          educationCourses.reduce((sum, c) => sum + c.progress, 0) / educationCourses.length
        )
      : 0;

    // Calculate study streak
    let studyStreak = 0;
    if (studyLogs.length > 0) {
      // Group study logs by date (normalize to start of day)
      const studyDates = new Set(
        studyLogs.map(log => new Date(log.date).toISOString().split('T')[0])
      );

      // Check consecutive days starting from today
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

    // Career summary
    const networkSize = careerConnections.length;
    const activeApplications = jobApplications.length;

    // Construct response
    const dashboardData = {
      financial: {
        netWorth,
        totalAssets,
        totalLiabilities,
        checking,
        savings,
        investments,
        hasData: hasPlaidConnection || assets.length > 0,
      },
      health: {
        nextAppointment,
        wellnessScore,
        medicationsDue,
        hasData: healthMetrics.length > 0 || healthRecords.length > 0,
      },
      career: {
        title: careerProfile?.title,
        company: careerProfile?.company,
        networkSize,
        activeApplications,
        hasData: !!careerProfile || jobApplications.length > 0,
      },
      education: {
        activeCourses,
        completionRate,
        studyStreak,
        hasData: educationCourses.length > 0 || studyLogs.length > 0,
      },
      hasAnyData: (
        hasPlaidConnection ||
        assets.length > 0 ||
        healthMetrics.length > 0 ||
        healthRecords.length > 0 ||
        educationCourses.length > 0 ||
        studyLogs.length > 0 ||
        !!careerProfile ||
        careerConnections.length > 0 ||
        jobApplications.length > 0
      ),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
