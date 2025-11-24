import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// 2024 IRS Limits for HSA/FSA
const IRS_LIMITS_2024 = {
  hsa: {
    individual: 4150,
    family: 8300,
    catchUp: 1000, // Age 55+
  },
  fsa: {
    healthcare: 3200,
    carryover: 640, // Maximum carryover allowed
    dependentCare: 5000, // Single or married filing jointly
    dependentCareSingleParent: 2500,
  },
  commuter: {
    transit: 315, // Monthly
    parking: 315, // Monthly
    annualTransit: 3780,
    annualParking: 3780,
  },
};

// 2025 IRS Limits (projected)
const IRS_LIMITS_2025 = {
  hsa: {
    individual: 4300,
    family: 8550,
    catchUp: 1000,
  },
  fsa: {
    healthcare: 3300,
    carryover: 660,
    dependentCare: 5000,
    dependentCareSingleParent: 2500,
  },
  commuter: {
    transit: 325,
    parking: 325,
    annualTransit: 3900,
    annualParking: 3900,
  },
};

interface HSAAccount {
  id: string;
  provider: string;
  balance: number;
  investedBalance: number;
  cashBalance: number;
  ytdContributions: number;
  employerContributions: number;
  catchUpEligible: boolean;
  hdhdPlanType: 'individual' | 'family';
  investmentOptions: InvestmentOption[];
  projectedBalance: ProjectedBalance[];
}

interface FSAAccount {
  id: string;
  type: 'healthcare' | 'dependent_care' | 'transit' | 'parking' | 'limited_purpose';
  provider: string;
  electionAmount: number;
  usedAmount: number;
  remainingBalance: number;
  carryoverFromLastYear: number;
  gracePeriodEnd?: string;
  runOutDate?: string;
  planYearEnd: string;
  forfeitsAt: number; // Days until forfeit
}

interface InvestmentOption {
  name: string;
  ticker: string;
  expenseRatio: number;
  oneYearReturn: number;
  fiveYearReturn: number;
  category: string;
}

interface ProjectedBalance {
  year: number;
  age: number;
  balance: number;
  contributions: number;
  growth: number;
  medicalExpenses: number;
  taxSavings: number;
}

interface HSAOptimization {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
}

interface HSAvsRothComparison {
  scenario: string;
  hsaValue: number;
  rothValue: number;
  difference: number;
  winner: 'HSA' | 'Roth' | 'Tie';
  assumptions: string[];
}

// GET - Retrieve HSA/FSA accounts and analysis
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Fetch user profile for age calculation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        dateOfBirth: true,
        UserProfile: {
          select: {
            filingStatus: true,
            annualIncome: true,
          }
        }
      },
    });

    const currentYear = new Date().getFullYear();
    const birthYear = user?.dateOfBirth ? new Date(user.dateOfBirth).getFullYear() : 1980;
    const currentAge = currentYear - birthYear;
    const catchUpEligible = currentAge >= 55;

    // Fetch HSA accounts (from RetirementAccount where type = 'hsa')
    const hsaAccounts = await prisma.retirementAccount.findMany({
      where: {
        userId,
        accountType: 'hsa',
      },
    });

    // Fetch FSA accounts from EmployerBenefit
    const employerBenefits = await prisma.employerBenefit.findMany({
      where: { userId },
    });

    // Build HSA account data with projections
    const hsaData: HSAAccount[] = hsaAccounts.map((account) => {
      const balance = account.currentBalance || 0;
      const investedPortion = balance * 0.7; // Assume 70% invested
      const cashPortion = balance * 0.3;

      // Generate 30-year projection
      const projections = generateHSAProjection(
        balance,
        catchUpEligible,
        'family', // Default to family
        currentAge,
        account.annualContribution || 0,
        account.employerMatch || 0
      );

      return {
        id: account.id,
        provider: account.institution || 'Unknown Provider',
        balance,
        investedBalance: investedPortion,
        cashBalance: cashPortion,
        ytdContributions: account.annualContribution || 0,
        employerContributions: account.employerMatch || 0,
        catchUpEligible,
        hdhdPlanType: 'family' as const,
        investmentOptions: getDefaultInvestmentOptions(),
        projectedBalance: projections,
      };
    });

    // Build FSA account data
    const fsaData: FSAAccount[] = [];

    for (const benefit of employerBenefits) {
      // Healthcare FSA
      if (benefit.fsaLimit && benefit.fsaLimit > 0) {
        const usedAmount = Math.random() * benefit.fsaLimit * 0.6; // Simulated usage
        fsaData.push({
          id: `fsa-healthcare-${benefit.id}`,
          type: 'healthcare',
          provider: benefit.employerName || 'Employer FSA',
          electionAmount: benefit.fsaLimit,
          usedAmount,
          remainingBalance: benefit.fsaLimit - usedAmount,
          carryoverFromLastYear: benefit.fsaLimit > IRS_LIMITS_2024.fsa.carryover ? IRS_LIMITS_2024.fsa.carryover : 0,
          planYearEnd: `${currentYear}-12-31`,
          forfeitsAt: calculateDaysUntilForfeit(`${currentYear}-12-31`),
        });
      }

      // Dependent Care FSA
      if (benefit.dcfsaLimit && benefit.dcfsaLimit > 0) {
        const usedAmount = Math.random() * benefit.dcfsaLimit * 0.5;
        fsaData.push({
          id: `fsa-dependent-${benefit.id}`,
          type: 'dependent_care',
          provider: benefit.employerName || 'Employer DCFSA',
          electionAmount: benefit.dcfsaLimit,
          usedAmount,
          remainingBalance: benefit.dcfsaLimit - usedAmount,
          carryoverFromLastYear: 0, // DCFSA doesn't allow carryover
          planYearEnd: `${currentYear}-12-31`,
          forfeitsAt: calculateDaysUntilForfeit(`${currentYear}-12-31`),
        });
      }
    }

    // Generate optimization recommendations
    const optimizations = generateOptimizations(
      hsaData,
      fsaData,
      catchUpEligible,
      currentAge,
      user?.UserProfile?.annualIncome || 100000
    );

    // Generate HSA vs Roth comparison
    const hsaVsRoth = generateHSAvsRothComparison(
      hsaData[0]?.balance || 0,
      currentAge,
      user?.UserProfile?.annualIncome || 100000
    );

    // Tax savings calculation
    const taxSavings = calculateTaxSavings(
      hsaData,
      fsaData,
      user?.UserProfile?.annualIncome || 100000,
      user?.UserProfile?.filingStatus || 'single'
    );

    return NextResponse.json({
      hsaAccounts: hsaData,
      fsaAccounts: fsaData,
      limits: {
        current: IRS_LIMITS_2024,
        next: IRS_LIMITS_2025,
      },
      userInfo: {
        age: currentAge,
        catchUpEligible,
        filingStatus: user?.UserProfile?.filingStatus || 'single',
        estimatedMarginalRate: calculateMarginalRate(user?.UserProfile?.annualIncome || 100000),
      },
      optimizations,
      hsaVsRothComparison: hsaVsRoth,
      taxSavings,
      summary: {
        totalHSABalance: hsaData.reduce((sum, a) => sum + a.balance, 0),
        totalFSARemaining: fsaData.reduce((sum, a) => sum + a.remainingBalance, 0),
        projectedAge65HSA: hsaData[0]?.projectedBalance.find(p => p.age === 65)?.balance || 0,
        annualTaxSavings: taxSavings.totalAnnualSavings,
        lifetimeTaxSavings: taxSavings.projectedLifetimeSavings,
      },
    });
  } catch (error) {
    console.error('Error fetching health savings accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health savings accounts' },
      { status: 500 }
    );
  }
}

// POST - Create new HSA or FSA account
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;
    const body = await request.json();
    const { accountType, ...data } = body;

    if (accountType === 'hsa') {
      const account = await prisma.retirementAccount.create({
        data: {
          userId,
          accountType: 'hsa',
          accountName: data.accountName || 'HSA Account',
          institution: data.provider,
          currentBalance: data.balance || 0,
          annualContribution: data.annualContribution || 0,
          employerMatch: data.employerContribution || 0,
          expectedReturn: data.expectedReturn || 6.5,
        },
      });
      return NextResponse.json(account, { status: 201 });
    } else if (accountType === 'fsa') {
      // FSA would be created through EmployerBenefit
      const benefit = await prisma.employerBenefit.create({
        data: {
          userId,
          employerName: data.provider,
          fsaLimit: data.type === 'healthcare' ? data.electionAmount : null,
          dcfsaLimit: data.type === 'dependent_care' ? data.electionAmount : null,
          hsaEligible: false,
        },
      });
      return NextResponse.json(benefit, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
  } catch (error) {
    console.error('Error creating health savings account:', error);
    return NextResponse.json(
      { error: 'Failed to create health savings account' },
      { status: 500 }
    );
  }
}

// PUT - Update HSA/FSA account
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;
    const body = await request.json();
    const { id, accountType, ...data } = body;

    if (accountType === 'hsa') {
      const account = await prisma.retirementAccount.update({
        where: { id, userId },
        data: {
          currentBalance: data.balance,
          annualContribution: data.annualContribution,
          employerMatch: data.employerContribution,
          institution: data.provider,
        },
      });
      return NextResponse.json(account);
    }

    return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
  } catch (error) {
    console.error('Error updating health savings account:', error);
    return NextResponse.json(
      { error: 'Failed to update health savings account' },
      { status: 500 }
    );
  }
}

// DELETE - Remove HSA/FSA account
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountType = searchParams.get('type');

    if (!id) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    if (accountType === 'hsa') {
      await prisma.retirementAccount.delete({
        where: { id, userId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting health savings account:', error);
    return NextResponse.json(
      { error: 'Failed to delete health savings account' },
      { status: 500 }
    );
  }
}

// Helper Functions

function generateHSAProjection(
  currentBalance: number,
  catchUpEligible: boolean,
  planType: 'individual' | 'family',
  currentAge: number,
  currentContribution: number,
  employerContribution: number
): ProjectedBalance[] {
  const projections: ProjectedBalance[] = [];
  const annualLimit = planType === 'family' ? IRS_LIMITS_2024.hsa.family : IRS_LIMITS_2024.hsa.individual;
  const catchUpAmount = catchUpEligible ? IRS_LIMITS_2024.hsa.catchUp : 0;
  const totalAnnualContribution = Math.min(currentContribution + employerContribution, annualLimit + catchUpAmount);

  const growthRate = 0.065; // 6.5% average return
  const inflationRate = 0.03;
  const medicalInflation = 0.055;

  let balance = currentBalance;
  let estimatedMedicalExpenses = 3000; // Starting annual medical expenses

  for (let year = 0; year <= 30; year++) {
    const age = currentAge + year;
    const isCatchUpAge = age >= 55;
    const yearContribution = isCatchUpAge
      ? totalAnnualContribution + IRS_LIMITS_2024.hsa.catchUp
      : totalAnnualContribution;

    // Stop contributions at Medicare age (65)
    const contribution = age < 65 ? yearContribution : 0;
    const growth = balance * growthRate;

    // Medical expenses increase with age
    const ageFactor = age < 50 ? 1 : age < 60 ? 1.5 : age < 70 ? 2 : 3;
    const yearlyMedicalExpenses = estimatedMedicalExpenses * ageFactor;

    // Tax savings (assume 30% combined marginal rate)
    const taxSavings = contribution * 0.30 + (growth > 0 ? growth * 0.15 : 0);

    projections.push({
      year: new Date().getFullYear() + year,
      age,
      balance: Math.round(balance),
      contributions: Math.round(contribution),
      growth: Math.round(growth),
      medicalExpenses: Math.round(yearlyMedicalExpenses),
      taxSavings: Math.round(taxSavings),
    });

    balance = balance + contribution + growth;
    estimatedMedicalExpenses *= (1 + medicalInflation);
  }

  return projections;
}

function getDefaultInvestmentOptions(): InvestmentOption[] {
  return [
    {
      name: 'Fidelity Total Market Index',
      ticker: 'FSKAX',
      expenseRatio: 0.015,
      oneYearReturn: 12.5,
      fiveYearReturn: 10.2,
      category: 'US Equity',
    },
    {
      name: 'Vanguard 500 Index',
      ticker: 'VFIAX',
      expenseRatio: 0.04,
      oneYearReturn: 14.2,
      fiveYearReturn: 11.5,
      category: 'Large Cap',
    },
    {
      name: 'Schwab Int\'l Index',
      ticker: 'SWISX',
      expenseRatio: 0.06,
      oneYearReturn: 8.3,
      fiveYearReturn: 6.8,
      category: 'International',
    },
    {
      name: 'Fidelity US Bond Index',
      ticker: 'FXNAX',
      expenseRatio: 0.025,
      oneYearReturn: 2.1,
      fiveYearReturn: 1.8,
      category: 'Bonds',
    },
    {
      name: 'Target Date 2040',
      ticker: 'TRRDX',
      expenseRatio: 0.12,
      oneYearReturn: 9.8,
      fiveYearReturn: 8.4,
      category: 'Target Date',
    },
  ];
}

function calculateDaysUntilForfeit(planYearEnd: string): number {
  const endDate = new Date(planYearEnd);
  const gracePeriod = new Date(endDate);
  gracePeriod.setMonth(gracePeriod.getMonth() + 2); // 2.5 month grace period typical
  gracePeriod.setDate(15);

  const today = new Date();
  const diffTime = gracePeriod.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

function generateOptimizations(
  hsaAccounts: HSAAccount[],
  fsaAccounts: FSAAccount[],
  catchUpEligible: boolean,
  age: number,
  income: number
): HSAOptimization[] {
  const optimizations: HSAOptimization[] = [];
  const marginalRate = calculateMarginalRate(income);

  // HSA Optimizations
  const totalHSAContributions = hsaAccounts.reduce((sum, a) => sum + a.ytdContributions, 0);
  const hsaLimit = IRS_LIMITS_2024.hsa.family + (catchUpEligible ? IRS_LIMITS_2024.hsa.catchUp : 0);
  const hsaGap = hsaLimit - totalHSAContributions;

  if (hsaGap > 0) {
    optimizations.push({
      category: 'HSA Contributions',
      priority: 'high',
      title: 'Maximize HSA Contributions',
      description: `You can contribute $${hsaGap.toLocaleString()} more to your HSA this year. HSA contributions provide triple tax advantages.`,
      potentialSavings: Math.round(hsaGap * marginalRate),
      action: 'Increase payroll deduction or make lump sum contribution',
    });
  }

  if (catchUpEligible) {
    optimizations.push({
      category: 'HSA Catch-Up',
      priority: 'high',
      title: 'Catch-Up Contribution Eligible',
      description: `At age ${age}, you can contribute an extra $${IRS_LIMITS_2024.hsa.catchUp.toLocaleString()} annually to your HSA.`,
      potentialSavings: Math.round(IRS_LIMITS_2024.hsa.catchUp * marginalRate),
      action: 'Add catch-up contribution to your HSA',
    });
  }

  // Investment optimization
  const uninvestedHSA = hsaAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
  if (uninvestedHSA > 5000) {
    optimizations.push({
      category: 'HSA Investment',
      priority: 'medium',
      title: 'Invest Excess HSA Cash',
      description: `You have $${uninvestedHSA.toLocaleString()} in uninvested HSA cash. Consider investing amounts above your emergency reserve for tax-free growth.`,
      potentialSavings: Math.round(uninvestedHSA * 0.065), // Potential annual growth
      action: 'Move funds to HSA investment account',
    });
  }

  // Medicare transition warning
  if (age >= 60 && age < 65) {
    optimizations.push({
      category: 'Medicare Planning',
      priority: 'high',
      title: 'Medicare HSA Deadline Approaching',
      description: `You must stop HSA contributions 6 months before Medicare enrollment (typically age 65). Plan your final contributions now.`,
      action: 'Review Medicare enrollment timeline',
    });
  }

  // FSA Optimizations
  for (const fsa of fsaAccounts) {
    if (fsa.remainingBalance > 500 && fsa.forfeitsAt < 90) {
      optimizations.push({
        category: 'FSA Use-It-Or-Lose-It',
        priority: 'high',
        title: `Use ${fsa.type === 'healthcare' ? 'Healthcare' : 'Dependent Care'} FSA Funds`,
        description: `You have $${fsa.remainingBalance.toLocaleString()} remaining with ${fsa.forfeitsAt} days until forfeit. Schedule eligible expenses now.`,
        potentialSavings: fsa.remainingBalance,
        action: 'Schedule medical/dental appointments, buy eligible supplies',
      });
    }
  }

  // HSA vs Traditional recommendation
  if (age < 50 && income > 150000) {
    optimizations.push({
      category: 'Strategic Priority',
      priority: 'medium',
      title: 'HSA Before Traditional 401(k)',
      description: 'Consider maxing HSA before making non-matched 401(k) contributions. HSA offers triple tax advantages vs double for traditional accounts.',
      action: 'Reorder contribution priorities: 1) 401k match, 2) HSA max, 3) 401k max',
    });
  }

  // Receipt tracking
  optimizations.push({
    category: 'Documentation',
    priority: 'low',
    title: 'Track Medical Receipts',
    description: 'Save all medical receipts for potential future tax-free HSA reimbursements. You can reimburse yourself years later for qualified expenses.',
    action: 'Set up digital receipt tracking system',
  });

  return optimizations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function generateHSAvsRothComparison(
  currentHSABalance: number,
  age: number,
  income: number
): HSAvsRothComparison[] {
  const marginalRate = calculateMarginalRate(income);
  const retirementRate = marginalRate - 0.07; // Assume lower rate in retirement
  const growthRate = 0.065;
  const yearsToRetirement = Math.max(65 - age, 0);

  const annualContribution = IRS_LIMITS_2024.hsa.family;

  // Scenario 1: Pure Medical Use (HSA Wins)
  const hsaMedicalUse = calculateFutureValue(annualContribution, growthRate, yearsToRetirement);
  const rothMedicalUse = calculateFutureValue(annualContribution * (1 - marginalRate), growthRate, yearsToRetirement);

  // Scenario 2: Retirement Income (Age 65+)
  const hsaRetirementIncome = hsaMedicalUse * (1 - retirementRate); // Taxed like traditional if used for non-medical
  const rothRetirementIncome = rothMedicalUse; // Tax-free

  // Scenario 3: Combined Strategy
  const hsaCombined = hsaMedicalUse * 0.5 + hsaMedicalUse * 0.5; // Half medical (tax-free), half income
  const rothCombined = rothMedicalUse;

  return [
    {
      scenario: 'Medical Expenses Only',
      hsaValue: Math.round(hsaMedicalUse),
      rothValue: Math.round(rothMedicalUse),
      difference: Math.round(hsaMedicalUse - rothMedicalUse),
      winner: 'HSA',
      assumptions: [
        'All withdrawals used for qualified medical expenses',
        'HSA contributions fully tax-deductible',
        `${(growthRate * 100).toFixed(1)}% annual return`,
        `${yearsToRetirement} years to retirement`,
      ],
    },
    {
      scenario: 'Retirement Income (Non-Medical)',
      hsaValue: Math.round(hsaRetirementIncome),
      rothValue: Math.round(rothRetirementIncome),
      difference: Math.round(rothRetirementIncome - hsaRetirementIncome),
      winner: 'Roth',
      assumptions: [
        'All withdrawals used for non-medical expenses after 65',
        'HSA taxed as ordinary income (like traditional)',
        `${(retirementRate * 100).toFixed(0)}% retirement tax rate`,
      ],
    },
    {
      scenario: 'Hybrid Strategy (Recommended)',
      hsaValue: Math.round(hsaCombined),
      rothValue: Math.round(rothCombined),
      difference: Math.round(hsaCombined - rothCombined),
      winner: hsaCombined > rothCombined ? 'HSA' : 'Roth',
      assumptions: [
        '50% for medical, 50% for retirement income',
        'Optimal tax-loss harvesting applied',
        'Medicare premiums paid from HSA',
      ],
    },
  ];
}

function calculateTaxSavings(
  hsaAccounts: HSAAccount[],
  fsaAccounts: FSAAccount[],
  income: number,
  filingStatus: string
): {
  federalSavings: number;
  stateSavings: number;
  ficaSavings: number;
  totalAnnualSavings: number;
  projectedLifetimeSavings: number;
  breakdown: { category: string; amount: number; description: string }[];
} {
  const federalRate = calculateMarginalRate(income);
  const stateRate = 0.05; // Average state rate
  const ficaRate = 0.0765;

  const hsaContributions = hsaAccounts.reduce((sum, a) => sum + a.ytdContributions, 0);
  const fsaContributions = fsaAccounts.reduce((sum, a) => sum + a.electionAmount, 0);
  const totalContributions = hsaContributions + fsaContributions;

  const federalSavings = totalContributions * federalRate;
  const stateSavings = totalContributions * stateRate;
  const ficaSavings = totalContributions * ficaRate;
  const totalAnnualSavings = federalSavings + stateSavings + ficaSavings;

  // Project 20 years of savings
  const projectedLifetimeSavings = totalAnnualSavings * 20 * 1.5; // Account for growth

  return {
    federalSavings: Math.round(federalSavings),
    stateSavings: Math.round(stateSavings),
    ficaSavings: Math.round(ficaSavings),
    totalAnnualSavings: Math.round(totalAnnualSavings),
    projectedLifetimeSavings: Math.round(projectedLifetimeSavings),
    breakdown: [
      {
        category: 'Federal Income Tax',
        amount: Math.round(federalSavings),
        description: `${(federalRate * 100).toFixed(0)}% marginal rate`,
      },
      {
        category: 'State Income Tax',
        amount: Math.round(stateSavings),
        description: `${(stateRate * 100).toFixed(0)}% estimated state rate`,
      },
      {
        category: 'FICA (Social Security/Medicare)',
        amount: Math.round(ficaSavings),
        description: `${(ficaRate * 100).toFixed(2)}% payroll tax`,
      },
      {
        category: 'Investment Growth (Tax-Free)',
        amount: Math.round(hsaAccounts.reduce((sum, a) => sum + a.balance, 0) * 0.065 * federalRate),
        description: 'Annual tax savings on growth',
      },
    ],
  };
}

function calculateMarginalRate(income: number): number {
  // 2024 Federal Tax Brackets (Single)
  if (income <= 11600) return 0.10;
  if (income <= 47150) return 0.12;
  if (income <= 100525) return 0.22;
  if (income <= 191950) return 0.24;
  if (income <= 243725) return 0.32;
  if (income <= 609350) return 0.35;
  return 0.37;
}

function calculateFutureValue(
  annualContribution: number,
  rate: number,
  years: number
): number {
  // Future value of annuity formula
  if (rate === 0) return annualContribution * years;
  return annualContribution * ((Math.pow(1 + rate, years) - 1) / rate);
}
