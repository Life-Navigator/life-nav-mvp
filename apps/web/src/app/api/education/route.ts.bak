import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db as prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch education data
    const courses = await prisma.educationCourse.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        provider: true,
        progress: true,
        status: true,
        enrollmentDate: true,
        expectedEndDate: true,
        completionDate: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });

    // Calculate summary statistics
    const totalCourses = courses.length;
    const activeCourses = courses.filter(c => c.status === 'in_progress').length;
    const completedCourses = courses.filter(c => c.status === 'completed').length;
    const avgProgress = courses.length > 0
      ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
      : 0;

    // Generate course progress data for charts
    const courseProgress = courses
      .filter(c => c.status === 'in_progress' || c.status === 'completed')
      .map(course => ({
        id: course.id,
        name: course.title || 'Untitled Course',
        provider: course.provider || 'Unknown',
        progress: course.progress,
        status: course.status,
        expectedEnd: course.expectedEndDate?.toISOString().split('T')[0] || null,
      }));

    // Generate monthly progress (would need activity tracking table)
    const monthlyProgress = generateMonthlyProgress();

    // Generate certifications (would need Certification table)
    const certifications = [];

    // Generate study streak (would need StudyLog table)
    const studyStreak = 0;

    return NextResponse.json({
      summary: {
        totalCourses: totalCourses || 0,
        activeCourses: activeCourses || 0,
        completedCourses: completedCourses || 0,
        avgProgress: avgProgress || 0,
        studyStreak: studyStreak || 0,
      },
      courseProgress: courseProgress || [],
      monthlyProgress: monthlyProgress || [],
      certifications: certifications || [],
    });
  } catch (error) {
    console.error('Error fetching education data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch education data' },
      { status: 500 }
    );
  }
}

// Helper function
function generateMonthlyProgress() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(month => ({
    month,
    coursesStarted: Math.floor(Math.random() * 3),
    coursesCompleted: Math.floor(Math.random() * 2),
    hoursStudied: Math.floor(Math.random() * 40 + 10),
  }));
}
