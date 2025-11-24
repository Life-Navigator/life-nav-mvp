import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// 2024 Tax Brackets (Married Filing Jointly)
const TAX_BRACKETS_MFJ_2024 = [
  { min: 0, max: 23200, rate: 0.10 },
  { min: 23200, max: 94300, rate: 0.12 },
  { min: 94300, max: 201050, rate: 0.22 },
  { min: 201050, max: 383900, rate: 0.24 },
  { min: 383900, max: 487450, rate: 0.32 },
  { min: 487450, max: 731200, rate: 0.35 },
  { min: 731200, max: Infinity, rate: 0.37 },
];

// 2024 Tax Brackets (Single)
const TAX_BRACKETS_SINGLE_2024 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

// IRMAA (Income-Related Monthly Adjustment Amount) thresholds for Medicare Part B
const IRMAA_THRESHOLDS_2024 = {
  single: [
    { income: 103000, partBPremium: 174.70, partDPremium: 0 },
    { income: 129000, partBPremium: 244.60, partDPremium: 12.90 },
    { income: 161000, partBPremium: 349.40, partDPremium: 33.30 },
    { income: 193000, partBPremium: 454.20, partDPremium: 53.80 },
    { income: 500000, partBPremium: 559.00, partDPremium: 74.20 },
    { income: Infinity, partBPremium: 594.00, partDPremium: 81.00 },
  ],
  married: [
    { income: 206000, partBPremium: 174.70, partDPremium: 0 },
    { income: 258000, partBPremium: 244.60, partDPremium: 12.90 },
    { income: 322000, partBPremium: 349.40, partDPremium: 33.30 },
    { income: 386000, partBPremium: 454.20, partDPremium: 53.80 },
    { income: 750000, partBPremium: 559.00, partDPremium: 74.20 },
    { income: Infinity, partBPremium: 594.00, partDPremium: 81.00 },
  ],
};

interface ConversionInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  traditionalIRABalance: number;
  rothIRABalance: number;
  currentTaxableIncome: number;
  expectedRetirementIncome: number;
  filingStatus: 'single' | 'married';
  stateIncomeTaxRate: number;
  expectedReturn: number;
  inflationRate: number;
}

interface ConversionYear {
  year: number;
  age: number;
  conversionAmount: number;
  taxOnConversion: number;
  marginalRate: number;
  traditionalBalance: number;
  rothBalance: number;
  netBenefit: number;
  irmaaImpact: number;
  cumulativeTaxSaved: number;
}

interface ConversionStrategy {
  name: string;
  description: string;
  totalConversions: number;
  totalTaxPaid: number;
  endingRothBalance: number;
  endingTraditionalBalance: number;
  lifetimeTaxSavings: number;
  yearlyPlan: ConversionYear[];
  pros: string[];
  cons: string[];
  score: number;
}

// Calculate federal tax on income
function calculateFederalTax(
  income: number,
  filingStatus: 'single' | 'married'
): { tax: number; marginalRate: number; effectiveRate: number } {
  const brackets = filingStatus === 'married' ? TAX_BRACKETS_MFJ_2024 : TAX_BRACKETS_SINGLE_2024;

  let tax = 0;
  let marginalRate = 0;

  for (const bracket of brackets) {
    if (income > bracket.min) {
      const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
      tax += taxableInBracket * bracket.rate;
      marginalRate = bracket.rate;
    }
  }

  return {
    tax,
    marginalRate,
    effectiveRate: income > 0 ? tax / income : 0,
  };
}

// Calculate the bracket space available for conversions
function calculateBracketSpace(
  currentIncome: number,
  targetBracket: number,
  filingStatus: 'single' | 'married'
): number {
  const brackets = filingStatus === 'married' ? TAX_BRACKETS_MFJ_2024 : TAX_BRACKETS_SINGLE_2024;

  // Find the target bracket
  const targetBracketInfo = brackets.find(b => b.rate >= targetBracket);
  if (!targetBracketInfo) return 0;

  // Calculate space to top of target bracket
  if (currentIncome >= targetBracketInfo.max) return 0;

  return Math.max(0, targetBracketInfo.max - Math.max(currentIncome, targetBracketInfo.min));
}

// Calculate IRMAA impact
function calculateIRMAAImpact(
  magi: number,
  filingStatus: 'single' | 'married'
): number {
  const thresholds = filingStatus === 'married' ? IRMAA_THRESHOLDS_2024.married : IRMAA_THRESHOLDS_2024.single;

  // Find current IRMAA tier
  let currentTier = thresholds.find(t => magi <= t.income) || thresholds[thresholds.length - 1];

  // Base premium (no IRMAA)
  const basePremium = 174.70;

  // Annual IRMAA cost (Part B + Part D) * 12 months
  const irmaaAnnual = ((currentTier.partBPremium - basePremium) + currentTier.partDPremium) * 12;

  return irmaaAnnual;
}

// Main Roth conversion optimizer
function optimizeRothConversions(input: ConversionInput): {
  strategies: ConversionStrategy[];
  recommendation: string;
  optimalStrategy: ConversionStrategy;
} {
  const strategies: ConversionStrategy[] = [];

  const yearsToRetirement = input.retirementAge - input.currentAge;
  const yearsInRetirement = input.lifeExpectancy - input.retirementAge;

  // Strategy 1: No Conversion (Baseline)
  const noConversionStrategy = simulateNoConversion(input, yearsToRetirement, yearsInRetirement);
  strategies.push(noConversionStrategy);

  // Strategy 2: Fill to Top of 12% Bracket
  const fill12Strategy = simulateBracketFillStrategy(input, yearsToRetirement, yearsInRetirement, 0.12);
  strategies.push(fill12Strategy);

  // Strategy 3: Fill to Top of 22% Bracket
  const fill22Strategy = simulateBracketFillStrategy(input, yearsToRetirement, yearsInRetirement, 0.22);
  strategies.push(fill22Strategy);

  // Strategy 4: Fill to Top of 24% Bracket
  const fill24Strategy = simulateBracketFillStrategy(input, yearsToRetirement, yearsInRetirement, 0.24);
  strategies.push(fill24Strategy);

  // Strategy 5: Aggressive (Maximize Conversions)
  const aggressiveStrategy = simulateAggressiveConversion(input, yearsToRetirement, yearsInRetirement);
  strategies.push(aggressiveStrategy);

  // Strategy 6: IRMAA-Aware (Stay below Medicare thresholds)
  const irmaaAwareStrategy = simulateIRMAAAwareStrategy(input, yearsToRetirement, yearsInRetirement);
  strategies.push(irmaaAwareStrategy);

  // Strategy 7: Smooth (Equal conversions each year)
  const smoothStrategy = simulateSmoothConversion(input, yearsToRetirement, yearsInRetirement);
  strategies.push(smoothStrategy);

  // Calculate scores for each strategy
  for (const strategy of strategies) {
    strategy.score = calculateStrategyScore(strategy, input);
  }

  // Sort by score descending
  strategies.sort((a, b) => b.score - a.score);

  const optimalStrategy = strategies[0];

  // Generate recommendation
  const recommendation = generateRecommendation(optimalStrategy, input);

  return {
    strategies,
    recommendation,
    optimalStrategy,
  };
}

function simulateNoConversion(
  input: ConversionInput,
  yearsToRetirement: number,
  yearsInRetirement: number
): ConversionStrategy {
  let traditionalBalance = input.traditionalIRABalance;
  let rothBalance = input.rothIRABalance;
  const yearlyPlan: ConversionYear[] = [];

  // Grow balances until retirement
  for (let year = 0; year < yearsToRetirement; year++) {
    traditionalBalance *= (1 + input.expectedReturn);
    rothBalance *= (1 + input.expectedReturn);

    yearlyPlan.push({
      year: year + 1,
      age: input.currentAge + year + 1,
      conversionAmount: 0,
      taxOnConversion: 0,
      marginalRate: 0,
      traditionalBalance: Math.round(traditionalBalance),
      rothBalance: Math.round(rothBalance),
      netBenefit: 0,
      irmaaImpact: 0,
      cumulativeTaxSaved: 0,
    });
  }

  // Calculate lifetime tax in retirement
  let lifetimeTaxInRetirement = 0;
  for (let year = 0; year < yearsInRetirement; year++) {
    const withdrawal = traditionalBalance / (yearsInRetirement - year);
    const { tax } = calculateFederalTax(
      input.expectedRetirementIncome + withdrawal,
      input.filingStatus
    );
    lifetimeTaxInRetirement += tax * input.stateIncomeTaxRate;
    traditionalBalance -= withdrawal;
    traditionalBalance *= (1 + input.expectedReturn);
  }

  return {
    name: 'No Conversion',
    description: 'Keep all funds in traditional accounts and pay taxes on withdrawals in retirement.',
    totalConversions: 0,
    totalTaxPaid: Math.round(lifetimeTaxInRetirement),
    endingRothBalance: Math.round(rothBalance),
    endingTraditionalBalance: Math.round(traditionalBalance),
    lifetimeTaxSavings: 0,
    yearlyPlan,
    pros: ['No immediate tax cost', 'Simple strategy'],
    cons: ['Larger RMDs', 'Higher taxes in retirement', 'Less flexibility'],
    score: 0,
  };
}

function simulateBracketFillStrategy(
  input: ConversionInput,
  yearsToRetirement: number,
  yearsInRetirement: number,
  targetBracket: number
): ConversionStrategy {
  let traditionalBalance = input.traditionalIRABalance;
  let rothBalance = input.rothIRABalance;
  const yearlyPlan: ConversionYear[] = [];
  let totalTaxPaid = 0;
  let totalConversions = 0;
  let cumulativeTaxSaved = 0;

  // Convert during working years
  for (let year = 0; year < yearsToRetirement; year++) {
    const bracketSpace = calculateBracketSpace(
      input.currentTaxableIncome,
      targetBracket,
      input.filingStatus
    );

    const conversionAmount = Math.min(bracketSpace, traditionalBalance);
    const { tax, marginalRate } = calculateFederalTax(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    const taxOnConversion = conversionAmount * (marginalRate + input.stateIncomeTaxRate);
    const irmaaImpact = calculateIRMAAImpact(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    traditionalBalance -= conversionAmount;
    rothBalance += conversionAmount;

    // Grow remaining balances
    traditionalBalance *= (1 + input.expectedReturn);
    rothBalance *= (1 + input.expectedReturn);

    totalTaxPaid += taxOnConversion;
    totalConversions += conversionAmount;

    yearlyPlan.push({
      year: year + 1,
      age: input.currentAge + year + 1,
      conversionAmount: Math.round(conversionAmount),
      taxOnConversion: Math.round(taxOnConversion),
      marginalRate,
      traditionalBalance: Math.round(traditionalBalance),
      rothBalance: Math.round(rothBalance),
      netBenefit: 0,
      irmaaImpact: Math.round(irmaaImpact),
      cumulativeTaxSaved,
    });
  }

  return {
    name: `Fill to ${targetBracket * 100}% Bracket`,
    description: `Convert enough each year to fill up to the top of the ${targetBracket * 100}% tax bracket.`,
    totalConversions: Math.round(totalConversions),
    totalTaxPaid: Math.round(totalTaxPaid),
    endingRothBalance: Math.round(rothBalance),
    endingTraditionalBalance: Math.round(traditionalBalance),
    lifetimeTaxSavings: 0, // Calculated later
    yearlyPlan,
    pros: [
      'Tax-efficient conversion timing',
      'Reduces future RMDs',
      'Creates tax-free income in retirement',
    ],
    cons: [
      'Requires available cash for tax payments',
      'May trigger IRMAA if near Medicare',
    ],
    score: 0,
  };
}

function simulateAggressiveConversion(
  input: ConversionInput,
  yearsToRetirement: number,
  yearsInRetirement: number
): ConversionStrategy {
  let traditionalBalance = input.traditionalIRABalance;
  let rothBalance = input.rothIRABalance;
  const yearlyPlan: ConversionYear[] = [];
  let totalTaxPaid = 0;
  let totalConversions = 0;

  // Convert everything as fast as possible (fill to top of 32% bracket)
  for (let year = 0; year < yearsToRetirement; year++) {
    const bracketSpace = calculateBracketSpace(
      input.currentTaxableIncome,
      0.32,
      input.filingStatus
    );

    const conversionAmount = Math.min(bracketSpace, traditionalBalance);
    const { marginalRate } = calculateFederalTax(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    const taxOnConversion = conversionAmount * (marginalRate + input.stateIncomeTaxRate);
    const irmaaImpact = calculateIRMAAImpact(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    traditionalBalance -= conversionAmount;
    rothBalance += conversionAmount;

    traditionalBalance *= (1 + input.expectedReturn);
    rothBalance *= (1 + input.expectedReturn);

    totalTaxPaid += taxOnConversion;
    totalConversions += conversionAmount;

    yearlyPlan.push({
      year: year + 1,
      age: input.currentAge + year + 1,
      conversionAmount: Math.round(conversionAmount),
      taxOnConversion: Math.round(taxOnConversion),
      marginalRate,
      traditionalBalance: Math.round(traditionalBalance),
      rothBalance: Math.round(rothBalance),
      netBenefit: 0,
      irmaaImpact: Math.round(irmaaImpact),
      cumulativeTaxSaved: 0,
    });
  }

  return {
    name: 'Aggressive Conversion',
    description: 'Convert as much as possible while staying below the 35% bracket.',
    totalConversions: Math.round(totalConversions),
    totalTaxPaid: Math.round(totalTaxPaid),
    endingRothBalance: Math.round(rothBalance),
    endingTraditionalBalance: Math.round(traditionalBalance),
    lifetimeTaxSavings: 0,
    yearlyPlan,
    pros: [
      'Maximizes Roth balance',
      'Eliminates future RMDs',
      'Best for rising tax environments',
    ],
    cons: [
      'High immediate tax cost',
      'May trigger IRMAA',
      'Requires significant liquidity',
    ],
    score: 0,
  };
}

function simulateIRMAAAwareStrategy(
  input: ConversionInput,
  yearsToRetirement: number,
  yearsInRetirement: number
): ConversionStrategy {
  let traditionalBalance = input.traditionalIRABalance;
  let rothBalance = input.rothIRABalance;
  const yearlyPlan: ConversionYear[] = [];
  let totalTaxPaid = 0;
  let totalConversions = 0;

  // Stay below first IRMAA threshold
  const irmaaThreshold = input.filingStatus === 'married' ? 206000 : 103000;

  for (let year = 0; year < yearsToRetirement; year++) {
    const roomToIrmaa = Math.max(0, irmaaThreshold - input.currentTaxableIncome);
    const conversionAmount = Math.min(roomToIrmaa, traditionalBalance);

    const { marginalRate } = calculateFederalTax(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    const taxOnConversion = conversionAmount * (marginalRate + input.stateIncomeTaxRate);

    traditionalBalance -= conversionAmount;
    rothBalance += conversionAmount;

    traditionalBalance *= (1 + input.expectedReturn);
    rothBalance *= (1 + input.expectedReturn);

    totalTaxPaid += taxOnConversion;
    totalConversions += conversionAmount;

    yearlyPlan.push({
      year: year + 1,
      age: input.currentAge + year + 1,
      conversionAmount: Math.round(conversionAmount),
      taxOnConversion: Math.round(taxOnConversion),
      marginalRate,
      traditionalBalance: Math.round(traditionalBalance),
      rothBalance: Math.round(rothBalance),
      netBenefit: 0,
      irmaaImpact: 0,
      cumulativeTaxSaved: 0,
    });
  }

  return {
    name: 'IRMAA-Aware',
    description: 'Convert while staying below Medicare IRMAA thresholds to avoid premium surcharges.',
    totalConversions: Math.round(totalConversions),
    totalTaxPaid: Math.round(totalTaxPaid),
    endingRothBalance: Math.round(rothBalance),
    endingTraditionalBalance: Math.round(traditionalBalance),
    lifetimeTaxSavings: 0,
    yearlyPlan,
    pros: [
      'Avoids IRMAA surcharges',
      'Balanced approach',
      'Good for those near Medicare',
    ],
    cons: [
      'May leave conversions on table',
      'Less aggressive than other strategies',
    ],
    score: 0,
  };
}

function simulateSmoothConversion(
  input: ConversionInput,
  yearsToRetirement: number,
  yearsInRetirement: number
): ConversionStrategy {
  let traditionalBalance = input.traditionalIRABalance;
  let rothBalance = input.rothIRABalance;
  const yearlyPlan: ConversionYear[] = [];
  let totalTaxPaid = 0;

  // Equal conversions each year
  const annualConversion = traditionalBalance / yearsToRetirement;
  let totalConversions = 0;

  for (let year = 0; year < yearsToRetirement; year++) {
    const conversionAmount = Math.min(annualConversion, traditionalBalance);

    const { marginalRate } = calculateFederalTax(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    const taxOnConversion = conversionAmount * (marginalRate + input.stateIncomeTaxRate);
    const irmaaImpact = calculateIRMAAImpact(
      input.currentTaxableIncome + conversionAmount,
      input.filingStatus
    );

    traditionalBalance -= conversionAmount;
    rothBalance += conversionAmount;

    traditionalBalance *= (1 + input.expectedReturn);
    rothBalance *= (1 + input.expectedReturn);

    totalTaxPaid += taxOnConversion;
    totalConversions += conversionAmount;

    yearlyPlan.push({
      year: year + 1,
      age: input.currentAge + year + 1,
      conversionAmount: Math.round(conversionAmount),
      taxOnConversion: Math.round(taxOnConversion),
      marginalRate,
      traditionalBalance: Math.round(traditionalBalance),
      rothBalance: Math.round(rothBalance),
      netBenefit: 0,
      irmaaImpact: Math.round(irmaaImpact),
      cumulativeTaxSaved: 0,
    });
  }

  return {
    name: 'Smooth Conversion',
    description: 'Convert equal amounts each year until retirement.',
    totalConversions: Math.round(totalConversions),
    totalTaxPaid: Math.round(totalTaxPaid),
    endingRothBalance: Math.round(rothBalance),
    endingTraditionalBalance: Math.round(traditionalBalance),
    lifetimeTaxSavings: 0,
    yearlyPlan,
    pros: [
      'Predictable tax liability',
      'Easy to plan',
      'Converts entire balance',
    ],
    cons: [
      'Not tax-bracket optimized',
      'May pay higher rates than needed',
    ],
    score: 0,
  };
}

function calculateStrategyScore(strategy: ConversionStrategy, input: ConversionInput): number {
  // Scoring factors (0-100 scale)
  let score = 0;

  // Higher ending Roth balance is better (up to 40 points)
  const rothRatio = strategy.endingRothBalance / (strategy.endingRothBalance + strategy.endingTraditionalBalance);
  score += rothRatio * 40;

  // Lower tax rate paid is better (up to 30 points)
  const avgTaxRate = strategy.totalConversions > 0
    ? strategy.totalTaxPaid / strategy.totalConversions
    : 0;
  score += (1 - Math.min(avgTaxRate, 0.35) / 0.35) * 30;

  // IRMAA avoidance bonus (up to 15 points)
  const totalIrmaa = strategy.yearlyPlan.reduce((sum, y) => sum + y.irmaaImpact, 0);
  score += totalIrmaa === 0 ? 15 : Math.max(0, 15 - totalIrmaa / 1000);

  // Flexibility bonus - having both account types (up to 15 points)
  const diversificationScore = Math.min(
    strategy.endingTraditionalBalance / strategy.endingRothBalance,
    strategy.endingRothBalance / strategy.endingTraditionalBalance,
    1
  );
  score += diversificationScore * 15;

  return Math.round(score);
}

function generateRecommendation(strategy: ConversionStrategy, input: ConversionInput): string {
  const recommendations: string[] = [];

  recommendations.push(`Based on your situation, we recommend the "${strategy.name}" strategy.`);

  if (strategy.totalConversions > 0) {
    const avgAnnual = strategy.totalConversions / strategy.yearlyPlan.length;
    recommendations.push(`Convert approximately $${avgAnnual.toLocaleString()} per year.`);
  }

  if (input.currentAge >= 62) {
    recommendations.push('Since you are close to Medicare age, watch IRMAA thresholds carefully.');
  }

  if (input.traditionalIRABalance > 500000) {
    recommendations.push('With your large traditional balance, Roth conversions can significantly reduce future RMDs.');
  }

  return recommendations.join(' ');
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

    // Get Roth conversion plans for user
    const whereClause: any = {
      retirementPlan: {
        userId: payload.userId,
      },
    };

    if (planId) {
      whereClause.planId = planId;
    }

    const conversions = await prisma.rothConversionPlan.findMany({
      where: whereClause,
      include: {
        retirementPlan: {
          select: {
            id: true,
            name: true,
            currentAge: true,
            retirementAge: true,
            lifeExpectancy: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ conversions });
  } catch (error) {
    console.error('Error fetching Roth conversions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Roth conversions' },
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
      // Optimization parameters
      optimize,
      currentAge,
      retirementAge,
      lifeExpectancy,
      traditionalIRABalance,
      rothIRABalance,
      currentTaxableIncome,
      expectedRetirementIncome,
      filingStatus,
      stateIncomeTaxRate,
      expectedReturn,
      inflationRate,
      // Or direct save
      yearlyConversions,
      totalConversions,
      taxesPaid,
      projectedEndBalance,
      strategy,
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

    // If optimization is requested, run the optimizer
    if (optimize) {
      const input: ConversionInput = {
        currentAge: currentAge || plan.currentAge,
        retirementAge: retirementAge || plan.retirementAge,
        lifeExpectancy: lifeExpectancy || plan.lifeExpectancy || 90,
        traditionalIRABalance: traditionalIRABalance || 0,
        rothIRABalance: rothIRABalance || 0,
        currentTaxableIncome: currentTaxableIncome || 75000,
        expectedRetirementIncome: expectedRetirementIncome || 50000,
        filingStatus: filingStatus || 'married',
        stateIncomeTaxRate: stateIncomeTaxRate || 0.05,
        expectedReturn: expectedReturn || 0.07,
        inflationRate: inflationRate || 0.03,
      };

      const optimization = optimizeRothConversions(input);

      return NextResponse.json({
        optimization,
        input,
      });
    }

    // Otherwise, save the conversion plan
    const conversion = await prisma.rothConversionPlan.create({
      data: {
        planId,
        yearlyConversions: yearlyConversions || [],
        totalConversions: totalConversions || 0,
        taxesPaid: taxesPaid || 0,
        projectedEndBalance: projectedEndBalance || 0,
        strategy: strategy || 'BRACKET_FILLING',
        notes,
      },
    });

    return NextResponse.json(conversion, { status: 201 });
  } catch (error) {
    console.error('Error creating Roth conversion plan:', error);
    return NextResponse.json(
      { error: 'Failed to create Roth conversion plan' },
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

    // Verify ownership
    const existing = await prisma.rothConversionPlan.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversion plan not found' }, { status: 404 });
    }

    const conversion = await prisma.rothConversionPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(conversion);
  } catch (error) {
    console.error('Error updating Roth conversion plan:', error);
    return NextResponse.json(
      { error: 'Failed to update Roth conversion plan' },
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
      return NextResponse.json({ error: 'Conversion plan ID required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.rothConversionPlan.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversion plan not found' }, { status: 404 });
    }

    await prisma.rothConversionPlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Roth conversion plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete Roth conversion plan' },
      { status: 500 }
    );
  }
}
