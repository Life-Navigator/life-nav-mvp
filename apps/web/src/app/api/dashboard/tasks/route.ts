import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';

// Force dynamic rendering - this route depends on user session and database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify JWT and get user ID
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get today's date range (start and end of day in user's timezone)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch calendar connections for the user
    const calendarConnections = await prisma.calendarConnection.findMany({
      where: {
        userId,
        status: 'active'
      },
      select: { id: true }
    });

    const connectionIds = calendarConnections.map(conn => conn.id);

    // If no calendar connections, return empty array
    if (connectionIds.length === 0) {
      return NextResponse.json({
        tasks: [],
        hasCalendarConnection: false
      });
    }

    // Fetch today's calendar events
    const events = await prisma.calendarEvent.findMany({
      where: {
        calendarConnectionId: { in: connectionIds },
        status: { not: 'cancelled' },
        OR: [
          {
            // Events that start today
            startTime: {
              gte: today,
              lt: tomorrow
            }
          },
          {
            // All-day events that include today
            isAllDay: true,
            startTime: { lte: tomorrow },
            endTime: { gte: today }
          }
        ]
      },
      orderBy: [
        { isAllDay: 'desc' },
        { startTime: 'asc' }
      ],
      take: 10,
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        isAllDay: true,
        location: true,
        description: true,
        status: true,
        meetingLink: true,
        calendarName: true,
        color: true
      }
    });

    return NextResponse.json({
      tasks: events,
      hasCalendarConnection: true
    });
  } catch (error) {
    console.error('Error fetching calendar tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar tasks' },
      { status: 500 }
    );
  }
}
