import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// 2024 Medicare Costs
const MEDICARE_2024 = {
  partA: {
    premium: 0, // Most people qualify for premium-free Part A
    premiumNoCredits: 505, // Monthly if < 40 work credits
    deductible: 1632,
    coinsurance: {
      days1to60: 0,
      days61to90: 408, // per day
      days91to150: 816, // per day (lifetime reserve)
    },
  },
  partB: {
    standardPremium: 174.70,
    deductible: 240,
    coinsurance: 0.20, // 20% after deductible
  },
  partD: {
    averagePremium: 55.50,
    deductible: 545, // max, many plans lower
    coverageGap: {
      brandCost: 0.25, // 25% in donut hole
      genericCost: 0.25,
    },
    catastrophicLimit: 8000, // Out of pocket threshold for 2024
  },
  medigap: {
    planF: { averagePremium: 200, coverage: 'comprehensive' },
    planG: { averagePremium: 150, coverage: 'comprehensive_minus_partB_deductible' },
    planN: { averagePremium: 110, coverage: 'cost_sharing' },
  },
  advantagePlan: {
    averagePremium: 18.50,
    maxOutOfPocket: 8850, // 2024 limit
  },
};

// IRMAA thresholds for Medicare premiums
const IRMAA_2024 = {
  single: [
    { income: 103000, partBPremium: 174.70, partDSurcharge: 0 },
    { income: 129000, partBPremium: 244.60, partDSurcharge: 12.90 },
    { income: 161000, partBPremium: 349.40, partDSurcharge: 33.30 },
    { income: 193000, partBPremium: 454.20, partDSurcharge: 53.80 },
    { income: 500000, partBPremium: 559.00, partDSurcharge: 74.20 },
    { income: Infinity, partBPremium: 594.00, partDSurcharge: 81.00 },
  ],
  married: [
    { income: 206000, partBPremium: 174.70, partDSurcharge: 0 },
    { income: 258000, partBPremium: 244.60, partDSurcharge: 12.90 },
    { income: 322000, partBPremium: 349.40, partDSurcharge: 33.30 },
    { income: 386000, partBPremium: 454.20, partDSurcharge: 53.80 },
    { income: 750000, partBPremium: 559.00, partDSurcharge: 74.20 },
    { income: Infinity, partBPremium: 594.00, partDSurcharge: 81.00 },
  ],
};

// ACA Marketplace data (2024 approximations)
const ACA_2024 = {
  benchmarkPremium: {
    age21: 290,
    age30: 330,
    age40: 370,
    age50: 520,
    age60: 780,
    age64: 850,
  },
  subsidyThresholds: {
    // As percentage of Federal Poverty Level (FPL)
    minFPL: 1.0, // 100% FPL
    maxFPL: 4.0, // 400% FPL for full subsidy, ARP extended this
    arpExtendedFPL: 8.5, // ARP: no more than 8.5% of income for benchmark
  },
  fpl2024: {
    individual: 15060,
    couple: 20440,
    perAdditional: 5380,
  },
  silverPlan: {
    deductible: 6000,
    maxOutOfPocket: 9450,
    coinsurance: 0.30,
  },
};

// Long-term care costs by state (2024 averages)
const LTC_COSTS_2024 = {
  national: {
    homeHealthAide: 6292, // monthly
    assistedLiving: 5350, // monthly
    nursingHomeSemiPrivate: 8669, // monthly
    nursingHomePrivate: 9733, // monthly
  },
  inflationRate: 0.05, // LTC costs typically inflate faster than general inflation
};

// Long-term care insurance premiums
const LTCI_PREMIUMS = {
  age50: { single: 1500, couple: 2500 },
  age55: { single: 2000, couple: 3400 },
  age60: { single: 2800, couple: 4800 },
  age65: { single: 4200, couple: 7200 },
};

interface HealthcareInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  filingStatus: 'single' | 'married';
  annualIncome: number;
  state: string;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
  hasEmployerCoverage: boolean;
  employerCoverageEndAge?: number;
  hasCOBRACoverage: boolean;
  cobraEndDate?: string;
  inflationRate: number;
  includeLTC: boolean;
  ltcPreference: 'none' | 'insurance' | 'self_insure' | 'hybrid';
}

interface HealthcarePhase {
  name: string;
  startAge: number;
  endAge: number;
  coverageType: string;
  annualPremiums: number;
  annualOutOfPocket: number;
  annualTotal: number;
  notes: string[];
}

interface HealthcareProjection {
  year: number;
  age: number;
  coverageType: string;
  premiums: number;
  outOfPocket: number;
  ltcCost: number;
  total: number;
  inflationAdjusted: number;
  cumulative: number;
}

interface HealthcareResult {
  phases: HealthcarePhase[];
  yearlyProjections: HealthcareProjection[];
  totalLifetimeCost: number;
  averageAnnualCost: number;
  peakCostYear: { year: number; cost: number };
  ltcAnalysis: {
    probabilityOfNeed: number;
    averageDuration: number;
    projectedCost: number;
    insuranceRecommendation: string;
  };
  recommendations: string[];
  savingsTarget: number;
}

// Calculate ACA premium and subsidy
function calculateACAPremium(
  age: number,
  income: number,
  filingStatus: 'single' | 'married'
): { grossPremium: number; subsidy: number; netPremium: number } {
  // Get base premium for age
  let basePremium = ACA_2024.benchmarkPremium.age64;
  if (age < 25) basePremium = ACA_2024.benchmarkPremium.age21;
  else if (age < 35) basePremium = ACA_2024.benchmarkPremium.age30;
  else if (age < 45) basePremium = ACA_2024.benchmarkPremium.age40;
  else if (age < 55) basePremium = ACA_2024.benchmarkPremium.age50;
  else if (age < 62) basePremium = ACA_2024.benchmarkPremium.age60;

  // Double for couple
  if (filingStatus === 'married') {
    basePremium *= 2;
  }

  const grossPremium = basePremium;

  // Calculate FPL percentage
  const fpl = filingStatus === 'married'
    ? ACA_2024.fpl2024.couple
    : ACA_2024.fpl2024.individual;
  const fplPercent = income / fpl;

  // Calculate subsidy (ARP extension: cap at 8.5% of income)
  let maxContribution = 0;
  if (fplPercent <= 1.5) {
    maxContribution = income * 0.02;
  } else if (fplPercent <= 2.0) {
    maxContribution = income * 0.04;
  } else if (fplPercent <= 2.5) {
    maxContribution = income * 0.065;
  } else if (fplPercent <= 3.0) {
    maxContribution = income * 0.085;
  } else {
    maxContribution = income * 0.085; // ARP: 8.5% cap
  }

  const annualGross = grossPremium * 12;
  const annualMaxContribution = Math.min(maxContribution, annualGross);
  const subsidy = Math.max(0, annualGross - annualMaxContribution);

  return {
    grossPremium: Math.round(annualGross),
    subsidy: Math.round(subsidy),
    netPremium: Math.round(annualGross - subsidy),
  };
}

// Calculate Medicare costs with IRMAA
function calculateMedicareCosts(
  income: number,
  filingStatus: 'single' | 'married',
  supplementType: 'medigap_g' | 'medigap_n' | 'advantage' = 'medigap_g'
): {
  partAPremium: number;
  partBPremium: number;
  partDPremium: number;
  supplementPremium: number;
  estimatedOutOfPocket: number;
  total: number;
  irmaaApplied: boolean;
} {
  // Find IRMAA bracket
  const brackets = filingStatus === 'married' ? IRMAA_2024.married : IRMAA_2024.single;
  const bracket = brackets.find(b => income <= b.income) || brackets[brackets.length - 1];

  const partAPremium = 0; // Assuming 40+ work credits
  const partBPremium = bracket.partBPremium * 12;
  const baseDPremium = MEDICARE_2024.partD.averagePremium * 12;
  const partDPremium = baseDPremium + (bracket.partDSurcharge * 12);

  let supplementPremium = 0;
  let estimatedOutOfPocket = 0;

  if (supplementType === 'medigap_g') {
    supplementPremium = MEDICARE_2024.medigap.planG.averagePremium * 12;
    estimatedOutOfPocket = MEDICARE_2024.partB.deductible + 500; // Minimal OOP with Plan G
  } else if (supplementType === 'medigap_n') {
    supplementPremium = MEDICARE_2024.medigap.planN.averagePremium * 12;
    estimatedOutOfPocket = MEDICARE_2024.partB.deductible + 1500; // Some cost sharing
  } else {
    supplementPremium = MEDICARE_2024.advantagePlan.averagePremium * 12;
    estimatedOutOfPocket = 3000; // Average OOP for Advantage plan users
  }

  const total = partAPremium + partBPremium + partDPremium + supplementPremium + estimatedOutOfPocket;

  return {
    partAPremium: Math.round(partAPremium),
    partBPremium: Math.round(partBPremium),
    partDPremium: Math.round(partDPremium),
    supplementPremium: Math.round(supplementPremium),
    estimatedOutOfPocket: Math.round(estimatedOutOfPocket),
    total: Math.round(total),
    irmaaApplied: income > (filingStatus === 'married' ? 206000 : 103000),
  };
}

// Calculate LTC probability and costs
function calculateLTCRisk(
  currentAge: number,
  healthStatus: string,
  gender: 'male' | 'female' = 'female'
): {
  probabilityOfNeed: number;
  averageDurationMonths: number;
  projectedCost: number;
  recommendation: string;
} {
  // Base probability of needing LTC after age 65: ~70%
  let probability = 0.70;

  // Adjust for health status
  const healthMultiplier: Record<string, number> = {
    excellent: 0.7,
    good: 0.9,
    fair: 1.2,
    poor: 1.5,
  };
  probability *= healthMultiplier[healthStatus] || 1.0;

  // Adjust for gender (women typically need more LTC)
  probability *= gender === 'female' ? 1.1 : 0.9;

  probability = Math.min(0.95, Math.max(0.3, probability));

  // Average duration
  let avgDurationMonths = gender === 'female' ? 44 : 32;
  if (healthStatus === 'poor') avgDurationMonths *= 1.3;
  if (healthStatus === 'excellent') avgDurationMonths *= 0.8;

  // Calculate projected cost (mix of care types)
  const homeCarePortion = 0.4;
  const assistedLivingPortion = 0.35;
  const nursingHomePortion = 0.25;

  const monthlyAvgCost =
    homeCarePortion * LTC_COSTS_2024.national.homeHealthAide +
    assistedLivingPortion * LTC_COSTS_2024.national.assistedLiving +
    nursingHomePortion * LTC_COSTS_2024.national.nursingHomeSemiPrivate;

  const projectedCost = monthlyAvgCost * avgDurationMonths * probability;

  // Generate recommendation
  let recommendation = '';
  if (currentAge < 55 && probability > 0.5) {
    recommendation = 'Consider long-term care insurance while premiums are lower. Hybrid life/LTC policies offer flexibility.';
  } else if (currentAge >= 55 && currentAge < 65) {
    recommendation = 'Evaluate LTCI options now - premiums increase significantly after 65. Consider a hybrid policy.';
  } else if (currentAge >= 65) {
    recommendation = 'Traditional LTCI may be expensive. Consider self-insuring with dedicated savings or asset-based policies.';
  }

  return {
    probabilityOfNeed: probability,
    averageDurationMonths: Math.round(avgDurationMonths),
    projectedCost: Math.round(projectedCost),
    recommendation,
  };
}

// Main healthcare cost projector
function projectHealthcareCosts(input: HealthcareInput): HealthcareResult {
  const phases: HealthcarePhase[] = [];
  const yearlyProjections: HealthcareProjection[] = [];
  let cumulativeCost = 0;
  let peakCost = { year: 0, cost: 0 };

  const yearsToProject = input.lifeExpectancy - input.currentAge;

  // Phase 1: Employer coverage (if applicable)
  if (input.hasEmployerCoverage) {
    const endAge = input.employerCoverageEndAge || input.retirementAge;
    phases.push({
      name: 'Employer Coverage',
      startAge: input.currentAge,
      endAge: endAge,
      coverageType: 'EMPLOYER',
      annualPremiums: 3500, // Employee contribution average
      annualOutOfPocket: 2000,
      annualTotal: 5500,
      notes: [
        'Continue employer coverage as long as possible',
        'Check COBRA eligibility for gap coverage',
      ],
    });
  }

  // Phase 2: COBRA (if applicable)
  if (input.hasCOBRACoverage) {
    phases.push({
      name: 'COBRA Coverage',
      startAge: input.employerCoverageEndAge || input.retirementAge,
      endAge: Math.min((input.employerCoverageEndAge || input.retirementAge) + 1.5, 65),
      coverageType: 'COBRA',
      annualPremiums: 15000, // Full employer premium + 2%
      annualOutOfPocket: 2500,
      annualTotal: 17500,
      notes: [
        'COBRA lasts up to 18 months',
        'Compare with ACA marketplace for better rates',
      ],
    });
  }

  // Phase 3: ACA Marketplace (pre-Medicare if needed)
  const acaStartAge = Math.max(
    input.retirementAge,
    input.employerCoverageEndAge ? input.employerCoverageEndAge + 1.5 : input.retirementAge
  );
  if (acaStartAge < 65) {
    const aca = calculateACAPremium(60, input.annualIncome, input.filingStatus);
    phases.push({
      name: 'ACA Marketplace',
      startAge: Math.ceil(acaStartAge),
      endAge: 65,
      coverageType: 'ACA',
      annualPremiums: aca.netPremium,
      annualOutOfPocket: ACA_2024.silverPlan.maxOutOfPocket * 0.4, // Assume 40% utilization
      annualTotal: aca.netPremium + ACA_2024.silverPlan.maxOutOfPocket * 0.4,
      notes: [
        `ACA subsidy: $${aca.subsidy.toLocaleString()}`,
        'Manage MAGI to maximize subsidies',
        'Consider HSA contributions before Medicare',
      ],
    });
  }

  // Phase 4: Medicare (65+)
  if (input.lifeExpectancy > 65) {
    const medicare = calculateMedicareCosts(input.annualIncome, input.filingStatus, 'medigap_g');
    phases.push({
      name: 'Medicare + Medigap',
      startAge: 65,
      endAge: input.lifeExpectancy,
      coverageType: 'MEDICARE',
      annualPremiums: medicare.partBPremium + medicare.partDPremium + medicare.supplementPremium,
      annualOutOfPocket: medicare.estimatedOutOfPocket,
      annualTotal: medicare.total,
      notes: [
        medicare.irmaaApplied ? 'IRMAA surcharges apply - consider income management' : 'No IRMAA surcharges',
        'Enroll in Medicare during Initial Enrollment Period (3 months before 65th birthday)',
        'Consider Plan G for comprehensive coverage',
      ],
    });
  }

  // Generate yearly projections
  for (let year = 1; year <= yearsToProject; year++) {
    const age = input.currentAge + year;

    // Find applicable phase
    const phase = phases.find(p => age >= p.startAge && age < p.endAge);

    let premiums = 0;
    let outOfPocket = 0;
    let coverageType = 'NONE';

    if (phase) {
      coverageType = phase.coverageType;
      // Apply healthcare inflation (typically 5-6% for healthcare)
      const healthcareInflation = Math.pow(1.055, year);
      premiums = Math.round(phase.annualPremiums * healthcareInflation);
      outOfPocket = Math.round(phase.annualOutOfPocket * healthcareInflation);
    }

    // LTC costs (typically start in late 70s/80s)
    let ltcCost = 0;
    if (input.includeLTC && age >= 80) {
      const ltcRisk = calculateLTCRisk(age, input.healthStatus);
      // Probability-weighted annual LTC cost
      const ltcInflation = Math.pow(1 + LTC_COSTS_2024.inflationRate, year);
      const expectedMonthsThisYear = ltcRisk.averageDurationMonths / (input.lifeExpectancy - 80);
      ltcCost = Math.round(
        LTC_COSTS_2024.national.assistedLiving * expectedMonthsThisYear * ltcRisk.probabilityOfNeed * ltcInflation
      );
    }

    const total = premiums + outOfPocket + ltcCost;
    cumulativeCost += total;

    if (total > peakCost.cost) {
      peakCost = { year, cost: total };
    }

    const inflationFactor = Math.pow(1 + input.inflationRate, year);

    yearlyProjections.push({
      year,
      age,
      coverageType,
      premiums,
      outOfPocket,
      ltcCost,
      total,
      inflationAdjusted: Math.round(total / inflationFactor),
      cumulative: cumulativeCost,
    });
  }

  // LTC Analysis
  const ltcAnalysis = calculateLTCRisk(input.currentAge, input.healthStatus);

  // Generate recommendations
  const recommendations: string[] = [];

  if (input.currentAge < 65 && input.retirementAge < 65) {
    recommendations.push('Plan for healthcare coverage gap between retirement and Medicare at 65.');
  }

  if (input.annualIncome > (input.filingStatus === 'married' ? 206000 : 103000)) {
    recommendations.push('Your income triggers IRMAA surcharges. Consider Roth conversions or income smoothing.');
  }

  if (input.includeLTC) {
    if (input.currentAge < 60) {
      recommendations.push('Consider long-term care insurance while premiums are affordable.');
    }
    recommendations.push(`Estimated LTC need probability: ${(ltcAnalysis.probabilityOfNeed * 100).toFixed(0)}%`);
  }

  recommendations.push('Max out HSA contributions before Medicare eligibility - funds can be used tax-free in retirement.');
  recommendations.push('Consider geographic arbitrage - healthcare costs vary significantly by state.');

  // Calculate savings target (present value of future costs)
  const discountRate = 0.05;
  const savingsTarget = yearlyProjections.reduce((pv, proj, i) => {
    return pv + proj.total / Math.pow(1 + discountRate, i + 1);
  }, 0);

  return {
    phases,
    yearlyProjections,
    totalLifetimeCost: Math.round(cumulativeCost),
    averageAnnualCost: Math.round(cumulativeCost / yearsToProject),
    peakCostYear: peakCost,
    ltcAnalysis: {
      ...ltcAnalysis,
      insuranceRecommendation: ltcAnalysis.recommendation,
    },
    recommendations,
    savingsTarget: Math.round(savingsTarget),
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

    const healthcarePlans = await prisma.retirementHealthcarePlan.findMany({
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

    return NextResponse.json({
      healthcarePlans,
      medicareCosts2024: MEDICARE_2024,
      acaCosts2024: ACA_2024,
      ltcCosts2024: LTC_COSTS_2024,
    });
  } catch (error) {
    console.error('Error fetching healthcare plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch healthcare plans' },
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
      project,
      // Projection inputs
      currentAge,
      retirementAge,
      lifeExpectancy,
      filingStatus,
      annualIncome,
      state,
      healthStatus,
      hasEmployerCoverage,
      employerCoverageEndAge,
      hasCOBRACoverage,
      cobraEndDate,
      inflationRate,
      includeLTC,
      ltcPreference,
      // Direct save inputs
      planType,
      startAge,
      endAge,
      monthlyPremium,
      annualDeductible,
      maxOutOfPocket,
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

    // Run projection if requested
    if (project) {
      const input: HealthcareInput = {
        currentAge: currentAge || plan.currentAge,
        retirementAge: retirementAge || plan.retirementAge,
        lifeExpectancy: lifeExpectancy || plan.lifeExpectancy || 90,
        filingStatus: filingStatus || 'married',
        annualIncome: annualIncome || 75000,
        state: state || 'CA',
        healthStatus: healthStatus || 'good',
        hasEmployerCoverage: hasEmployerCoverage ?? false,
        employerCoverageEndAge: employerCoverageEndAge,
        hasCOBRACoverage: hasCOBRACoverage ?? false,
        cobraEndDate: cobraEndDate,
        inflationRate: inflationRate || 0.03,
        includeLTC: includeLTC ?? true,
        ltcPreference: ltcPreference || 'hybrid',
      };

      const projection = projectHealthcareCosts(input);

      return NextResponse.json({
        projection,
        input,
      });
    }

    // Save healthcare plan
    const healthcarePlan = await prisma.retirementHealthcarePlan.create({
      data: {
        planId,
        planType: planType || 'ACA',
        startAge: startAge || plan.retirementAge,
        endAge: endAge || 65,
        monthlyPremium: monthlyPremium || 500,
        annualDeductible: annualDeductible || 3000,
        maxOutOfPocket: maxOutOfPocket || 8700,
        notes,
      },
    });

    return NextResponse.json(healthcarePlan, { status: 201 });
  } catch (error) {
    console.error('Error creating healthcare plan:', error);
    return NextResponse.json(
      { error: 'Failed to create healthcare plan' },
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

    const existing = await prisma.retirementHealthcarePlan.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Healthcare plan not found' }, { status: 404 });
    }

    const healthcarePlan = await prisma.retirementHealthcarePlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(healthcarePlan);
  } catch (error) {
    console.error('Error updating healthcare plan:', error);
    return NextResponse.json(
      { error: 'Failed to update healthcare plan' },
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
      return NextResponse.json({ error: 'Healthcare plan ID required' }, { status: 400 });
    }

    const existing = await prisma.retirementHealthcarePlan.findFirst({
      where: {
        id,
        retirementPlan: {
          userId: payload.userId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Healthcare plan not found' }, { status: 404 });
    }

    await prisma.retirementHealthcarePlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting healthcare plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete healthcare plan' },
      { status: 500 }
    );
  }
}
