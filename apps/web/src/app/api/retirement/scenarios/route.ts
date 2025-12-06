import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// Scenario types for what-if analysis
type ScenarioType =
  | 'EARLY_RETIREMENT'
  | 'DELAYED_RETIREMENT'
  | 'MARKET_CRASH'
  | 'HIGH_INFLATION'
  | 'HEALTHCARE_CRISIS'
  | 'LONGEVITY'
  | 'SPOUSE_DEATH'
  | 'INHERITANCE'
  | 'PART_TIME_WORK'
  | 'RELOCATION'
  | 'CUSTOM';

interface ScenarioInput {
  baselineData: {
    currentAge: number;
    retirementAge: number;
    lifeExpectancy: number;
    currentSavings: number;
    monthlyContributions: number;
    socialSecurityBenefit: number;
    ssClaimingAge: number;
    annualExpenses: number;
    expectedReturn: number;
    inflationRate: number;
  };
  scenarioType: ScenarioType;
  modifications?: {
    retirementAgeChange?: number;
    lifeExpectancyChange?: number;
    savingsChange?: number;
    expenseChange?: number;
    returnChange?: number;
    inflationChange?: number;
    ssChange?: number;
    oneTimeInflow?: number;
    oneTimeOutflow?: number;
  };
}

interface ScenarioResult {
  name: string;
  description: string;
  probability: number; // Likelihood of this scenario
  impactSeverity: 'low' | 'medium' | 'high' | 'critical';
  projections: Array<{
    year: number;
    age: number;
    balance: number;
    withdrawal: number;
    income: number;
    expenses: number;
    surplus: number;
  }>;
  keyMetrics: {
    successProbability: number;
    portfolioDepletion: number | null; // Age when depleted, null if not depleted
    legacyAmount: number;
    averageAnnualShortfall: number;
    yearsWithShortfall: number;
    retirementReadinessScore: number;
  };
  adjustmentsNeeded: string[];
  comparison: {
    baselineSuccess: number;
    scenarioSuccess: number;
    successDelta: number;
    baselineLegacy: number;
    scenarioLegacy: number;
    legacyDelta: number;
  };
}

// Run Monte Carlo simulation for a scenario
function runScenarioMonteCarlo(
  startingBalance: number,
  annualContributions: number,
  yearsToRetirement: number,
  yearsInRetirement: number,
  annualExpenses: number,
  socialSecurity: number,
  expectedReturn: number,
  volatility: number,
  inflationRate: number,
  runs: number = 1000
): {
  successRate: number;
  medianEndingBalance: number;
  p10Balance: number;
  p90Balance: number;
  depletionProbability: number;
  avgDepletionAge: number | null;
} {
  const results: { success: boolean; endingBalance: number; depletionAge: number | null }[] = [];

  for (let run = 0; run < runs; run++) {
    let balance = startingBalance;
    let depleted = false;
    let depletionAge: number | null = null;

    // Accumulation phase
    for (let year = 0; year < yearsToRetirement; year++) {
      // Random return using Box-Muller
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const yearReturn = expectedReturn + volatility * z;

      balance = balance * (1 + yearReturn) + annualContributions;
    }

    // Withdrawal phase
    let currentExpenses = annualExpenses;
    for (let year = 0; year < yearsInRetirement; year++) {
      // Inflation adjustment
      currentExpenses *= (1 + inflationRate);

      // Withdrawal
      const withdrawal = Math.max(0, currentExpenses - socialSecurity);
      balance -= withdrawal;

      if (balance <= 0 && !depleted) {
        depleted = true;
        depletionAge = yearsToRetirement + year + 1;
        balance = 0;
      }

      // Growth on remaining balance
      if (balance > 0) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const yearReturn = expectedReturn * 0.7 + volatility * 0.8 * z; // Lower return in retirement
        balance *= (1 + yearReturn);
      }
    }

    results.push({
      success: balance > 0,
      endingBalance: Math.max(0, balance),
      depletionAge,
    });
  }

  const successRate = results.filter(r => r.success).length / runs;
  const endingBalances = results.map(r => r.endingBalance).sort((a, b) => a - b);
  const depletionAges = results.filter(r => r.depletionAge !== null).map(r => r.depletionAge!);

  return {
    successRate,
    medianEndingBalance: endingBalances[Math.floor(runs / 2)],
    p10Balance: endingBalances[Math.floor(runs * 0.1)],
    p90Balance: endingBalances[Math.floor(runs * 0.9)],
    depletionProbability: 1 - successRate,
    avgDepletionAge: depletionAges.length > 0
      ? depletionAges.reduce((a, b) => a + b, 0) / depletionAges.length
      : null,
  };
}

// Generate scenario projections
function generateScenarioProjections(input: ScenarioInput): ScenarioResult {
  const { baselineData, scenarioType, modifications = {} } = input;

  // Apply modifications based on scenario type
  let modifiedData = { ...baselineData };
  let scenarioName = '';
  let scenarioDescription = '';
  let probability = 0;
  let impactSeverity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  const adjustmentsNeeded: string[] = [];

  switch (scenarioType) {
    case 'EARLY_RETIREMENT':
      modifiedData.retirementAge = baselineData.retirementAge - (modifications.retirementAgeChange || 5);
      scenarioName = 'Early Retirement';
      scenarioDescription = `Retire ${baselineData.retirementAge - modifiedData.retirementAge} years earlier at age ${modifiedData.retirementAge}`;
      probability = 0.25;
      impactSeverity = 'high';
      adjustmentsNeeded.push(
        'Increase savings rate by 15-20%',
        'Consider part-time work in early retirement',
        'Delay Social Security to maximize benefits'
      );
      break;

    case 'DELAYED_RETIREMENT':
      modifiedData.retirementAge = baselineData.retirementAge + (modifications.retirementAgeChange || 3);
      scenarioName = 'Delayed Retirement';
      scenarioDescription = `Retire ${modifiedData.retirementAge - baselineData.retirementAge} years later at age ${modifiedData.retirementAge}`;
      probability = 0.3;
      impactSeverity = 'low';
      adjustmentsNeeded.push(
        'Consider phased retirement options',
        'Update Social Security claiming strategy',
        'Review healthcare bridge options'
      );
      break;

    case 'MARKET_CRASH':
      modifiedData.currentSavings = baselineData.currentSavings * 0.6; // 40% drop
      modifiedData.expectedReturn = baselineData.expectedReturn - 0.02; // Lower expected returns
      scenarioName = 'Major Market Crash';
      scenarioDescription = '40% market decline in early retirement (sequence of returns risk)';
      probability = 0.15;
      impactSeverity = 'critical';
      adjustmentsNeeded.push(
        'Maintain 2-3 years of expenses in cash/bonds',
        'Implement guardrail withdrawal strategy',
        'Reduce discretionary spending by 15-20%',
        'Consider part-time work to bridge the gap'
      );
      break;

    case 'HIGH_INFLATION':
      modifiedData.inflationRate = baselineData.inflationRate + 0.03; // 3% higher inflation
      scenarioName = 'Sustained High Inflation';
      scenarioDescription = 'Inflation averages 3% higher than expected over retirement';
      probability = 0.2;
      impactSeverity = 'high';
      adjustmentsNeeded.push(
        'Increase TIPS allocation in portfolio',
        'Consider I-Bonds for inflation protection',
        'Hold some growth assets longer into retirement',
        'Review Social Security COLA expectations'
      );
      break;

    case 'HEALTHCARE_CRISIS':
      modifiedData.annualExpenses = baselineData.annualExpenses + 30000; // $30k additional healthcare
      scenarioName = 'Healthcare Crisis';
      scenarioDescription = 'Major health event requiring $30k+ additional annual healthcare costs';
      probability = 0.25;
      impactSeverity = 'critical';
      adjustmentsNeeded.push(
        'Ensure comprehensive Medicare coverage',
        'Build dedicated healthcare reserve ($100k+)',
        'Consider long-term care insurance',
        'Review HSA maximization strategy'
      );
      break;

    case 'LONGEVITY':
      modifiedData.lifeExpectancy = baselineData.lifeExpectancy + 10;
      scenarioName = 'Extended Longevity';
      scenarioDescription = `Living 10 years longer than expected (to age ${modifiedData.lifeExpectancy})`;
      probability = 0.25;
      impactSeverity = 'high';
      adjustmentsNeeded.push(
        'Consider longevity annuity (QLAC)',
        'Delay Social Security to age 70',
        'Reduce initial withdrawal rate to 3.5%',
        'Maintain growth allocation longer'
      );
      break;

    case 'SPOUSE_DEATH':
      modifiedData.annualExpenses = baselineData.annualExpenses * 0.75;
      modifiedData.socialSecurityBenefit = baselineData.socialSecurityBenefit * 0.67; // Survivor benefit
      scenarioName = 'Spouse Death';
      scenarioDescription = 'Loss of spouse affecting income and expenses';
      probability = 0.4;
      impactSeverity = 'high';
      adjustmentsNeeded.push(
        'Review survivor benefit strategy',
        'Update estate planning documents',
        'Consider life insurance needs',
        'Plan for single filing tax implications'
      );
      break;

    case 'INHERITANCE': {
      const inheritanceAmount = modifications.oneTimeInflow || 200000;
      modifiedData.currentSavings = baselineData.currentSavings + inheritanceAmount;
      scenarioName = 'Inheritance Received';
      scenarioDescription = `Receiving $${inheritanceAmount.toLocaleString()} inheritance`;
      probability = 0.3;
      impactSeverity = 'low';
      adjustmentsNeeded.push(
        'Tax-efficient investment of windfall',
        'Consider Roth conversions with additional funds',
        'Review estate planning for heirs',
        'Evaluate charitable giving strategies'
      );
      break;
    }

    case 'PART_TIME_WORK': {
      modifiedData.retirementAge = baselineData.retirementAge - 2;
      const partTimeIncome = 25000;
      scenarioName = 'Part-Time Work in Retirement';
      scenarioDescription = `Retiring 2 years early with $${partTimeIncome.toLocaleString()}/year part-time income for 5 years`;
      probability = 0.35;
      impactSeverity = 'low';
      adjustmentsNeeded.push(
        'Identify marketable skills for part-time work',
        'Consider consulting or freelance opportunities',
        'Plan Social Security earnings test impact',
        'Review healthcare coverage options'
      );
      break;
    }

    case 'RELOCATION':
      modifiedData.annualExpenses = baselineData.annualExpenses * 0.8; // 20% lower COL
      scenarioName = 'Retirement Relocation';
      scenarioDescription = 'Relocating to lower cost-of-living area (20% expense reduction)';
      probability = 0.25;
      impactSeverity = 'low';
      adjustmentsNeeded.push(
        'Research state tax implications',
        'Consider healthcare access in new location',
        'Factor in relocation costs',
        'Evaluate social/family proximity'
      );
      break;

    case 'CUSTOM':
      // Apply all provided modifications
      if (modifications.retirementAgeChange) {
        modifiedData.retirementAge += modifications.retirementAgeChange;
      }
      if (modifications.lifeExpectancyChange) {
        modifiedData.lifeExpectancy += modifications.lifeExpectancyChange;
      }
      if (modifications.savingsChange) {
        modifiedData.currentSavings += modifications.savingsChange;
      }
      if (modifications.expenseChange) {
        modifiedData.annualExpenses += modifications.expenseChange;
      }
      if (modifications.returnChange) {
        modifiedData.expectedReturn += modifications.returnChange;
      }
      if (modifications.inflationChange) {
        modifiedData.inflationRate += modifications.inflationChange;
      }
      if (modifications.ssChange) {
        modifiedData.socialSecurityBenefit += modifications.ssChange;
      }
      scenarioName = 'Custom Scenario';
      scenarioDescription = 'User-defined scenario modifications';
      probability = 0.5;
      impactSeverity = 'medium';
      break;
  }

  // Calculate baseline projection
  const yearsToRetirement = Math.max(0, baselineData.retirementAge - baselineData.currentAge);
  const yearsInRetirement = baselineData.lifeExpectancy - baselineData.retirementAge;

  const baselineSimulation = runScenarioMonteCarlo(
    baselineData.currentSavings,
    baselineData.monthlyContributions * 12,
    yearsToRetirement,
    yearsInRetirement,
    baselineData.annualExpenses,
    baselineData.socialSecurityBenefit,
    baselineData.expectedReturn,
    0.15, // volatility
    baselineData.inflationRate
  );

  // Calculate scenario projection
  const scenarioYearsToRetirement = Math.max(0, modifiedData.retirementAge - baselineData.currentAge);
  const scenarioYearsInRetirement = modifiedData.lifeExpectancy - modifiedData.retirementAge;

  const scenarioSimulation = runScenarioMonteCarlo(
    modifiedData.currentSavings,
    modifiedData.monthlyContributions * 12,
    scenarioYearsToRetirement,
    scenarioYearsInRetirement,
    modifiedData.annualExpenses,
    modifiedData.socialSecurityBenefit,
    modifiedData.expectedReturn,
    0.15,
    modifiedData.inflationRate
  );

  // Generate year-by-year projections
  const projections: ScenarioResult['projections'] = [];
  let balance = modifiedData.currentSavings;
  let currentExpenses = modifiedData.annualExpenses;
  let yearsWithShortfall = 0;
  let totalShortfall = 0;

  for (let year = 1; year <= scenarioYearsToRetirement + scenarioYearsInRetirement; year++) {
    const age = baselineData.currentAge + year;
    const isRetired = year > scenarioYearsToRetirement;

    if (isRetired) {
      currentExpenses *= (1 + modifiedData.inflationRate);
    }

    const income = isRetired
      ? modifiedData.socialSecurityBenefit + (balance > 0 ? modifiedData.annualExpenses * 0.04 : 0)
      : modifiedData.monthlyContributions * 12 + modifiedData.currentSavings * 0.05;

    const withdrawal = isRetired ? Math.min(balance, currentExpenses - modifiedData.socialSecurityBenefit) : 0;
    const contribution = isRetired ? 0 : modifiedData.monthlyContributions * 12;

    balance = balance + contribution - withdrawal;
    balance *= (1 + modifiedData.expectedReturn);

    const surplus = income - currentExpenses;
    if (surplus < 0 && isRetired) {
      yearsWithShortfall++;
      totalShortfall += Math.abs(surplus);
    }

    projections.push({
      year,
      age,
      balance: Math.round(Math.max(0, balance)),
      withdrawal: Math.round(withdrawal),
      income: Math.round(income),
      expenses: Math.round(currentExpenses),
      surplus: Math.round(surplus),
    });
  }

  // Calculate retirement readiness score for scenario
  const retirementReadinessScore = Math.min(100, Math.round(
    scenarioSimulation.successRate * 50 +
    Math.min(30, (scenarioSimulation.medianEndingBalance / modifiedData.annualExpenses) * 2) +
    (1 - Math.min(1, yearsWithShortfall / 10)) * 20
  ));

  return {
    name: scenarioName,
    description: scenarioDescription,
    probability,
    impactSeverity,
    projections,
    keyMetrics: {
      successProbability: scenarioSimulation.successRate,
      portfolioDepletion: scenarioSimulation.avgDepletionAge
        ? baselineData.currentAge + scenarioYearsToRetirement + scenarioSimulation.avgDepletionAge
        : null,
      legacyAmount: Math.round(scenarioSimulation.medianEndingBalance),
      averageAnnualShortfall: yearsWithShortfall > 0 ? Math.round(totalShortfall / yearsWithShortfall) : 0,
      yearsWithShortfall,
      retirementReadinessScore,
    },
    adjustmentsNeeded,
    comparison: {
      baselineSuccess: baselineSimulation.successRate,
      scenarioSuccess: scenarioSimulation.successRate,
      successDelta: scenarioSimulation.successRate - baselineSimulation.successRate,
      baselineLegacy: Math.round(baselineSimulation.medianEndingBalance),
      scenarioLegacy: Math.round(scenarioSimulation.medianEndingBalance),
      legacyDelta: Math.round(scenarioSimulation.medianEndingBalance - baselineSimulation.medianEndingBalance),
    },
  };
}

// Generate all standard scenarios for comparison
function generateAllScenarios(baselineData: ScenarioInput['baselineData']): {
  scenarios: ScenarioResult[];
  riskMatrix: Array<{
    scenario: string;
    probability: number;
    impact: string;
    successRate: number;
    priority: number;
  }>;
  recommendations: string[];
} {
  const scenarioTypes: ScenarioType[] = [
    'EARLY_RETIREMENT',
    'DELAYED_RETIREMENT',
    'MARKET_CRASH',
    'HIGH_INFLATION',
    'HEALTHCARE_CRISIS',
    'LONGEVITY',
    'SPOUSE_DEATH',
    'PART_TIME_WORK',
    'RELOCATION',
  ];

  const scenarios = scenarioTypes.map(type =>
    generateScenarioProjections({ baselineData, scenarioType: type })
  );

  // Build risk matrix
  const riskMatrix = scenarios.map(s => {
    const impactScore: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    return {
      scenario: s.name,
      probability: s.probability,
      impact: s.impactSeverity,
      successRate: s.keyMetrics.successProbability,
      priority: s.probability * impactScore[s.impactSeverity] * (1 - s.keyMetrics.successProbability),
    };
  }).sort((a, b) => b.priority - a.priority);

  // Generate overall recommendations
  const recommendations: string[] = [];

  const criticalScenarios = scenarios.filter(s => s.impactSeverity === 'critical');
  if (criticalScenarios.length > 0) {
    recommendations.push(`Address ${criticalScenarios.length} critical risk scenario(s): ${criticalScenarios.map(s => s.name).join(', ')}`);
  }

  const lowSuccessScenarios = scenarios.filter(s => s.keyMetrics.successProbability < 0.8);
  if (lowSuccessScenarios.length > 0) {
    recommendations.push(`Build contingency for scenarios with <80% success: ${lowSuccessScenarios.map(s => s.name).join(', ')}`);
  }

  // Common adjustments across scenarios
  const allAdjustments = scenarios.flatMap(s => s.adjustmentsNeeded);
  const adjustmentCounts = allAdjustments.reduce((acc, adj) => {
    acc[adj] = (acc[adj] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topAdjustments = Object.entries(adjustmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([adj]) => adj);

  recommendations.push(...topAdjustments);

  return {
    scenarios,
    riskMatrix,
    recommendations,
  };
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

    const scenarios = await prisma.retirementScenario.findMany({
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

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenarios' },
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
      analyze,
      analyzeAll,
      // Baseline data for analysis
      currentAge,
      retirementAge,
      lifeExpectancy,
      currentSavings,
      monthlyContributions,
      socialSecurityBenefit,
      ssClaimingAge,
      annualExpenses,
      expectedReturn,
      inflationRate,
      // Scenario specification
      scenarioType,
      modifications,
      // Direct save fields
      name,
      description,
      assumptions,
      projectedBalance,
      successProbability,
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

    // Build baseline data
    const baselineData = {
      currentAge: currentAge || plan.currentAge,
      retirementAge: retirementAge || plan.retirementAge,
      lifeExpectancy: lifeExpectancy || plan.lifeExpectancy || 90,
      currentSavings: currentSavings || 500000,
      monthlyContributions: monthlyContributions || 2000,
      socialSecurityBenefit: socialSecurityBenefit || 24000,
      ssClaimingAge: ssClaimingAge || 67,
      annualExpenses: annualExpenses || 60000,
      expectedReturn: expectedReturn || 0.07,
      inflationRate: inflationRate || 0.03,
    };

    // Generate all scenarios
    if (analyzeAll) {
      const analysis = generateAllScenarios(baselineData);
      return NextResponse.json({ analysis, baselineData });
    }

    // Analyze single scenario
    if (analyze && scenarioType) {
      const result = generateScenarioProjections({
        baselineData,
        scenarioType,
        modifications,
      });
      return NextResponse.json({ scenario: result, baselineData });
    }

    // Save scenario
    const scenario = await prisma.retirementScenario.create({
      data: {
        planId,
        name: name || 'Custom Scenario',
        description,
        assumptions: assumptions || {},
        projectedBalance: projectedBalance || 0,
        successProbability: successProbability || 0,
        notes,
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error('Error creating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to create scenario' },
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

    const existing = await prisma.retirementScenario.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    const scenario = await prisma.retirementScenario.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(scenario);
  } catch (error) {
    console.error('Error updating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to update scenario' },
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
      return NextResponse.json({ error: 'Scenario ID required' }, { status: 400 });
    }

    const existing = await prisma.retirementScenario.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    await prisma.retirementScenario.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    return NextResponse.json(
      { error: 'Failed to delete scenario' },
      { status: 500 }
    );
  }
}
