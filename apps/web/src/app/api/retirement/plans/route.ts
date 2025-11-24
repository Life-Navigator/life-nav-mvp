import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface JWTPayload {
  sub: string;
  exp: number;
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("access_token")?.value || null;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
    if (!token) return null;
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded.sub;
  } catch {
    return null;
  }
}

// Monte Carlo Simulation Engine
function runMonteCarloSimulation(
  inputs: {
    currentAge: number;
    retirementAge: number;
    lifeExpectancy: number;
    currentPortfolio: number;
    annualContribution: number;
    annualExpenses: number;
    ssIncome: number;
    ssStartAge: number;
    pensionIncome: number;
    equityAllocation: number;
    inflationRate: number;
  },
  runs: number = 1000
): {
  successRate: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  depletionAges: number[];
  endingBalances: number[];
  yearlyMedians: { year: number; age: number; median: number; p10: number; p90: number }[];
} {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentPortfolio,
    annualContribution,
    annualExpenses,
    ssIncome,
    ssStartAge,
    pensionIncome,
    equityAllocation,
    inflationRate,
  } = inputs;

  // Historical return assumptions
  const equityReturn = 0.10;
  const equityVolatility = 0.18;
  const bondReturn = 0.05;
  const bondVolatility = 0.06;

  const yearsToSimulate = lifeExpectancy - currentAge + 5;
  const allResults: number[][] = [];
  const depletionAges: number[] = [];
  const endingBalances: number[] = [];

  // Box-Muller transform for normal distribution
  function randomNormal(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  for (let run = 0; run < runs; run++) {
    let portfolio = currentPortfolio;
    let age = currentAge;
    const yearlyResults: number[] = [];
    let depleted = false;
    let depletionAge = lifeExpectancy + 10;

    for (let year = 0; year < yearsToSimulate; year++) {
      age = currentAge + year;
      const isRetired = age >= retirementAge;

      // Calculate returns with correlation
      const equityReturnThisYear = randomNormal(equityReturn, equityVolatility);
      const bondReturnThisYear = randomNormal(bondReturn, bondVolatility);

      // Glide path - reduce equity allocation in retirement
      let currentEquityAlloc = equityAllocation / 100;
      if (isRetired) {
        const yearsInRetirement = age - retirementAge;
        currentEquityAlloc = Math.max(0.3, equityAllocation / 100 - yearsInRetirement * 0.01);
      }

      const portfolioReturn =
        currentEquityAlloc * equityReturnThisYear +
        (1 - currentEquityAlloc) * bondReturnThisYear;

      // Calculate cash flows
      const inflationFactor = Math.pow(1 + inflationRate / 100, year);
      const contribution = isRetired ? 0 : annualContribution;
      const expenses = isRetired ? annualExpenses * inflationFactor : 0;
      const ssThisYear = age >= ssStartAge ? ssIncome * inflationFactor : 0;
      const pensionThisYear = isRetired ? pensionIncome * inflationFactor : 0;

      // Update portfolio
      portfolio = portfolio * (1 + portfolioReturn) + contribution;

      if (isRetired) {
        const incomeNeeded = Math.max(0, expenses - ssThisYear - pensionThisYear);
        portfolio -= incomeNeeded;
      }

      if (portfolio < 0 && !depleted) {
        depleted = true;
        depletionAge = age;
        portfolio = 0;
      }

      yearlyResults.push(Math.max(0, portfolio));
    }

    allResults.push(yearlyResults);
    depletionAges.push(depletionAge);
    endingBalances.push(yearlyResults[yearlyResults.length - 1]);
  }

  // Calculate success rate
  const successfulRuns = depletionAges.filter(age => age > lifeExpectancy).length;
  const successRate = (successfulRuns / runs) * 100;

  // Calculate percentiles for ending balances
  const sortedEnding = [...endingBalances].sort((a, b) => a - b);
  const percentiles = {
    p10: sortedEnding[Math.floor(runs * 0.1)],
    p25: sortedEnding[Math.floor(runs * 0.25)],
    p50: sortedEnding[Math.floor(runs * 0.5)],
    p75: sortedEnding[Math.floor(runs * 0.75)],
    p90: sortedEnding[Math.floor(runs * 0.9)],
  };

  // Calculate yearly medians and percentiles
  const yearlyMedians: { year: number; age: number; median: number; p10: number; p90: number }[] = [];
  for (let year = 0; year < yearsToSimulate; year += 5) {
    const yearValues = allResults.map(r => r[year]).sort((a, b) => a - b);
    yearlyMedians.push({
      year,
      age: currentAge + year,
      median: yearValues[Math.floor(runs * 0.5)],
      p10: yearValues[Math.floor(runs * 0.1)],
      p90: yearValues[Math.floor(runs * 0.9)],
    });
  }

  return {
    successRate,
    percentiles,
    depletionAges,
    endingBalances,
    yearlyMedians,
  };
}

// Calculate Social Security benefit at different claiming ages
function calculateSSBenefits(pia: number, fullRetirementAge: number = 67) {
  const benefitAt62 = pia * (1 - 0.3 - (fullRetirementAge - 67) * 0.05);
  const benefitAtFRA = pia;
  const benefitAt70 = pia * 1.24 + (fullRetirementAge - 67) * 0.08 * pia;

  return {
    at62: Math.round(benefitAt62 * 12),
    atFRA: Math.round(benefitAtFRA * 12),
    at70: Math.round(benefitAt70 * 12),
  };
}

// Calculate retirement readiness score (0-100)
function calculateReadinessScore(
  successRate: number,
  incomeReplacementRatio: number,
  savingsRate: number,
  yearsToRetirement: number
): number {
  let score = 0;

  // Success rate (40 points max)
  score += Math.min(40, successRate * 0.4);

  // Income replacement (25 points max)
  score += Math.min(25, incomeReplacementRatio * 0.25);

  // Savings rate (20 points max)
  score += Math.min(20, savingsRate * 0.5);

  // Time to retirement (15 points max) - more time = higher score
  score += Math.min(15, yearsToRetirement * 0.5);

  return Math.round(score);
}

// GET /api/retirement/plans - Get all retirement plans with projections
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("id");
    const includeProjection = searchParams.get("projection") === "true";

    if (planId) {
      // Get specific plan with all related data
      const plan = await prisma.retirementPlan.findUnique({
        where: { id: planId },
        include: {
          accounts: true,
          incomeStreams: true,
          expenses: true,
          socialSecurity: true,
          healthcarePlans: true,
          withdrawalStrategies: true,
          rothConversions: true,
          scenarios: true,
          projections: {
            orderBy: { calculatedAt: "desc" },
            take: 1,
          },
          milestones: {
            orderBy: { priority: "desc" },
          },
        },
      });

      if (!plan || plan.userId !== userId) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      // Calculate totals
      const totalPortfolio = plan.accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
      const totalContributions = plan.accounts.reduce((sum, acc) => sum + acc.annualContribution, 0);
      const ssIncome = plan.socialSecurity.reduce((sum, ss) => sum + (ss.benefitAtFRA || ss.estimatedPIA || 0), 0);
      const pensionIncome = plan.incomeStreams
        .filter(i => i.type === "pension")
        .reduce((sum, i) => sum + i.annualAmount, 0);
      const annualExpenses = plan.expenses.reduce((sum, e) => sum + e.annualAmount, 0);

      let projection = null;
      if (includeProjection) {
        // Run Monte Carlo simulation
        const mcResults = runMonteCarloSimulation({
          currentAge: plan.currentAge,
          retirementAge: plan.targetRetirementAge,
          lifeExpectancy: plan.lifeExpectancy,
          currentPortfolio: totalPortfolio,
          annualContribution: totalContributions,
          annualExpenses: annualExpenses || plan.currentAnnualIncome * (plan.incomeReplacementRatio / 100),
          ssIncome,
          ssStartAge: plan.socialSecurity[0]?.plannedClaimAge || 67,
          pensionIncome,
          equityAllocation: plan.equityAllocation,
          inflationRate: plan.generalInflation,
        }, plan.monteCarloRuns);

        // Calculate readiness score
        const savingsRate = plan.currentAnnualIncome > 0
          ? (totalContributions / plan.currentAnnualIncome) * 100
          : 0;
        const yearsToRetirement = plan.targetRetirementAge - plan.currentAge;
        const readinessScore = calculateReadinessScore(
          mcResults.successRate,
          plan.incomeReplacementRatio,
          savingsRate,
          yearsToRetirement
        );

        projection = {
          successRate: mcResults.successRate,
          percentiles: mcResults.percentiles,
          yearlyMedians: mcResults.yearlyMedians,
          readinessScore,
          portfolioAtRetirement: mcResults.yearlyMedians.find(y => y.age === plan.targetRetirementAge)?.median || 0,
          portfolioAt80: mcResults.yearlyMedians.find(y => y.age === 80)?.median || 0,
          portfolioAt90: mcResults.yearlyMedians.find(y => y.age === 90)?.median || 0,
        };
      }

      return NextResponse.json({
        plan,
        summary: {
          totalPortfolio,
          totalContributions,
          ssIncome,
          pensionIncome,
          annualExpenses: annualExpenses || plan.currentAnnualIncome * (plan.incomeReplacementRatio / 100),
          yearsToRetirement: plan.targetRetirementAge - plan.currentAge,
          retirementYears: plan.lifeExpectancy - plan.targetRetirementAge,
        },
        projection,
      });
    }

    // Get all plans for user
    const plans = await prisma.retirementPlan.findMany({
      where: { userId },
      include: {
        accounts: true,
        socialSecurity: true,
        projections: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate summary for each plan
    const plansWithSummary = plans.map(plan => {
      const totalPortfolio = plan.accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
      const latestProjection = plan.projections[0];

      return {
        ...plan,
        summary: {
          totalPortfolio,
          accountCount: plan.accounts.length,
          successRate: latestProjection?.successRate || null,
          yearsToRetirement: plan.targetRetirementAge - plan.currentAge,
        },
      };
    });

    return NextResponse.json({ plans: plansWithSummary });
  } catch (error) {
    console.error("[Retirement Plans API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch retirement plans" }, { status: 500 });
  }
}

// POST /api/retirement/plans - Create a new retirement plan
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name = "My Retirement Plan",
      currentAge,
      spouseCurrentAge,
      targetRetirementAge = 65,
      spouseRetirementAge,
      lifeExpectancy = 95,
      spouseLifeExpectancy,
      currentAnnualIncome,
      spouseAnnualIncome,
      annualExpenses,
      desiredRetirementIncome,
      incomeReplacementRatio = 80,
      retirementIncomeMethod = "replacement_ratio",
      legacyGoal = 0,
      charitableGoal = 0,
      generalInflation = 2.5,
      healthcareInflation = 5.5,
      riskTolerance = "moderate",
      equityAllocation = 60,
      targetEquityInRetirement = 40,
      glidepathStrategy = "linear",
      includeSpouse = false,
      useMonteCarlo = true,
      monteCarloRuns = 1000,
      notes,
    } = body;

    if (!currentAge || !currentAnnualIncome) {
      return NextResponse.json(
        { error: "Current age and annual income are required" },
        { status: 400 }
      );
    }

    const plan = await prisma.retirementPlan.create({
      data: {
        userId,
        name,
        status: "active",
        currentAge,
        spouseCurrentAge,
        targetRetirementAge,
        spouseRetirementAge,
        lifeExpectancy,
        spouseLifeExpectancy,
        currentAnnualIncome,
        spouseAnnualIncome,
        annualExpenses,
        desiredRetirementIncome,
        incomeReplacementRatio,
        retirementIncomeMethod,
        legacyGoal,
        charitableGoal,
        generalInflation,
        healthcareInflation,
        riskTolerance,
        equityAllocation,
        targetEquityInRetirement,
        glidepathStrategy,
        includeSpouse,
        useMonteCarlo,
        monteCarloRuns,
        notes,
      },
    });

    // Create default milestones
    const defaultMilestones = [
      { name: "Maximize 401(k) contributions", category: "savings", targetType: "amount", targetAmount: 23000, priority: 9 },
      { name: "Build 6-month emergency fund", category: "savings", targetType: "amount", targetAmount: currentAnnualIncome / 2, priority: 10 },
      { name: "Reach $100k invested", category: "savings", targetType: "amount", targetAmount: 100000, priority: 8 },
      { name: "Reach $500k invested", category: "savings", targetType: "amount", targetAmount: 500000, priority: 7 },
      { name: "Reach $1M invested", category: "savings", targetType: "amount", targetAmount: 1000000, priority: 6 },
      { name: "Retirement ready", category: "age", targetType: "age", targetAge: targetRetirementAge, priority: 10 },
    ];

    await prisma.retirementMilestone.createMany({
      data: defaultMilestones.map(m => ({
        retirementPlanId: plan.id,
        ...m,
        status: "not_started",
      })),
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("[Retirement Plans API] Error creating:", error);
    return NextResponse.json({ error: "Failed to create retirement plan" }, { status: 500 });
  }
}

// PUT /api/retirement/plans - Update a retirement plan
export async function PUT(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const existing = await prisma.retirementPlan.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = await prisma.retirementPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[Retirement Plans API] Error updating:", error);
    return NextResponse.json({ error: "Failed to update retirement plan" }, { status: 500 });
  }
}

// DELETE /api/retirement/plans
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const existing = await prisma.retirementPlan.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    await prisma.retirementPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Retirement Plans API] Error deleting:", error);
    return NextResponse.json({ error: "Failed to delete retirement plan" }, { status: 500 });
  }
}
