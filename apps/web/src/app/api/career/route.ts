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
    ]);

    // Transform skills data
    const skills = careerProfile?.skills
      ? (Array.isArray(careerProfile.skills) ? careerProfile.skills : []).map((skill: any) => ({
          name: typeof skill === 'string' ? skill : skill.name || 'Unknown',
          level: typeof skill === 'object' ? skill.level || 70 : 70,
          target: typeof skill === 'object' ? skill.target || 85 : 85,
        }))
      : generateDefaultSkills();

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

    // Generate network metrics (would need NetworkConnection table)
    const networkMetrics = generateNetworkMetrics();

    // Generate upcoming events (would need Event table)
    const upcomingEvents = generateUpcomingEvents();

    // Generate industry trends
    const industryTrends = [
      { skill: 'AI/ML', growth: 85 },
      { skill: 'Cybersecurity', growth: 75 },
      { skill: 'Cloud Computing', growth: 70 },
      { skill: 'Blockchain', growth: 60 },
      { skill: 'Edge Computing', growth: 55 },
    ];

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
function generateDefaultSkills() {
  return [
    { name: 'Communication', level: 85, target: 90 },
    { name: 'Leadership', level: 70, target: 85 },
    { name: 'Technical', level: 90, target: 95 },
    { name: 'Problem Solving', level: 80, target: 85 },
    { name: 'Project Management', level: 75, target: 90 },
    { name: 'Teamwork', level: 85, target: 90 },
    { name: 'Adaptability', level: 80, target: 85 },
    { name: 'Creativity', level: 65, target: 80 },
  ];
}

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

function generateNetworkMetrics() {
  return [
    { month: 'Jan', connections: 5, messages: 12 },
    { month: 'Feb', connections: 8, messages: 15 },
    { month: 'Mar', connections: 12, messages: 20 },
    { month: 'Apr', connections: 9, messages: 18 },
    { month: 'May', connections: 15, messages: 25 },
    { month: 'Jun', connections: 18, messages: 30 },
  ];
}

function generateUpcomingEvents() {
  const now = new Date();
  return [
    {
      id: 'event1',
      title: 'Tech Conference 2025',
      date: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Conference',
    },
    {
      id: 'event2',
      title: 'Networking Mixer',
      date: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Networking',
    },
    {
      id: 'event3',
      title: 'Industry Webinar',
      date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Webinar',
    },
    {
      id: 'event4',
      title: 'Career Fair',
      date: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Fair',
    },
  ];
}
