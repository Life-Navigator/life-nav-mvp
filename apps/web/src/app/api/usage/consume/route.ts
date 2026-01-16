import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export type QueryType = 'chat' | 'scenario' | 'onboarding';

interface ConsumeQueryRequest {
  queryType: QueryType;
  agentId?: string;
  metadata?: any;
}

/**
 * POST /api/usage/consume
 * Attempt to consume a query. Returns success/failure and remaining balance.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ConsumeQueryRequest = await request.json();
    const { queryType, agentId, metadata } = body;

    if (!queryType || !['chat', 'scenario', 'onboarding'].includes(queryType)) {
      return NextResponse.json(
        { error: 'Invalid query type. Must be: chat, scenario, or onboarding' },
        { status: 400 }
      );
    }

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionTier: true,
        onboardingCompleted: true,
        onboardingQueriesUsed: true,

        dailyChatQueries: true,
        dailyScenarioRuns: true,
        purchasedChatQueries: true,
        purchasedScenarioRuns: true,
        queriesUsedToday: true,
        scenariosUsedToday: true,
        lastQueryReset: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if daily counters need reset (midnight UTC)
    const now = new Date();
    const lastReset = new Date(user.lastQueryReset);
    const midnightUTC = new Date(now);
    midnightUTC.setUTCHours(0, 0, 0, 0);

    let queriesUsedToday = user.queriesUsedToday;
    let scenariosUsedToday = user.scenariosUsedToday;

    if (lastReset < midnightUTC) {
      // Reset counters
      queriesUsedToday = 0;
      scenariosUsedToday = 0;

      await prisma.user.update({
        where: { id: userId },
        data: {
          queriesUsedToday: 0,
          scenariosUsedToday: 0,
          lastQueryReset: now,
        },
      });
    }

    // ONBOARDING: Never consume queries, always allow
    if (queryType === 'onboarding') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingQueriesUsed: { increment: 1 },
        },
      });

      await prisma.queryLog.create({
        data: {
          userId,
          queryType: 'onboarding',
          agentId,
          creditsConsumed: 0,
          wasOnboarding: true,
          wasPurchased: false,
          metadata: metadata || {},
        },
      });

      return NextResponse.json({
        success: true,
        consumed: 'onboarding',
        remaining: {
          chat: {
            daily: user.dailyChatQueries - queriesUsedToday,
            purchased: user.purchasedChatQueries,
          },
          scenario: {
            daily: user.dailyScenarioRuns - scenariosUsedToday,
            purchased: user.purchasedScenarioRuns,
          },
        },
      });
    }

    // SCENARIO LAB
    if (queryType === 'scenario') {
      const scenariosRemaining = user.dailyScenarioRuns - scenariosUsedToday;

      if (scenariosRemaining > 0) {
        // Use daily free scenario
        await prisma.user.update({
          where: { id: userId },
          data: {
            scenariosUsedToday: { increment: 1 },
          },
        });

        await prisma.queryLog.create({
          data: {
            userId,
            queryType: 'scenario',
            agentId,
            creditsConsumed: 1,
            wasOnboarding: false,
            wasPurchased: false,
            metadata: metadata || {},
          },
        });

        return NextResponse.json({
          success: true,
          consumed: 'daily',
          remaining: {
            chat: {
              daily: user.dailyChatQueries - queriesUsedToday,
              purchased: user.purchasedChatQueries,
            },
            scenario: {
              daily: scenariosRemaining - 1,
              purchased: user.purchasedScenarioRuns,
            },
          },
        });
      } else if (user.purchasedScenarioRuns > 0) {
        // Use purchased credit
        await prisma.user.update({
          where: { id: userId },
          data: {
            purchasedScenarioRuns: { decrement: 1 },
          },
        });

        await prisma.queryLog.create({
          data: {
            userId,
            queryType: 'scenario',
            agentId,
            creditsConsumed: 1,
            wasOnboarding: false,
            wasPurchased: true,
            metadata: metadata || {},
          },
        });

        return NextResponse.json({
          success: true,
          consumed: 'purchased',
          remaining: {
            chat: {
              daily: user.dailyChatQueries - queriesUsedToday,
              purchased: user.purchasedChatQueries,
            },
            scenario: {
              daily: 0,
              purchased: user.purchasedScenarioRuns - 1,
            },
          },
        });
      } else {
        // No scenarios available
        return NextResponse.json({
          success: false,
          error: 'out_of_scenarios',
          message: 'You have used all your daily scenario runs. Purchase more or wait until tomorrow.',
          remaining: {
            chat: {
              daily: user.dailyChatQueries - queriesUsedToday,
              purchased: user.purchasedChatQueries,
            },
            scenario: {
              daily: 0,
              purchased: 0,
            },
          },
        }, { status: 403 });
      }
    }

    // CHAT QUERIES
    if (queryType === 'chat') {
      const queriesRemaining = user.dailyChatQueries - queriesUsedToday;

      if (queriesRemaining > 0) {
        // Use daily free query
        await prisma.user.update({
          where: { id: userId },
          data: {
            queriesUsedToday: { increment: 1 },
          },
        });

        await prisma.queryLog.create({
          data: {
            userId,
            queryType: 'chat',
            agentId,
            creditsConsumed: 1,
            wasOnboarding: false,
            wasPurchased: false,
            metadata: metadata || {},
          },
        });

        return NextResponse.json({
          success: true,
          consumed: 'daily',
          remaining: {
            chat: {
              daily: queriesRemaining - 1,
              purchased: user.purchasedChatQueries,
            },
            scenario: {
              daily: user.dailyScenarioRuns - scenariosUsedToday,
              purchased: user.purchasedScenarioRuns,
            },
          },
        });
      } else if (user.purchasedChatQueries > 0) {
        // Use purchased credit
        await prisma.user.update({
          where: { id: userId },
          data: {
            purchasedChatQueries: { decrement: 1 },
          },
        });

        await prisma.queryLog.create({
          data: {
            userId,
            queryType: 'chat',
            agentId,
            creditsConsumed: 1,
            wasOnboarding: false,
            wasPurchased: true,
            metadata: metadata || {},
          },
        });

        return NextResponse.json({
          success: true,
          consumed: 'purchased',
          remaining: {
            chat: {
              daily: 0,
              purchased: user.purchasedChatQueries - 1,
            },
            scenario: {
              daily: user.dailyScenarioRuns - scenariosUsedToday,
              purchased: user.purchasedScenarioRuns,
            },
          },
        });
      } else {
        // No queries available
        return NextResponse.json({
          success: false,
          error: 'out_of_queries',
          message: 'You have used all your daily chat queries. Purchase more or wait until tomorrow.',
          remaining: {
            chat: {
              daily: 0,
              purchased: 0,
            },
            scenario: {
              daily: user.dailyScenarioRuns - scenariosUsedToday,
              purchased: user.purchasedScenarioRuns,
            },
          },
        }, { status: 403 });
      }
    }

    // Should never reach here
    return NextResponse.json(
      { error: 'Invalid query type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error consuming query:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
