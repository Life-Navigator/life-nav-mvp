import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Build date filter if provided
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Fetch calendar events from database
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        ...(Object.keys(dateFilter).length > 0 ? { startTime: dateFilter } : {}),
      },
      orderBy: { startTime: 'asc' },
    });

    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.startTime.toISOString(),
      end: event.endTime.toISOString(),
      allDay: event.allDay || false,
      calendarId: event.calendarSourceId || 'default',
      color: event.color || '#3B82F6',
      description: event.description || '',
      location: event.location || '',
    }));

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, start, end, allDay, calendarId, color, description, location } = body;

    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title,
        startTime: new Date(start),
        endTime: new Date(end),
        allDay: allDay || false,
        calendarSourceId: calendarId,
        color: color || '#3B82F6',
        description: description || '',
        location: location || '',
      },
    });

    return NextResponse.json({
      id: event.id,
      title: event.title,
      start: event.startTime.toISOString(),
      end: event.endTime.toISOString(),
      allDay: event.allDay,
      calendarId: event.calendarSourceId,
      color: event.color,
      description: event.description,
      location: event.location,
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, start, end, allDay, calendarId, color, description, location } = body;

    const event = await prisma.calendarEvent.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        title,
        startTime: new Date(start),
        endTime: new Date(end),
        allDay: allDay || false,
        calendarSourceId: calendarId,
        color: color || '#3B82F6',
        description: description || '',
        location: location || '',
      },
    });

    if (event.count === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    await prisma.calendarEvent.deleteMany({
      where: {
        id: eventId,
        userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar event' },
      { status: 500 }
    );
  }
}
