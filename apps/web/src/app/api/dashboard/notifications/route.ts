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

    // Fetch unread notifications, ordered by priority and creation date
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        read: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: [
        {
          priority: 'desc' // urgent > high > normal > low
        },
        {
          createdAt: 'desc'
        }
      ],
      take: 10,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        category: true,
        priority: true,
        actionUrl: true,
        createdAt: true
      }
    });

    // Get count of unread notifications
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    return NextResponse.json({
      notifications,
      unreadCount,
      hasNotifications: notifications.length > 0
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId,
          read: false
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      return NextResponse.json({ success: true, markedAll: true });
    } else if (notificationId) {
      // Mark specific notification as read
      await prisma.notification.update({
        where: {
          id: notificationId,
          userId // Ensure user owns this notification
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      return NextResponse.json({ success: true, notificationId });
    } else {
      return NextResponse.json(
        { error: 'Missing notificationId or markAllRead parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
