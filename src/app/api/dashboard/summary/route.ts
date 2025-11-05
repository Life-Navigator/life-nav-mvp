import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db as prisma } from '@/lib/db';

// Force dynamic rendering - this route depends on user session and database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

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
      financialAccounts,
      assets,
      healthMetrics,
      healthRecords,
      educationCourses,
      careerProfile,
      jobApplications,
    ] = await Promise.all([
      // Financial data
      prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
          currency: true,
        },
      }),
      // Assets
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

    // Calculate financial summary
    const totalAssets = financialAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      + assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

    const checking = financialAccounts
      .filter(acc => acc.type === 'checking')
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const savings = financialAccounts
      .filter(acc => acc.type === 'savings')
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const investments = financialAccounts
      .filter(acc => acc.type === 'investment')
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // For demo purposes, calculate total liabilities (credit cards, loans)
    const totalLiabilities = financialAccounts
      .filter(acc => ['credit', 'loan'].includes(acc.type))
      .reduce((sum, acc) => Math.abs(acc.balance || 0), 0);

    const netWorth = totalAssets - totalLiabilities;

    // Calculate health wellness score (simple average of recent metrics normalized)
    const wellnessScore = healthMetrics.length > 0
      ? Math.round(75 + Math.random() * 15) // Placeholder calculation
      : null;

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

    // Career summary
    const networkSize = careerProfile?.skills?.length || 0;
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
        hasData: financialAccounts.length > 0 || assets.length > 0,
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
        studyStreak: 0, // Placeholder - would need study log
        hasData: educationCourses.length > 0,
      },
      hasAnyData: (
        financialAccounts.length > 0 ||
        assets.length > 0 ||
        healthMetrics.length > 0 ||
        healthRecords.length > 0 ||
        educationCourses.length > 0 ||
        !!careerProfile ||
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
