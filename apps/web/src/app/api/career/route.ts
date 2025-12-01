import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

// Force dynamic rendering - this route depends on user session and database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // userId already extracted from JWT

    // Demo mode - return empty data structure without database queries
    if (userId === 'demo-user-id') {
      const careerData = {
        skills: [],
        jobMatch: [],
        networkMetrics: [],
        upcomingEvents: [],
        industryTrends: [],
      };
      return NextResponse.json(careerData);
    }

    // Fetch career data in parallel
    const [
      careerProfile,
      jobApplications,
      careerConnections,
    ] = await Promise.all([
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
      // Job applications
      prisma.jobApplication.findMany({
        where: { userId },
        select: {
          id: true,
          companyName: true,
          position: true,
          status: true,
          applicationDate: true,
          salary: true,
          location: true,
        },
        orderBy: { applicationDate: 'desc' },
      }),
      // Career connections for network metrics
      prisma.careerConnection.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Transform skills data - only if profile exists
    const skills = careerProfile?.skills
      ? (Array.isArray(careerProfile.skills) ? careerProfile.skills : []).map((skill: any) => ({
          name: typeof skill === 'string' ? skill : skill.name || 'Unknown',
          level: typeof skill === 'object' ? skill.level || 70 : 70,
          target: typeof skill === 'object' ? skill.target || 85 : 85,
        }))
      : [];

    // Generate job matches from applications
    const jobMatch = jobApplications
      .filter(app => app.status === 'applied' || app.status === 'screening' || app.status === 'interviewing')
      .slice(0, 4)
      .map(app => ({
        id: app.id,
        company: app.companyName || 'Unknown Company',
        title: app.position || 'Position',
        match: calculateJobMatch(app, skills),
        salary: app.salary || 'Not specified',
        location: app.location || 'Not specified',
      }));

    // Generate network metrics from real CareerConnection data
    const networkMetrics = generateNetworkMetricsFromConnections(careerConnections);

    // No upcoming events - return empty array (would integrate with CalendarEvent)
    const upcomingEvents: any[] = [];

    // No industry trends without real data - return empty array
    const industryTrends: any[] = [];

    return NextResponse.json({
      skills: skills || [],
      jobMatch: jobMatch || [],
      networkMetrics: networkMetrics || [],
      upcomingEvents: upcomingEvents || [],
      industryTrends: industryTrends || [],
    });
  } catch (error) {
    console.error('Error fetching career data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch career data' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateJobMatch(application: any, skills: any[]): number {
  // Simple match calculation - in reality this would be more sophisticated
  const statusBonus = {
    'applied': 70,
    'screening': 80,
    'interviewing': 90,
    'offer': 95,
  };

  const baseMatch = statusBonus[application.status as keyof typeof statusBonus] || 70;
  const skillBonus = skills.length > 0 ? Math.min(20, skills.length * 2) : 10;

  return Math.min(100, baseMatch + skillBonus - Math.floor(Math.random() * 15));
}

function generateNetworkMetricsFromConnections(connections: any[]) {
  if (connections.length === 0) {
    return [];
  }

  // Group connections by month
  const monthlyData: { [key: string]: { connections: number; messages: number } } = {};
  const now = new Date();

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
    monthlyData[monthKey] = { connections: 0, messages: 0 };
  }

  // Count connections added each month
  connections.forEach(conn => {
    const date = new Date(conn.createdAt);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short' });

    if (monthlyData[monthKey]) {
      monthlyData[monthKey].connections += 1;
      // Estimate messages based on connection strength if available
      // For now, use connections * 1.5 as rough estimate
      monthlyData[monthKey].messages += 1;
    }
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    connections: data.connections,
    messages: data.messages,
  }));
}
