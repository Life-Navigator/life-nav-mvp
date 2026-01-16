import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/usage/balance
 * Fetch user's query balance and usage statistics
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user with usage tracking fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionStatus: true,

        // Daily limits
        dailyChatQueries: true,
        dailyScenarioRuns: true,

        // Purchased credits
        purchasedChatQueries: true,
        purchasedScenarioRuns: true,

        // Usage tracking
        queriesUsedToday: true,
        scenariosUsedToday: true,
        lastQueryReset: true,

        // Onboarding
        onboardingCompleted: true,
        onboardingQueriesUsed: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if we need to reset daily counters (midnight UTC)
    const now = new Date();
    const lastReset = new Date(user.lastQueryReset);
    const midnightUTC = new Date(now);
    midnightUTC.setUTCHours(0, 0, 0, 0);

    if (lastReset < midnightUTC) {
      // Reset daily counters
      await prisma.user.update({
        where: { id: userId },
        data: {
          queriesUsedToday: 0,
          scenariosUsedToday: 0,
          lastQueryReset: now,
        },
      });

      user.queriesUsedToday = 0;
      user.scenariosUsedToday = 0;
      user.lastQueryReset = now;
    }

    // Calculate available queries
    const chatQueriesRemaining = Math.max(0, user.dailyChatQueries - user.queriesUsedToday);
    const scenarioRunsRemaining = Math.max(0, user.dailyScenarioRuns - user.scenariosUsedToday);

    return NextResponse.json({
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,

      // Chat queries
      chatQueries: {
        dailyLimit: user.dailyChatQueries,
        usedToday: user.queriesUsedToday,
        remainingToday: chatQueriesRemaining,
        purchased: user.purchasedChatQueries,
        total: chatQueriesRemaining + user.purchasedChatQueries,
      },

      // Scenario runs
      scenarioRuns: {
        dailyLimit: user.dailyScenarioRuns,
        usedToday: user.scenariosUsedToday,
        remainingToday: scenarioRunsRemaining,
        purchased: user.purchasedScenarioRuns,
        total: scenarioRunsRemaining + user.purchasedScenarioRuns,
      },

      // Onboarding status
      onboarding: {
        completed: user.onboardingCompleted,
        queriesUsed: user.onboardingQueriesUsed,
      },

      // Reset info
      lastReset: user.lastQueryReset,
      nextReset: new Date(midnightUTC.getTime() + 24 * 60 * 60 * 1000), // Next midnight UTC
    });
  } catch (error) {
    console.error('Error fetching usage balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
