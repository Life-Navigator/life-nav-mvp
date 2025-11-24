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

// Full Retirement Age based on birth year
function getFullRetirementAge(birthYear: number): { years: number; months: number } {
  if (birthYear <= 1937) return { years: 65, months: 0 };
  if (birthYear === 1938) return { years: 65, months: 2 };
  if (birthYear === 1939) return { years: 65, months: 4 };
  if (birthYear === 1940) return { years: 65, months: 6 };
  if (birthYear === 1941) return { years: 65, months: 8 };
  if (birthYear === 1942) return { years: 65, months: 10 };
  if (birthYear >= 1943 && birthYear <= 1954) return { years: 66, months: 0 };
  if (birthYear === 1955) return { years: 66, months: 2 };
  if (birthYear === 1956) return { years: 66, months: 4 };
  if (birthYear === 1957) return { years: 66, months: 6 };
  if (birthYear === 1958) return { years: 66, months: 8 };
  if (birthYear === 1959) return { years: 66, months: 10 };
  return { years: 67, months: 0 }; // 1960 and later
}

// Calculate benefit reduction/increase for claiming at different ages
function calculateBenefitAtAge(
  pia: number,
  claimAge: number,
  fra: { years: number; months: number }
): number {
  const fraAge = fra.years + fra.months / 12;
  const monthsFromFRA = Math.round((claimAge - fraAge) * 12);

  if (monthsFromFRA === 0) {
    return pia;
  } else if (monthsFromFRA < 0) {
    // Early claiming - reduction
    const monthsEarly = Math.abs(monthsFromFRA);
    let reduction = 0;

    if (monthsEarly <= 36) {
      // 5/9 of 1% per month for first 36 months
      reduction = monthsEarly * (5 / 9 / 100);
    } else {
      // 5/9 of 1% for first 36 months + 5/12 of 1% for additional months
      reduction = 36 * (5 / 9 / 100) + (monthsEarly - 36) * (5 / 12 / 100);
    }
    return pia * (1 - reduction);
  } else {
    // Delayed claiming - increase (8% per year after FRA)
    const monthsDelayed = monthsFromFRA;
    const increase = monthsDelayed * (8 / 12 / 100);
    return pia * (1 + increase);
  }
}

// Calculate break-even age between two claiming strategies
function calculateBreakEvenAge(
  pia: number,
  earlyAge: number,
  laterAge: number,
  fra: { years: number; months: number },
  cola: number = 0.025
): number {
  const earlyBenefit = calculateBenefitAtAge(pia, earlyAge, fra);
  const laterBenefit = calculateBenefitAtAge(pia, laterAge, fra);

  let cumulativeEarly = 0;
  let cumulativeLater = 0;
  let currentEarlyBenefit = earlyBenefit;
  let currentLaterBenefit = laterBenefit;

  // Start from the later claiming age
  for (let age = laterAge; age <= 100; age++) {
    // Calculate years of benefits for each strategy
    const yearsEarly = age - earlyAge;
    const yearsLater = age - laterAge;

    if (yearsEarly > 0) {
      cumulativeEarly = currentEarlyBenefit * 12 * (yearsEarly > 1 ? (Math.pow(1 + cola, yearsEarly) - 1) / cola : 1);
    }
    if (yearsLater > 0) {
      cumulativeLater = currentLaterBenefit * 12 * (yearsLater > 1 ? (Math.pow(1 + cola, yearsLater) - 1) / cola : 1);
    }

    if (cumulativeLater >= cumulativeEarly && yearsLater > 0) {
      return age;
    }
  }

  return 100; // Never breaks even
}

// Calculate lifetime benefits
function calculateLifetimeBenefits(
  pia: number,
  claimAge: number,
  lifeExpectancy: number,
  fra: { years: number; months: number },
  cola: number = 0.025
): number {
  const monthlyBenefit = calculateBenefitAtAge(pia, claimAge, fra);
  const yearsReceiving = lifeExpectancy - claimAge;

  if (yearsReceiving <= 0) return 0;

  // Calculate with COLA adjustments
  let total = 0;
  let currentBenefit = monthlyBenefit * 12;
  for (let year = 0; year < yearsReceiving; year++) {
    total += currentBenefit;
    currentBenefit *= (1 + cola);
  }

  return total;
}

// Optimize claiming strategy for couple
function optimizeCoupleSS(
  primaryPIA: number,
  spousePIA: number,
  primaryAge: number,
  spouseAge: number,
  primaryFRA: { years: number; months: number },
  spouseFRA: { years: number; months: number },
  primaryLifeExpectancy: number,
  spouseLifeExpectancy: number,
  cola: number = 0.025
): {
  optimalPrimaryAge: number;
  optimalSpouseAge: number;
  totalLifetimeBenefits: number;
  strategy: string;
  breakdownByAge: { age: number; primaryBenefit: number; spouseBenefit: number; total: number }[];
} {
  let bestTotal = 0;
  let bestPrimaryAge = 67;
  let bestSpouseAge = 67;
  let bestStrategy = "Both at FRA";

  // Test all combinations of claiming ages
  for (let pAge = 62; pAge <= 70; pAge++) {
    for (let sAge = 62; sAge <= 70; sAge++) {
      const primaryLifetime = calculateLifetimeBenefits(primaryPIA, pAge, primaryLifeExpectancy, primaryFRA, cola);
      const spouseLifetime = calculateLifetimeBenefits(spousePIA, sAge, spouseLifeExpectancy, spouseFRA, cola);

      // Calculate spousal benefit if applicable (50% of higher earner's PIA at FRA, minus own benefit)
      const higherPIA = Math.max(primaryPIA, spousePIA);
      const spousalBoost = higherPIA / 2;

      // Add survivor benefits (the survivor gets the higher of the two benefits)
      const primaryMonthly = calculateBenefitAtAge(primaryPIA, pAge, primaryFRA);
      const spouseMonthly = calculateBenefitAtAge(spousePIA, sAge, spouseFRA);
      const survivorBenefit = Math.max(primaryMonthly, spouseMonthly);

      // Estimate survivor years (assume one dies at their life expectancy, other lives 5 more years)
      const survivorYears = 5;
      const survivorTotal = survivorBenefit * 12 * survivorYears;

      const total = primaryLifetime + spouseLifetime + survivorTotal;

      if (total > bestTotal) {
        bestTotal = total;
        bestPrimaryAge = pAge;
        bestSpouseAge = sAge;

        if (pAge === 70 && sAge === 70) {
          bestStrategy = "Both delay to 70 for maximum benefits";
        } else if (pAge === 70) {
          bestStrategy = `Higher earner delays to 70, spouse claims at ${sAge}`;
        } else if (sAge === 70) {
          bestStrategy = `Lower earner delays to 70, primary claims at ${pAge}`;
        } else if (pAge === 62 || sAge === 62) {
          bestStrategy = "Early claiming with life expectancy considered";
        } else {
          bestStrategy = `Optimized: Primary at ${pAge}, Spouse at ${sAge}`;
        }
      }
    }
  }

  // Calculate breakdown by age
  const breakdownByAge: { age: number; primaryBenefit: number; spouseBenefit: number; total: number }[] = [];
  const startAge = Math.min(bestPrimaryAge, bestSpouseAge);

  let pBenefit = 0;
  let sBenefit = 0;

  for (let age = startAge; age <= 95; age++) {
    const primaryCurAge = primaryAge + (age - startAge);
    const spouseCurAge = spouseAge + (age - startAge);

    if (primaryCurAge >= bestPrimaryAge) {
      pBenefit = calculateBenefitAtAge(primaryPIA, bestPrimaryAge, primaryFRA) * 12 *
        Math.pow(1 + cola, primaryCurAge - bestPrimaryAge);
    }
    if (spouseCurAge >= bestSpouseAge) {
      sBenefit = calculateBenefitAtAge(spousePIA, bestSpouseAge, spouseFRA) * 12 *
        Math.pow(1 + cola, spouseCurAge - bestSpouseAge);
    }

    breakdownByAge.push({
      age,
      primaryBenefit: Math.round(pBenefit),
      spouseBenefit: Math.round(sBenefit),
      total: Math.round(pBenefit + sBenefit),
    });
  }

  return {
    optimalPrimaryAge: bestPrimaryAge,
    optimalSpouseAge: bestSpouseAge,
    totalLifetimeBenefits: Math.round(bestTotal),
    strategy: bestStrategy,
    breakdownByAge,
  };
}

// GET /api/retirement/social-security - Get SS benefits and optimization
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const plan = await prisma.retirementPlan.findUnique({
      where: { id: planId },
      include: { socialSecurity: true },
    });

    if (!plan || plan.userId !== userId) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const ssRecords = plan.socialSecurity;
    const currentYear = new Date().getFullYear();

    // Calculate optimizations for each SS record
    const optimizations = ssRecords.map(ss => {
      const birthYear = currentYear - plan.currentAge;
      const fra = getFullRetirementAge(birthYear);

      const pia = ss.currentPIA || ss.estimatedPIA || 2000;

      const benefitAt62 = calculateBenefitAtAge(pia, 62, fra) * 12;
      const benefitAtFRA = calculateBenefitAtAge(pia, fra.years + fra.months / 12, fra) * 12;
      const benefitAt70 = calculateBenefitAtAge(pia, 70, fra) * 12;

      const lifetime62 = calculateLifetimeBenefits(pia, 62, plan.lifeExpectancy, fra);
      const lifetimeFRA = calculateLifetimeBenefits(pia, fra.years + fra.months / 12, plan.lifeExpectancy, fra);
      const lifetime70 = calculateLifetimeBenefits(pia, 70, plan.lifeExpectancy, fra);

      const breakEven62vsFRA = calculateBreakEvenAge(pia, 62, fra.years + fra.months / 12, fra);
      const breakEven62vs70 = calculateBreakEvenAge(pia, 62, 70, fra);
      const breakEvenFRAvs70 = calculateBreakEvenAge(pia, fra.years + fra.months / 12, 70, fra);

      // Determine optimal age based on life expectancy
      let optimalAge = fra.years + fra.months / 12;
      let optimalBenefit = benefitAtFRA;
      let optimalLifetime = lifetimeFRA;
      let recommendation = "";

      if (plan.lifeExpectancy <= breakEven62vs70) {
        optimalAge = 62;
        optimalBenefit = benefitAt62;
        optimalLifetime = lifetime62;
        recommendation = "Given your life expectancy, claiming at 62 maximizes lifetime benefits.";
      } else if (plan.lifeExpectancy <= breakEvenFRAvs70) {
        recommendation = `Claiming at FRA (${fra.years}) is optimal for your situation.`;
      } else {
        optimalAge = 70;
        optimalBenefit = benefitAt70;
        optimalLifetime = lifetime70;
        recommendation = "Delaying to 70 maximizes your lifetime benefits given your life expectancy.";
      }

      return {
        id: ss.id,
        owner: ss.owner,
        pia,
        fullRetirementAge: fra,
        benefits: {
          at62: Math.round(benefitAt62),
          atFRA: Math.round(benefitAtFRA),
          at70: Math.round(benefitAt70),
        },
        lifetimeValues: {
          claiming62: Math.round(lifetime62),
          claimingFRA: Math.round(lifetimeFRA),
          claiming70: Math.round(lifetime70),
        },
        breakEvenAges: {
          age62vsFRA: breakEven62vsFRA,
          age62vs70: breakEven62vs70,
          fraVs70: breakEvenFRAvs70,
        },
        optimal: {
          claimAge: optimalAge,
          annualBenefit: Math.round(optimalBenefit),
          lifetimeBenefit: Math.round(optimalLifetime),
          recommendation,
        },
      };
    });

    // Couple optimization if spouse data exists
    let coupleOptimization = null;
    if (plan.includeSpouse && ssRecords.length >= 2) {
      const primary = ssRecords.find(s => s.owner === "primary");
      const spouse = ssRecords.find(s => s.owner === "spouse");

      if (primary && spouse) {
        const primaryBirthYear = currentYear - plan.currentAge;
        const spouseBirthYear = currentYear - (plan.spouseCurrentAge || plan.currentAge);

        coupleOptimization = optimizeCoupleSS(
          primary.currentPIA || primary.estimatedPIA || 2000,
          spouse.currentPIA || spouse.estimatedPIA || 1500,
          plan.currentAge,
          plan.spouseCurrentAge || plan.currentAge,
          getFullRetirementAge(primaryBirthYear),
          getFullRetirementAge(spouseBirthYear),
          plan.lifeExpectancy,
          plan.spouseLifeExpectancy || plan.lifeExpectancy
        );
      }
    }

    return NextResponse.json({
      socialSecurity: ssRecords,
      optimizations,
      coupleOptimization,
      assumptions: {
        cola: 2.5,
        discountRate: 3,
        lifeExpectancy: plan.lifeExpectancy,
      },
    });
  } catch (error) {
    console.error("[Social Security API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch social security data" }, { status: 500 });
  }
}

// POST /api/retirement/social-security - Create or update SS benefit record
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      planId,
      owner = "primary",
      currentPIA,
      estimatedPIA,
      yearsOfEarnings = 35,
      averageIndexedMonthlyEarnings,
      plannedClaimAge,
      claimingStrategy = "optimal",
      expectedCOLA = 2.5,
      workingWhileClaiming = false,
      expectedEarningsBeforeFRA,
      notes,
    } = body;

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Verify plan ownership
    const plan = await prisma.retirementPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || plan.userId !== userId) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Calculate FRA and benefits
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - (owner === "spouse" ? (plan.spouseCurrentAge || plan.currentAge) : plan.currentAge);
    const fra = getFullRetirementAge(birthYear);
    const pia = currentPIA || estimatedPIA || 2000;

    const ssRecord = await prisma.socialSecurityBenefit.create({
      data: {
        retirementPlanId: planId,
        owner,
        currentPIA,
        estimatedPIA,
        yearsOfEarnings,
        averageIndexedMonthlyEarnings,
        fullRetirementAge: fra.years,
        plannedClaimAge,
        claimingStrategy,
        benefitAtEarly: calculateBenefitAtAge(pia, 62, fra) * 12,
        benefitAtFRA: calculateBenefitAtAge(pia, fra.years + fra.months / 12, fra) * 12,
        benefitAtMax: calculateBenefitAtAge(pia, 70, fra) * 12,
        expectedCOLA,
        workingWhileClaiming,
        expectedEarningsBeforeFRA,
        notes,
      },
    });

    return NextResponse.json({ socialSecurity: ssRecord }, { status: 201 });
  } catch (error) {
    console.error("[Social Security API] Error creating:", error);
    return NextResponse.json({ error: "Failed to create social security record" }, { status: 500 });
  }
}

// PUT /api/retirement/social-security - Update SS record
export async function PUT(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
    }

    const existing = await prisma.socialSecurityBenefit.findUnique({
      where: { id },
      include: { retirementPlan: true },
    });

    if (!existing || existing.retirementPlan.userId !== userId) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Recalculate benefits if PIA changed
    if (updateData.currentPIA || updateData.estimatedPIA) {
      const currentYear = new Date().getFullYear();
      const plan = existing.retirementPlan;
      const birthYear = currentYear - (existing.owner === "spouse" ? (plan.spouseCurrentAge || plan.currentAge) : plan.currentAge);
      const fra = getFullRetirementAge(birthYear);
      const pia = updateData.currentPIA || updateData.estimatedPIA || existing.currentPIA || existing.estimatedPIA || 2000;

      updateData.benefitAtEarly = calculateBenefitAtAge(pia, 62, fra) * 12;
      updateData.benefitAtFRA = calculateBenefitAtAge(pia, fra.years + fra.months / 12, fra) * 12;
      updateData.benefitAtMax = calculateBenefitAtAge(pia, 70, fra) * 12;
    }

    const ssRecord = await prisma.socialSecurityBenefit.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ socialSecurity: ssRecord });
  } catch (error) {
    console.error("[Social Security API] Error updating:", error);
    return NextResponse.json({ error: "Failed to update social security record" }, { status: 500 });
  }
}

// DELETE /api/retirement/social-security
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
    }

    const existing = await prisma.socialSecurityBenefit.findUnique({
      where: { id },
      include: { retirementPlan: true },
    });

    if (!existing || existing.retirementPlan.userId !== userId) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await prisma.socialSecurityBenefit.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Social Security API] Error deleting:", error);
    return NextResponse.json({ error: "Failed to delete social security record" }, { status: 500 });
  }
}
