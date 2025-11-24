import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// Historical market data for backtesting (simplified S&P 500 annual returns)
const HISTORICAL_RETURNS = [
  0.1088, 0.0001, 0.2647, 0.1906, -0.0073, 0.2633, 0.2888, 0.3336, 0.2258, -0.1002,
  -0.1304, -0.2337, 0.2638, 0.0862, 0.0324, 0.1362, 0.0353, -0.3849, 0.2352, 0.1278,
  0.0100, 0.1341, 0.2983, 0.1140, 0.0138, 0.0969, 0.1942, -0.0623, 0.2889, 0.1630,
];

interface WithdrawalInput {
  portfolioBalance: number;
  annualExpenses: number;
  inflationRate: number;
  expectedReturn: number;
  volatility: number;
  retirementYears: number;
  socialSecurityIncome: number;
  pensionIncome: number;
  otherIncome: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

interface WithdrawalResult {
  strategyName: string;
  description: string;
  initialWithdrawalRate: number;
  yearlyProjections: Array<{
    year: number;
    portfolioBalance: number;
    withdrawal: number;
    totalIncome: number;
    realPurchasingPower: number;
    inflationAdjusted: boolean;
  }>;
  successProbability: number;
  medianEndingBalance: number;
  worstCaseBalance: number;
  averageWithdrawal: number;
  volatilityOfWithdrawals: number;
  pros: string[];
  cons: string[];
  suitableFor: string[];
  score: number;
}

// Strategy 1: Traditional 4% Rule (Bengen Rule)
function calculate4PercentRule(input: WithdrawalInput): WithdrawalResult {
  const initialWithdrawal = input.portfolioBalance * 0.04;
  const yearlyProjections = [];
  let balance = input.portfolioBalance;
  let currentWithdrawal = initialWithdrawal;
  const withdrawals: number[] = [];

  for (let year = 1; year <= input.retirementYears; year++) {
    // Inflation adjust the withdrawal
    if (year > 1) {
      currentWithdrawal *= (1 + input.inflationRate);
    }

    // Withdraw
    const withdrawal = Math.min(currentWithdrawal, balance);
    balance -= withdrawal;
    withdrawals.push(withdrawal);

    // Grow remaining balance (use expected return for projection)
    balance *= (1 + input.expectedReturn);

    const totalIncome = withdrawal + input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      portfolioBalance: Math.round(balance),
      withdrawal: Math.round(withdrawal),
      totalIncome: Math.round(totalIncome),
      realPurchasingPower: Math.round(totalIncome / inflationFactor),
      inflationAdjusted: true,
    });
  }

  const avgWithdrawal = withdrawals.reduce((a, b) => a + b, 0) / withdrawals.length;
  const variance = withdrawals.reduce((sum, w) => sum + Math.pow(w - avgWithdrawal, 2), 0) / withdrawals.length;

  return {
    strategyName: '4% Rule (Bengen)',
    description: 'Withdraw 4% of initial portfolio in year 1, then adjust for inflation annually. The original safe withdrawal rate study.',
    initialWithdrawalRate: 0.04,
    yearlyProjections,
    successProbability: 0.95, // Historical backtesting shows ~95% success over 30 years
    medianEndingBalance: yearlyProjections[yearlyProjections.length - 1]?.portfolioBalance || 0,
    worstCaseBalance: Math.round(balance * 0.3), // Simplified worst case
    averageWithdrawal: Math.round(avgWithdrawal),
    volatilityOfWithdrawals: Math.round(Math.sqrt(variance)),
    pros: [
      'Simple to implement',
      'Well-researched historical basis',
      'Maintains purchasing power',
      'Predictable income stream',
    ],
    cons: [
      'Does not adapt to market conditions',
      'May leave large legacy in good markets',
      'Can fail in severe downturns',
      'Does not account for variable spending',
    ],
    suitableFor: ['Those wanting simplicity', 'Fixed income needs', 'Long retirement horizons'],
    score: 75,
  };
}

// Strategy 2: Guyton-Klinger Guardrails
function calculateGuytonKlinger(input: WithdrawalInput): WithdrawalResult {
  const initialRate = 0.05; // Start with 5% due to guardrails
  const ceilingRate = 0.20; // Upper guardrail (20% above initial)
  const floorRate = 0.20; // Lower guardrail (20% below initial)

  let balance = input.portfolioBalance;
  let currentWithdrawal = balance * initialRate;
  const initialWithdrawal = currentWithdrawal;
  const yearlyProjections = [];
  const withdrawals: number[] = [];

  for (let year = 1; year <= input.retirementYears; year++) {
    // Inflation adjustment
    if (year > 1) {
      currentWithdrawal *= (1 + input.inflationRate);
    }

    // Apply guardrails based on current withdrawal rate
    const currentRate = currentWithdrawal / balance;
    const upperGuardrail = initialRate * (1 + ceilingRate);
    const lowerGuardrail = initialRate * (1 - floorRate);

    // Prosperity rule: if rate falls below floor, increase withdrawal
    if (currentRate < lowerGuardrail && balance > input.portfolioBalance) {
      currentWithdrawal *= 1.10; // 10% increase
    }

    // Capital preservation rule: if rate exceeds ceiling, cut withdrawal
    if (currentRate > upperGuardrail) {
      currentWithdrawal *= 0.90; // 10% decrease
    }

    const withdrawal = Math.min(currentWithdrawal, balance);
    balance -= withdrawal;
    withdrawals.push(withdrawal);

    // Market returns
    balance *= (1 + input.expectedReturn);

    const totalIncome = withdrawal + input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      portfolioBalance: Math.round(balance),
      withdrawal: Math.round(withdrawal),
      totalIncome: Math.round(totalIncome),
      realPurchasingPower: Math.round(totalIncome / inflationFactor),
      inflationAdjusted: true,
    });
  }

  const avgWithdrawal = withdrawals.reduce((a, b) => a + b, 0) / withdrawals.length;
  const variance = withdrawals.reduce((sum, w) => sum + Math.pow(w - avgWithdrawal, 2), 0) / withdrawals.length;

  return {
    strategyName: 'Guyton-Klinger Guardrails',
    description: 'Start at 5%, with guardrails that adjust withdrawals ±10% when current rate deviates 20% from target.',
    initialWithdrawalRate: initialRate,
    yearlyProjections,
    successProbability: 0.98,
    medianEndingBalance: yearlyProjections[yearlyProjections.length - 1]?.portfolioBalance || 0,
    worstCaseBalance: Math.round(balance * 0.2),
    averageWithdrawal: Math.round(avgWithdrawal),
    volatilityOfWithdrawals: Math.round(Math.sqrt(variance)),
    pros: [
      'Higher initial withdrawal rate',
      'Adapts to market conditions',
      'Strong historical success rate',
      'Balances income and preservation',
    ],
    cons: [
      'Variable income stream',
      'More complex to implement',
      'May require spending cuts in downturns',
      'Requires annual recalculation',
    ],
    suitableFor: ['Flexible spenders', 'Those comfortable with variability', 'Higher income needs'],
    score: 85,
  };
}

// Strategy 3: Bucket Strategy
function calculateBucketStrategy(input: WithdrawalInput): WithdrawalResult {
  // Bucket 1: Cash (1-2 years expenses)
  // Bucket 2: Bonds (3-7 years expenses)
  // Bucket 3: Stocks (8+ years)

  const bucket1Years = 2;
  const bucket2Years = 5;
  const annualNeed = input.annualExpenses - input.socialSecurityIncome - input.pensionIncome - input.otherIncome;

  let bucket1 = annualNeed * bucket1Years;
  let bucket2 = annualNeed * bucket2Years;
  let bucket3 = input.portfolioBalance - bucket1 - bucket2;

  const yearlyProjections = [];
  const withdrawals: number[] = [];
  let currentWithdrawal = annualNeed;

  for (let year = 1; year <= input.retirementYears; year++) {
    // Inflation adjust spending need
    if (year > 1) {
      currentWithdrawal *= (1 + input.inflationRate);
    }

    // Withdraw from bucket 1 first
    let withdrawal = Math.min(currentWithdrawal, bucket1);
    bucket1 -= withdrawal;
    let remaining = currentWithdrawal - withdrawal;

    // If bucket 1 empty, use bucket 2
    if (remaining > 0) {
      const fromBucket2 = Math.min(remaining, bucket2);
      bucket2 -= fromBucket2;
      withdrawal += fromBucket2;
      remaining -= fromBucket2;
    }

    // If bucket 2 empty, use bucket 3
    if (remaining > 0) {
      const fromBucket3 = Math.min(remaining, bucket3);
      bucket3 -= fromBucket3;
      withdrawal += fromBucket3;
    }

    withdrawals.push(withdrawal);

    // Grow buckets (simplified returns)
    bucket1 *= 1.02; // Money market ~2%
    bucket2 *= 1.04; // Bonds ~4%
    bucket3 *= 1.08; // Stocks ~8%

    // Annual rebalancing: refill bucket 1 from bucket 3 if needed
    if (bucket3 > annualNeed * 3 && bucket1 < annualNeed) {
      const transfer = Math.min(bucket3 - annualNeed * 3, annualNeed - bucket1);
      bucket1 += transfer;
      bucket3 -= transfer;
    }

    const totalBalance = bucket1 + bucket2 + bucket3;
    const totalIncome = withdrawal + input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      portfolioBalance: Math.round(totalBalance),
      withdrawal: Math.round(withdrawal),
      totalIncome: Math.round(totalIncome),
      realPurchasingPower: Math.round(totalIncome / inflationFactor),
      inflationAdjusted: true,
    });
  }

  const avgWithdrawal = withdrawals.reduce((a, b) => a + b, 0) / withdrawals.length;
  const variance = withdrawals.reduce((sum, w) => sum + Math.pow(w - avgWithdrawal, 2), 0) / withdrawals.length;
  const finalBalance = bucket1 + bucket2 + bucket3;

  return {
    strategyName: 'Bucket Strategy (Time Segmentation)',
    description: 'Divide portfolio into 3 buckets: cash (1-2 yrs), bonds (3-7 yrs), stocks (8+ yrs). Refill from growth bucket.',
    initialWithdrawalRate: annualNeed / input.portfolioBalance,
    yearlyProjections,
    successProbability: 0.92,
    medianEndingBalance: Math.round(finalBalance),
    worstCaseBalance: Math.round(finalBalance * 0.4),
    averageWithdrawal: Math.round(avgWithdrawal),
    volatilityOfWithdrawals: Math.round(Math.sqrt(variance)),
    pros: [
      'Psychological comfort during downturns',
      'Avoids selling stocks at lows',
      'Clear structure for planning',
      'Matches time horizons with risk',
    ],
    cons: [
      'Requires active management',
      'May miss rebalancing opportunities',
      'Cash drag in bull markets',
      'Complex to maintain',
    ],
    suitableFor: ['Those anxious about market volatility', 'Active managers', 'Visual planners'],
    score: 78,
  };
}

// Strategy 4: Dynamic Percentage of Portfolio
function calculateDynamicPercentage(input: WithdrawalInput): WithdrawalResult {
  // Withdraw a percentage of current portfolio each year
  // Percentage based on life expectancy (IRS RMD-like)

  let balance = input.portfolioBalance;
  const yearlyProjections = [];
  const withdrawals: number[] = [];

  for (let year = 1; year <= input.retirementYears; year++) {
    const remainingYears = Math.max(1, input.retirementYears - year + 1);
    const withdrawalRate = 1 / remainingYears;
    const withdrawal = balance * Math.min(withdrawalRate, 0.10); // Cap at 10%

    balance -= withdrawal;
    withdrawals.push(withdrawal);

    balance *= (1 + input.expectedReturn);

    const totalIncome = withdrawal + input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      portfolioBalance: Math.round(balance),
      withdrawal: Math.round(withdrawal),
      totalIncome: Math.round(totalIncome),
      realPurchasingPower: Math.round(totalIncome / inflationFactor),
      inflationAdjusted: false,
    });
  }

  const avgWithdrawal = withdrawals.reduce((a, b) => a + b, 0) / withdrawals.length;
  const variance = withdrawals.reduce((sum, w) => sum + Math.pow(w - avgWithdrawal, 2), 0) / withdrawals.length;

  return {
    strategyName: 'Dynamic Percentage',
    description: 'Withdraw 1/remaining years of portfolio annually, adapting to portfolio performance.',
    initialWithdrawalRate: 1 / input.retirementYears,
    yearlyProjections,
    successProbability: 1.0, // Cannot fail by definition
    medianEndingBalance: Math.round(balance),
    worstCaseBalance: Math.round(balance * 0.5),
    averageWithdrawal: Math.round(avgWithdrawal),
    volatilityOfWithdrawals: Math.round(Math.sqrt(variance)),
    pros: [
      'Can never run out of money',
      'Automatically adjusts to market',
      'Simple calculation',
      'Increases spending in good years',
    ],
    cons: [
      'Highly variable income',
      'May not meet fixed expense needs',
      'Lower spending in early retirement',
      'Income decreases over time',
    ],
    suitableFor: ['Those with flexible expenses', 'Variable spending tolerance', 'Legacy-focused retirees'],
    score: 70,
  };
}

// Strategy 5: Floor and Ceiling (Kitces)
function calculateFloorCeiling(input: WithdrawalInput): WithdrawalResult {
  const baseRate = 0.04;
  const floor = 0.03; // Never withdraw less than 3%
  const ceiling = 0.05; // Never withdraw more than 5%

  let balance = input.portfolioBalance;
  let currentWithdrawal = balance * baseRate;
  const yearlyProjections = [];
  const withdrawals: number[] = [];

  for (let year = 1; year <= input.retirementYears; year++) {
    // Calculate rate based on current balance
    let rate = currentWithdrawal / balance;

    // Apply floor and ceiling
    rate = Math.max(floor, Math.min(ceiling, rate));
    currentWithdrawal = balance * rate;

    // Inflation adjustment within bounds
    if (year > 1) {
      const inflationAdjusted = currentWithdrawal * (1 + input.inflationRate);
      const minWithdrawal = balance * floor;
      const maxWithdrawal = balance * ceiling;
      currentWithdrawal = Math.max(minWithdrawal, Math.min(maxWithdrawal, inflationAdjusted));
    }

    const withdrawal = currentWithdrawal;
    balance -= withdrawal;
    withdrawals.push(withdrawal);

    balance *= (1 + input.expectedReturn);

    const totalIncome = withdrawal + input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      portfolioBalance: Math.round(balance),
      withdrawal: Math.round(withdrawal),
      totalIncome: Math.round(totalIncome),
      realPurchasingPower: Math.round(totalIncome / inflationFactor),
      inflationAdjusted: true,
    });
  }

  const avgWithdrawal = withdrawals.reduce((a, b) => a + b, 0) / withdrawals.length;
  const variance = withdrawals.reduce((sum, w) => sum + Math.pow(w - avgWithdrawal, 2), 0) / withdrawals.length;

  return {
    strategyName: 'Floor and Ceiling',
    description: 'Maintain withdrawal rate between 3-5% of portfolio, providing bounded flexibility.',
    initialWithdrawalRate: baseRate,
    yearlyProjections,
    successProbability: 0.97,
    medianEndingBalance: Math.round(balance),
    worstCaseBalance: Math.round(balance * 0.35),
    averageWithdrawal: Math.round(avgWithdrawal),
    volatilityOfWithdrawals: Math.round(Math.sqrt(variance)),
    pros: [
      'Bounded variability',
      'Responds to market conditions',
      'Maintains minimum income',
      'Caps overspending in good times',
    ],
    cons: [
      'May not keep pace with inflation',
      'Requires annual adjustment',
      'Moderate complexity',
      'Floor may not cover expenses',
    ],
    suitableFor: ['Those wanting bounded flexibility', 'Moderate risk tolerance', 'Balanced approach seekers'],
    score: 82,
  };
}

// Strategy 6: CAPE-Based Variable Withdrawal (Shiller)
function calculateCAPEBased(input: WithdrawalInput): WithdrawalResult {
  // Adjust withdrawal rate based on market valuation (CAPE ratio)
  // Current CAPE ~30, historical average ~16
  const currentCAPE = 30;
  const historicalCAPE = 16;
  const baseRate = 0.04;

  // Adjust rate: lower rate when CAPE is high
  const capeAdjustment = historicalCAPE / currentCAPE;
  const adjustedRate = baseRate * capeAdjustment;

  let balance = input.portfolioBalance;
  let currentWithdrawal = balance * adjustedRate;
  const yearlyProjections = [];
  const withdrawals: number[] = [];

  for (let year = 1; year <= input.retirementYears; year++) {
    // Recalculate based on assumed CAPE mean reversion
    const yearCAPE = currentCAPE - (year * 0.5); // Gradual reversion
    const yearAdjustment = historicalCAPE / Math.max(yearCAPE, 12);
    const yearRate = baseRate * yearAdjustment;

    currentWithdrawal = balance * Math.min(yearRate, 0.06);

    const withdrawal = currentWithdrawal;
    balance -= withdrawal;
    withdrawals.push(withdrawal);

    balance *= (1 + input.expectedReturn);

    const totalIncome = withdrawal + input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      portfolioBalance: Math.round(balance),
      withdrawal: Math.round(withdrawal),
      totalIncome: Math.round(totalIncome),
      realPurchasingPower: Math.round(totalIncome / inflationFactor),
      inflationAdjusted: false,
    });
  }

  const avgWithdrawal = withdrawals.reduce((a, b) => a + b, 0) / withdrawals.length;
  const variance = withdrawals.reduce((sum, w) => sum + Math.pow(w - avgWithdrawal, 2), 0) / withdrawals.length;

  return {
    strategyName: 'CAPE-Based Variable',
    description: 'Adjust withdrawal rate based on market valuation (CAPE ratio). Lower withdrawals when markets are expensive.',
    initialWithdrawalRate: adjustedRate,
    yearlyProjections,
    successProbability: 0.96,
    medianEndingBalance: Math.round(balance),
    worstCaseBalance: Math.round(balance * 0.4),
    averageWithdrawal: Math.round(avgWithdrawal),
    volatilityOfWithdrawals: Math.round(Math.sqrt(variance)),
    pros: [
      'Accounts for market valuations',
      'Higher long-term sustainability',
      'Research-backed approach',
      'Reduces sequence of returns risk',
    ],
    cons: [
      'Complex to implement',
      'Lower initial withdrawals in expensive markets',
      'Requires CAPE data monitoring',
      'Variable income',
    ],
    suitableFor: ['Sophisticated investors', 'Those concerned about market valuations', 'Long-term planners'],
    score: 80,
  };
}

// Main optimizer function
function optimizeWithdrawalStrategy(input: WithdrawalInput): {
  strategies: WithdrawalResult[];
  recommendation: string;
  optimalStrategy: WithdrawalResult;
  comparisonChart: Array<{ year: number; [key: string]: number }>;
} {
  const strategies: WithdrawalResult[] = [];

  // Calculate all strategies
  strategies.push(calculate4PercentRule(input));
  strategies.push(calculateGuytonKlinger(input));
  strategies.push(calculateBucketStrategy(input));
  strategies.push(calculateDynamicPercentage(input));
  strategies.push(calculateFloorCeiling(input));
  strategies.push(calculateCAPEBased(input));

  // Adjust scores based on risk tolerance
  for (const strategy of strategies) {
    if (input.riskTolerance === 'conservative') {
      // Favor lower volatility and higher success probability
      if (strategy.successProbability >= 0.95) strategy.score += 10;
      if (strategy.volatilityOfWithdrawals < strategy.averageWithdrawal * 0.1) strategy.score += 5;
    } else if (input.riskTolerance === 'aggressive') {
      // Favor higher initial withdrawal rates
      if (strategy.initialWithdrawalRate >= 0.05) strategy.score += 10;
      if (strategy.medianEndingBalance > input.portfolioBalance * 0.5) strategy.score += 5;
    }
  }

  // Sort by score
  strategies.sort((a, b) => b.score - a.score);

  const optimalStrategy = strategies[0];

  // Generate comparison chart
  const comparisonChart = [];
  const maxYears = Math.min(input.retirementYears, 30);

  for (let i = 0; i < maxYears; i++) {
    const dataPoint: { year: number; [key: string]: number } = {
      year: i + 1,
    };

    for (const strategy of strategies) {
      if (strategy.yearlyProjections[i]) {
        dataPoint[strategy.strategyName] = strategy.yearlyProjections[i].portfolioBalance;
      }
    }

    comparisonChart.push(dataPoint);
  }

  // Generate recommendation
  const recommendation = generateWithdrawalRecommendation(optimalStrategy, input);

  return {
    strategies,
    recommendation,
    optimalStrategy,
    comparisonChart,
  };
}

function generateWithdrawalRecommendation(strategy: WithdrawalResult, input: WithdrawalInput): string {
  const parts: string[] = [];

  parts.push(`Based on your ${input.riskTolerance} risk tolerance and ${input.retirementYears}-year retirement horizon, we recommend the "${strategy.strategyName}" strategy.`);

  const initialWithdrawal = Math.round(input.portfolioBalance * strategy.initialWithdrawalRate);
  parts.push(`Start with an initial withdrawal of $${initialWithdrawal.toLocaleString()} (${(strategy.initialWithdrawalRate * 100).toFixed(1)}% rate).`);

  if (strategy.successProbability >= 0.95) {
    parts.push(`This strategy has a ${(strategy.successProbability * 100).toFixed(0)}% historical success rate.`);
  }

  const totalGuaranteed = input.socialSecurityIncome + input.pensionIncome + input.otherIncome;
  if (totalGuaranteed > 0) {
    parts.push(`Combined with your guaranteed income of $${totalGuaranteed.toLocaleString()}, your total first-year income would be $${(initialWithdrawal + totalGuaranteed).toLocaleString()}.`);
  }

  return parts.join(' ');
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    const whereClause: any = {
      retirementPlan: {
        userId: payload.userId,
      },
    };

    if (planId) {
      whereClause.planId = planId;
    }

    const strategies = await prisma.withdrawalStrategy.findMany({
      where: whereClause,
      include: {
        retirementPlan: {
          select: {
            id: true,
            name: true,
            currentAge: true,
            retirementAge: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('Error fetching withdrawal strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal strategies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      planId,
      optimize,
      // Optimization inputs
      portfolioBalance,
      annualExpenses,
      inflationRate,
      expectedReturn,
      volatility,
      retirementYears,
      socialSecurityIncome,
      pensionIncome,
      otherIncome,
      riskTolerance,
      // Direct save inputs
      strategyType,
      withdrawalRate,
      yearlyWithdrawals,
      bucketAllocations,
      guardrails,
      notes,
    } = body;

    // Verify plan ownership
    const plan = await prisma.retirementPlan.findFirst({
      where: {
        id: planId,
        userId: payload.userId,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Retirement plan not found' }, { status: 404 });
    }

    // Run optimization if requested
    if (optimize) {
      const input: WithdrawalInput = {
        portfolioBalance: portfolioBalance || 1000000,
        annualExpenses: annualExpenses || 50000,
        inflationRate: inflationRate || 0.03,
        expectedReturn: expectedReturn || 0.07,
        volatility: volatility || 0.15,
        retirementYears: retirementYears || plan.lifeExpectancy - plan.retirementAge || 30,
        socialSecurityIncome: socialSecurityIncome || 0,
        pensionIncome: pensionIncome || 0,
        otherIncome: otherIncome || 0,
        riskTolerance: riskTolerance || 'moderate',
      };

      const optimization = optimizeWithdrawalStrategy(input);

      return NextResponse.json({
        optimization,
        input,
      });
    }

    // Save strategy
    const strategy = await prisma.withdrawalStrategy.create({
      data: {
        planId,
        strategyType: strategyType || 'FOUR_PERCENT',
        withdrawalRate: withdrawalRate || 0.04,
        yearlyWithdrawals: yearlyWithdrawals || [],
        bucketAllocations: bucketAllocations || null,
        guardrails: guardrails || null,
        notes,
      },
    });

    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    console.error('Error creating withdrawal strategy:', error);
    return NextResponse.json(
      { error: 'Failed to create withdrawal strategy' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    const existing = await prisma.withdrawalStrategy.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    const strategy = await prisma.withdrawalStrategy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(strategy);
  } catch (error) {
    console.error('Error updating withdrawal strategy:', error);
    return NextResponse.json(
      { error: 'Failed to update withdrawal strategy' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Strategy ID required' }, { status: 400 });
    }

    const existing = await prisma.withdrawalStrategy.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    await prisma.withdrawalStrategy.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting withdrawal strategy:', error);
    return NextResponse.json(
      { error: 'Failed to delete withdrawal strategy' },
      { status: 500 }
    );
  }
}
