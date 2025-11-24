import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// Account type configurations with contribution limits (2024)
const ACCOUNT_CONFIGS = {
  TRADITIONAL_401K: {
    contributionLimit2024: 23000,
    catchUpContribution: 7500,
    catchUpAge: 50,
    employerMatchEligible: true,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: true,
    withdrawalTaxable: true,
    earlyWithdrawalPenalty: 0.10,
    earlyWithdrawalAge: 59.5,
  },
  ROTH_401K: {
    contributionLimit2024: 23000,
    catchUpContribution: 7500,
    catchUpAge: 50,
    employerMatchEligible: true,
    rmdRequired: true, // Changed in SECURE 2.0 - no RMDs starting 2024
    rmdAge: 73,
    taxDeductible: false,
    withdrawalTaxable: false,
    earlyWithdrawalPenalty: 0.10,
    earlyWithdrawalAge: 59.5,
  },
  TRADITIONAL_IRA: {
    contributionLimit2024: 7000,
    catchUpContribution: 1000,
    catchUpAge: 50,
    employerMatchEligible: false,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: true, // Income limits apply
    withdrawalTaxable: true,
    earlyWithdrawalPenalty: 0.10,
    earlyWithdrawalAge: 59.5,
  },
  ROTH_IRA: {
    contributionLimit2024: 7000,
    catchUpContribution: 1000,
    catchUpAge: 50,
    employerMatchEligible: false,
    rmdRequired: false,
    rmdAge: null,
    taxDeductible: false,
    withdrawalTaxable: false,
    earlyWithdrawalPenalty: 0.10,
    earlyWithdrawalAge: 59.5,
    incomeLimit: { single: 161000, married: 240000 }, // Phase-out starts
  },
  SEP_IRA: {
    contributionLimit2024: 69000, // 25% of compensation up to this limit
    catchUpContribution: 0,
    catchUpAge: 50,
    employerMatchEligible: false,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: true,
    withdrawalTaxable: true,
    earlyWithdrawalPenalty: 0.10,
    earlyWithdrawalAge: 59.5,
  },
  SIMPLE_IRA: {
    contributionLimit2024: 16000,
    catchUpContribution: 3500,
    catchUpAge: 50,
    employerMatchEligible: true,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: true,
    withdrawalTaxable: true,
    earlyWithdrawalPenalty: 0.25, // First 2 years, then 10%
    earlyWithdrawalAge: 59.5,
  },
  PENSION: {
    contributionLimit2024: null,
    employerMatchEligible: false,
    rmdRequired: false,
    taxDeductible: false,
    withdrawalTaxable: true,
  },
  ANNUITY: {
    contributionLimit2024: null,
    employerMatchEligible: false,
    rmdRequired: false,
    taxDeductible: false,
    withdrawalTaxable: true, // Earnings only
  },
  BROKERAGE: {
    contributionLimit2024: null,
    employerMatchEligible: false,
    rmdRequired: false,
    taxDeductible: false,
    withdrawalTaxable: false, // Capital gains rules apply
  },
  HSA: {
    contributionLimit2024: { individual: 4150, family: 8300 },
    catchUpContribution: 1000,
    catchUpAge: 55,
    employerMatchEligible: true,
    rmdRequired: false,
    taxDeductible: true,
    withdrawalTaxable: false, // For qualified medical expenses
    earlyWithdrawalPenalty: 0.20, // For non-medical before 65
  },
  '457B': {
    contributionLimit2024: 23000,
    catchUpContribution: 7500,
    catchUpAge: 50,
    specialCatchUp: 46000, // 3-year catch-up provision
    employerMatchEligible: true,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: true,
    withdrawalTaxable: true,
    earlyWithdrawalPenalty: 0, // No 10% penalty for governmental 457(b)
  },
  '403B': {
    contributionLimit2024: 23000,
    catchUpContribution: 7500,
    catchUpAge: 50,
    employerMatchEligible: true,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: true,
    withdrawalTaxable: true,
    earlyWithdrawalPenalty: 0.10,
    earlyWithdrawalAge: 59.5,
  },
  CASH_BALANCE: {
    contributionLimit2024: null, // Employer defined
    employerMatchEligible: false,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: false,
    withdrawalTaxable: true,
  },
  ESOP: {
    contributionLimit2024: null,
    employerMatchEligible: false,
    rmdRequired: true,
    rmdAge: 73,
    taxDeductible: false,
    withdrawalTaxable: true,
    netUnrealizedAppreciationEligible: true,
  },
  REAL_ESTATE: {
    contributionLimit2024: null,
    employerMatchEligible: false,
    rmdRequired: false,
    taxDeductible: false,
    withdrawalTaxable: false, // Capital gains + depreciation recapture
  },
  OTHER: {
    contributionLimit2024: null,
    employerMatchEligible: false,
    rmdRequired: false,
  },
};

// Calculate projected balance at retirement
function projectAccountBalance(
  currentBalance: number,
  monthlyContribution: number,
  employerMatch: number,
  yearsToRetirement: number,
  expectedReturn: number,
  inflationRate: number = 0.03
): {
  nominalBalance: number;
  realBalance: number;
  totalContributions: number;
  totalGrowth: number;
  yearlyProjections: Array<{
    year: number;
    balance: number;
    realBalance: number;
    contributions: number;
    growth: number;
  }>;
} {
  const monthlyRate = expectedReturn / 12;
  const totalMonthlyContribution = monthlyContribution + employerMatch;
  const months = yearsToRetirement * 12;

  let balance = currentBalance;
  let totalContributions = currentBalance;
  const yearlyProjections = [];

  for (let year = 1; year <= yearsToRetirement; year++) {
    const startBalance = balance;

    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + totalMonthlyContribution;
      totalContributions += totalMonthlyContribution;
    }

    const inflationFactor = Math.pow(1 + inflationRate, year);

    yearlyProjections.push({
      year,
      balance: Math.round(balance),
      realBalance: Math.round(balance / inflationFactor),
      contributions: Math.round(totalContributions - currentBalance),
      growth: Math.round(balance - totalContributions),
    });
  }

  const inflationFactor = Math.pow(1 + inflationRate, yearsToRetirement);

  return {
    nominalBalance: Math.round(balance),
    realBalance: Math.round(balance / inflationFactor),
    totalContributions: Math.round(totalContributions - currentBalance),
    totalGrowth: Math.round(balance - totalContributions),
    yearlyProjections,
  };
}

// Calculate Required Minimum Distribution
function calculateRMD(balance: number, age: number): number {
  // IRS Uniform Lifetime Table (simplified)
  const distributionPeriods: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
    79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
    86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
    93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
    100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
    107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
    114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
  };

  if (age < 73) return 0;
  const period = distributionPeriods[Math.min(age, 120)] || 2.0;
  return Math.round(balance / period);
}

// Calculate tax-efficient withdrawal order
function calculateWithdrawalOrder(
  accounts: Array<{
    id: string;
    name: string;
    accountType: string;
    currentBalance: number;
    taxStatus: string;
  }>,
  annualNeed: number,
  currentAge: number,
  marginalTaxRate: number
): {
  withdrawalPlan: Array<{
    accountId: string;
    accountName: string;
    amount: number;
    taxImpact: number;
    reason: string;
  }>;
  totalTax: number;
  effectiveTaxRate: number;
} {
  const withdrawalPlan = [];
  let remainingNeed = annualNeed;
  let totalTax = 0;

  // Sort accounts by tax efficiency for withdrawal
  const sortedAccounts = [...accounts].sort((a, b) => {
    const taxOrder: Record<string, number> = {
      TAXABLE: 1,      // Withdraw first (capital gains treatment)
      TAX_DEFERRED: 2, // Withdraw second (ordinary income)
      TAX_FREE: 3,     // Withdraw last (preserve tax-free growth)
    };
    return (taxOrder[a.taxStatus] || 2) - (taxOrder[b.taxStatus] || 2);
  });

  for (const account of sortedAccounts) {
    if (remainingNeed <= 0) break;

    const config = ACCOUNT_CONFIGS[account.accountType as keyof typeof ACCOUNT_CONFIGS];
    const withdrawAmount = Math.min(remainingNeed, account.currentBalance);

    let taxImpact = 0;
    let reason = '';

    if (account.taxStatus === 'TAXABLE') {
      // Assume 50% basis, 15% LTCG rate
      taxImpact = withdrawAmount * 0.5 * 0.15;
      reason = 'Long-term capital gains treatment on appreciation';
    } else if (account.taxStatus === 'TAX_DEFERRED') {
      taxImpact = withdrawAmount * marginalTaxRate;
      reason = 'Taxed as ordinary income';

      // Add early withdrawal penalty if applicable
      if (config && 'earlyWithdrawalAge' in config && currentAge < (config.earlyWithdrawalAge || 59.5)) {
        const penalty = config.earlyWithdrawalPenalty || 0.10;
        taxImpact += withdrawAmount * penalty;
        reason += ` + ${penalty * 100}% early withdrawal penalty`;
      }
    } else if (account.taxStatus === 'TAX_FREE') {
      taxImpact = 0;
      reason = 'Tax-free qualified distribution';
    }

    withdrawalPlan.push({
      accountId: account.id,
      accountName: account.name,
      amount: withdrawAmount,
      taxImpact: Math.round(taxImpact),
      reason,
    });

    totalTax += taxImpact;
    remainingNeed -= withdrawAmount;
  }

  return {
    withdrawalPlan,
    totalTax: Math.round(totalTax),
    effectiveTaxRate: annualNeed > 0 ? totalTax / annualNeed : 0,
  };
}

// Asset location optimization - where to hold different asset types
function optimizeAssetLocation(
  accounts: Array<{
    id: string;
    name: string;
    accountType: string;
    currentBalance: number;
    taxStatus: string;
  }>,
  targetAllocation: {
    stocks: number;
    bonds: number;
    reits: number;
    international: number;
    cash: number;
  }
): {
  recommendations: Array<{
    accountId: string;
    accountName: string;
    suggestedHoldings: Array<{
      assetClass: string;
      percentage: number;
      reason: string;
    }>;
  }>;
  taxEfficiencyScore: number;
} {
  const recommendations = [];

  // Tax-efficient placement rules:
  // 1. Tax-inefficient assets (bonds, REITs) → Tax-deferred accounts
  // 2. High-growth assets (stocks) → Roth/Tax-free accounts
  // 3. Tax-efficient assets (index funds, muni bonds) → Taxable accounts

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  for (const account of accounts) {
    const accountWeight = account.currentBalance / totalBalance;
    const suggestedHoldings = [];

    if (account.taxStatus === 'TAX_FREE') {
      // Roth accounts - prioritize highest growth assets
      suggestedHoldings.push({
        assetClass: 'US Stocks',
        percentage: 60,
        reason: 'Maximize tax-free growth potential',
      });
      suggestedHoldings.push({
        assetClass: 'International Stocks',
        percentage: 30,
        reason: 'High growth potential, tax-free gains',
      });
      suggestedHoldings.push({
        assetClass: 'Small Cap Value',
        percentage: 10,
        reason: 'Highest expected returns in tax-free wrapper',
      });
    } else if (account.taxStatus === 'TAX_DEFERRED') {
      // Traditional accounts - hold tax-inefficient assets
      suggestedHoldings.push({
        assetClass: 'Bonds',
        percentage: 40,
        reason: 'Interest taxed as ordinary income anyway',
      });
      suggestedHoldings.push({
        assetClass: 'REITs',
        percentage: 20,
        reason: 'Dividends taxed as ordinary income',
      });
      suggestedHoldings.push({
        assetClass: 'US Stocks',
        percentage: 40,
        reason: 'Balance for growth',
      });
    } else {
      // Taxable accounts - hold tax-efficient assets
      suggestedHoldings.push({
        assetClass: 'Total Market Index',
        percentage: 50,
        reason: 'Low turnover, qualified dividends, LTCG',
      });
      suggestedHoldings.push({
        assetClass: 'International Index',
        percentage: 25,
        reason: 'Foreign tax credit available',
      });
      suggestedHoldings.push({
        assetClass: 'Municipal Bonds',
        percentage: 15,
        reason: 'Tax-exempt interest',
      });
      suggestedHoldings.push({
        assetClass: 'I-Bonds/TIPS',
        percentage: 10,
        reason: 'Tax-deferred inflation protection',
      });
    }

    recommendations.push({
      accountId: account.id,
      accountName: account.name,
      suggestedHoldings,
    });
  }

  // Calculate tax efficiency score (simplified)
  const taxFreePercent = accounts
    .filter(a => a.taxStatus === 'TAX_FREE')
    .reduce((sum, a) => sum + a.currentBalance, 0) / totalBalance;

  const taxEfficiencyScore = Math.min(100, Math.round(
    50 + // Base score
    taxFreePercent * 30 + // Bonus for tax-free accounts
    (accounts.length >= 3 ? 20 : accounts.length * 7) // Diversification bonus
  ));

  return {
    recommendations,
    taxEfficiencyScore,
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
    const includeProjections = searchParams.get('includeProjections') === 'true';
    const includeOptimization = searchParams.get('includeOptimization') === 'true';

    // Get accounts for the user's retirement plans
    const whereClause: any = {
      retirementPlan: {
        userId: payload.userId,
      },
    };

    if (planId) {
      whereClause.planId = planId;
    }

    const accounts = await prisma.retirementAccount.findMany({
      where: whereClause,
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        retirementPlan: {
          select: {
            id: true,
            name: true,
            currentAge: true,
            retirementAge: true,
          },
        },
      },
      orderBy: { currentBalance: 'desc' },
    });

    // Calculate additional metrics for each account
    const enrichedAccounts = accounts.map((account) => {
      const config = ACCOUNT_CONFIGS[account.accountType as keyof typeof ACCOUNT_CONFIGS];
      const plan = account.retirementPlan;
      const yearsToRetirement = plan ? plan.retirementAge - plan.currentAge : 20;

      let projection = null;
      if (includeProjections && plan) {
        projection = projectAccountBalance(
          account.currentBalance,
          account.monthlyContribution || 0,
          account.employerMatch || 0,
          yearsToRetirement,
          account.expectedReturn || 0.07
        );
      }

      // Calculate contribution room
      let contributionRoom = null;
      if (config?.contributionLimit2024) {
        const limit = typeof config.contributionLimit2024 === 'object'
          ? config.contributionLimit2024.individual || config.contributionLimit2024.family
          : config.contributionLimit2024;

        const currentYearContributions = (account.monthlyContribution || 0) * 12;
        contributionRoom = Math.max(0, (limit as number) - currentYearContributions);

        // Add catch-up if eligible
        if (config.catchUpAge && plan && plan.currentAge >= config.catchUpAge) {
          contributionRoom += config.catchUpContribution || 0;
        }
      }

      // Calculate RMD if applicable
      let rmdAmount = null;
      if (config?.rmdRequired && plan && plan.currentAge >= (config.rmdAge || 73)) {
        rmdAmount = calculateRMD(account.currentBalance, plan.currentAge);
      }

      return {
        ...account,
        config,
        projection,
        contributionRoom,
        rmdAmount,
        taxStatus: account.taxStatus || (
          account.accountType.includes('ROTH') ? 'TAX_FREE' :
          account.accountType === 'BROKERAGE' ? 'TAXABLE' : 'TAX_DEFERRED'
        ),
      };
    });

    // Calculate portfolio-level optimization if requested
    let optimization = null;
    if (includeOptimization && enrichedAccounts.length > 0) {
      const accountsForOptimization = enrichedAccounts.map(a => ({
        id: a.id,
        name: a.accountName,
        accountType: a.accountType,
        currentBalance: a.currentBalance,
        taxStatus: a.taxStatus || 'TAX_DEFERRED',
      }));

      optimization = {
        assetLocation: optimizeAssetLocation(accountsForOptimization, {
          stocks: 60,
          bonds: 25,
          reits: 5,
          international: 8,
          cash: 2,
        }),
        withdrawalOrder: calculateWithdrawalOrder(
          accountsForOptimization,
          50000, // Example annual need
          enrichedAccounts[0]?.retirementPlan?.currentAge || 65,
          0.22 // Example marginal rate
        ),
      };
    }

    // Calculate totals
    const totals = {
      totalBalance: enrichedAccounts.reduce((sum, a) => sum + a.currentBalance, 0),
      totalProjectedBalance: includeProjections
        ? enrichedAccounts.reduce((sum, a) => sum + (a.projection?.nominalBalance || a.currentBalance), 0)
        : null,
      totalMonthlyContributions: enrichedAccounts.reduce((sum, a) => sum + (a.monthlyContribution || 0), 0),
      totalEmployerMatch: enrichedAccounts.reduce((sum, a) => sum + (a.employerMatch || 0), 0),
      byTaxStatus: {
        taxDeferred: enrichedAccounts.filter(a => a.taxStatus === 'TAX_DEFERRED').reduce((sum, a) => sum + a.currentBalance, 0),
        taxFree: enrichedAccounts.filter(a => a.taxStatus === 'TAX_FREE').reduce((sum, a) => sum + a.currentBalance, 0),
        taxable: enrichedAccounts.filter(a => a.taxStatus === 'TAXABLE').reduce((sum, a) => sum + a.currentBalance, 0),
      },
      byAccountType: Object.entries(
        enrichedAccounts.reduce((acc, a) => {
          acc[a.accountType] = (acc[a.accountType] || 0) + a.currentBalance;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, balance]) => ({ type, balance })),
    };

    return NextResponse.json({
      accounts: enrichedAccounts,
      totals,
      optimization,
      accountTypes: Object.keys(ACCOUNT_CONFIGS),
    });
  } catch (error) {
    console.error('Error fetching retirement accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch retirement accounts' },
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
      accountName,
      accountType,
      institution,
      currentBalance,
      monthlyContribution,
      employerMatch,
      employerMatchPercent,
      vestingSchedule,
      expectedReturn,
      expenseRatio,
      taxStatus,
      beneficiary,
      notes,
      assetAllocation,
    } = body;

    // Verify the plan belongs to the user
    const plan = await prisma.retirementPlan.findFirst({
      where: {
        id: planId,
        userId: payload.userId,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Retirement plan not found' }, { status: 404 });
    }

    // Determine tax status if not provided
    const determinedTaxStatus = taxStatus || (
      accountType.includes('ROTH') ? 'TAX_FREE' :
      accountType === 'BROKERAGE' || accountType === 'REAL_ESTATE' ? 'TAXABLE' :
      'TAX_DEFERRED'
    );

    const account = await prisma.retirementAccount.create({
      data: {
        planId,
        accountName,
        accountType,
        institution,
        currentBalance: currentBalance || 0,
        monthlyContribution: monthlyContribution || 0,
        employerMatch: employerMatch || 0,
        employerMatchPercent: employerMatchPercent || 0,
        vestingSchedule: vestingSchedule || null,
        expectedReturn: expectedReturn || 0.07,
        expenseRatio: expenseRatio || 0,
        taxStatus: determinedTaxStatus,
        beneficiary,
        notes,
        assetAllocation: assetAllocation || null,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('Error creating retirement account:', error);
    return NextResponse.json(
      { error: 'Failed to create retirement account' },
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
    const existingAccount = await prisma.retirementAccount.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = await prisma.retirementAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error('Error updating retirement account:', error);
    return NextResponse.json(
      { error: 'Failed to update retirement account' },
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
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Verify ownership
    const account = await prisma.retirementAccount.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await prisma.retirementAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting retirement account:', error);
    return NextResponse.json(
      { error: 'Failed to delete retirement account' },
      { status: 500 }
    );
  }
}
