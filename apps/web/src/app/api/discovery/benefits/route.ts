import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for benefits data
const benefitsSchema = z.object({
  benefits: z.object({
    financial: z.array(z.string()),
    career: z.array(z.string()),
    health: z.array(z.string()),
    education: z.array(z.string()).optional(),
    lifestyle: z.array(z.string()).optional(),
  }),
});

/**
 * POST /api/discovery/benefits
 * Save user's benefit tag selections
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = benefitsSchema.parse(body);

    // Save benefits for each domain
    const promises = Object.entries(validatedData.benefits).map(async ([domain, tagIds]) => {
      if (tagIds.length === 0) return;

      // Delete existing rankings for this domain
      await db.benefitRanking.deleteMany({
        where: {
          userId: userId,
          domain,
        },
      });

      // Create new rankings
      const rankings = tagIds.map((tagId, index) => ({
        userId: userId,
        domain,
        tagId,
        rank: index + 1, // Rank 1 is highest priority
      }));

      return db.benefitRanking.createMany({
        data: rankings,
      });
    });

    await Promise.all(promises);

    // Update user's profile to indicate benefits discovery is complete
    await db.user.update({
      where: { id: userId },
      data: {
        setupCompleted: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Benefits saved successfully',
    });
  } catch (error) {
    console.error('Error saving benefits:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save benefits' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/discovery/benefits
 * Retrieve user's benefit selections
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's benefit rankings
    const rankings = await db.benefitRanking.findMany({
      where: { userId: userId },
      orderBy: [
        { domain: 'asc' },
        { rank: 'asc' },
      ],
    });

    // Group by domain
    const benefitsByDomain = rankings.reduce((acc, ranking) => {
      if (!acc[ranking.domain]) {
        acc[ranking.domain] = [];
      }
      acc[ranking.domain].push(ranking.tagId);
      return acc;
    }, {} as Record<string, string[]>);

    return NextResponse.json({
      benefits: benefitsByDomain,
    });
  } catch (error) {
    console.error('Error fetching benefits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benefits' },
      { status: 500 }
    );
  }
}