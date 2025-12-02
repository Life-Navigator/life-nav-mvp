import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { feature } = body;

    if (!feature) {
      return NextResponse.json(
        { error: 'Feature name is required' },
        { status: 400 }
      );
    }

    // Get user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already on waitlist for this feature
    const existingEntry = await prisma.featureWaitlist.findFirst({
      where: {
        userId: user.id,
        feature,
      },
    });

    if (existingEntry) {
      return NextResponse.json(
        { message: 'Already on waitlist', waitlist: existingEntry },
        { status: 200 }
      );
    }

    // Add to waitlist
    const waitlistEntry = await prisma.featureWaitlist.create({
      data: {
        userId: user.id,
        feature,
      },
    });

    return NextResponse.json(
      { message: 'Successfully joined waitlist', waitlist: waitlistEntry },
      { status: 201 }
    );
  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET endpoint to retrieve waitlist stats (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all waitlist entries grouped by feature
    const waitlistStats = await prisma.featureWaitlist.groupBy({
      by: ['feature'],
      _count: {
        id: true,
      },
    });

    // Get user's waitlist entries
    const userWaitlist = await prisma.featureWaitlist.findMany({
      where: {
        userId: user.id,
      },
      select: {
        feature: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      stats: waitlistStats,
      userWaitlist,
    });
  } catch (error) {
    console.error('Waitlist GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waitlist data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
