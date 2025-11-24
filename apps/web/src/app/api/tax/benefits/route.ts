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

// GET /api/tax/benefits - Get employer benefits with analysis
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const currentOnly = searchParams.get("current") === "true";

    const whereClause = currentOnly
      ? { userId, isCurrentEmployer: true }
      : { userId };

    const benefits = await prisma.employerBenefits.findMany({
      where: whereClause,
      include: {
        healthBenefits: true,
        retirementBenefits: true,
        additionalBenefits: true,
        deductionOpportunities: {
          where: { status: { in: ["identified", "considering", "planned"] } },
          orderBy: { potentialSavings: "desc" },
        },
      },
      orderBy: { isCurrentEmployer: "desc" },
    });

    // Calculate optimization opportunities from benefits
    const opportunities: {
      category: string;
      title: string;
      description: string;
      potentialSavings: number;
      source: string;
      actionRequired: string;
      priority: number;
    }[] = [];

    for (const benefit of benefits) {
      if (!benefit.isCurrentEmployer) continue;

      // Analyze 401k match opportunities
      for (const retirement of benefit.retirementBenefits) {
        if (retirement.planType === "401k" || retirement.planType === "roth_401k") {
          const currentContrib = retirement.employeeContributionPct || 0;
          const matchLimit = retirement.employerMatchLimit || 0;

          if (currentContrib < matchLimit && benefit.baseSalary) {
            const additionalContrib = (matchLimit - currentContrib) / 100 * benefit.baseSalary;
            const matchPct = retirement.employerMatchPct || 50;
            const freeMatch = additionalContrib * (matchPct / 100);

            opportunities.push({
              category: "retirement",
              title: "Capture Full 401(k) Match",
              description: `You're leaving money on the table! Increase your 401(k) contribution to ${matchLimit}% to capture the full employer match.`,
              potentialSavings: freeMatch,
              source: "employer_benefit",
              actionRequired: `Increase 401(k) contribution from ${currentContrib}% to ${matchLimit}% to receive an additional $${Math.round(freeMatch).toLocaleString()} in employer matching.`,
              priority: 10, // Highest priority - free money
            });
          }

          // Mega backdoor Roth opportunity
          if (retirement.afterTaxContribAllowed && retirement.inPlanRothConversion) {
            opportunities.push({
              category: "retirement",
              title: "Mega Backdoor Roth Available",
              description: "Your plan allows after-tax contributions with in-plan Roth conversion - a powerful wealth-building strategy.",
              potentialSavings: 23000 * 0.22, // Estimated tax savings
              source: "employer_benefit",
              actionRequired: "Consider contributing after-tax dollars beyond the $23,000 limit and converting to Roth for tax-free growth.",
              priority: 7,
            });
          }
        }

        // ESPP opportunity
        if (retirement.planType === "espp" && !retirement.isEnrolled) {
          const discount = retirement.esppDiscount || 15;
          const maxContrib = retirement.esppContributionLimit || 25000;
          const minReturn = discount / (100 - discount) * 100; // Immediate return on investment

          opportunities.push({
            category: "investment",
            title: "Enroll in ESPP",
            description: `Your ESPP offers a ${discount}% discount on company stock - a guaranteed ${minReturn.toFixed(1)}% return!`,
            potentialSavings: maxContrib * (discount / 100),
            source: "employer_benefit",
            actionRequired: `Enroll in the Employee Stock Purchase Plan during the next enrollment period to receive a ${discount}% discount on stock purchases.`,
            priority: 8,
          });
        }
      }

      // HSA opportunities
      for (const health of benefit.healthBenefits) {
        if (health.hsaEligible && health.planType === "medical") {
          const hsaLimit = health.coverageLevel === "family" ? 8300 : 4150;
          const employerContrib = health.hsaEmployerContribution || 0;
          const taxSavings = (hsaLimit - employerContrib) * 0.30; // Combined tax savings estimate

          opportunities.push({
            category: "healthcare",
            title: "Maximize HSA Contributions",
            description: "HSA contributions are triple tax-advantaged: tax-deductible, grow tax-free, and withdrawals for medical expenses are tax-free.",
            potentialSavings: taxSavings,
            source: "employer_benefit",
            actionRequired: `Contribute the maximum $${hsaLimit.toLocaleString()} to your HSA (employer contributes $${employerContrib.toLocaleString()}).`,
            priority: 9,
          });
        }

        // FSA opportunity
        if (health.planType === "fsa" && health.fsaLimit && !health.isEnrolled) {
          opportunities.push({
            category: "healthcare",
            title: "Consider Healthcare FSA",
            description: "Use pre-tax dollars for predictable medical expenses you know you'll have.",
            potentialSavings: (health.fsaLimit || 3050) * 0.25,
            source: "employer_benefit",
            actionRequired: "Estimate your annual medical expenses and enroll in the FSA during open enrollment.",
            priority: 5,
          });
        }

        // Dependent Care FSA
        if (health.planType === "dcfsa" && health.dcfsaLimit && !health.isEnrolled) {
          opportunities.push({
            category: "healthcare",
            title: "Dependent Care FSA",
            description: "Save on childcare or dependent care expenses with pre-tax dollars.",
            potentialSavings: (health.dcfsaLimit || 5000) * 0.25,
            source: "employer_benefit",
            actionRequired: "If you have qualifying dependent care expenses, enroll in the DCFSA for significant tax savings.",
            priority: 6,
          });
        }
      }

      // Education benefits
      for (const additional of benefit.additionalBenefits) {
        if (additional.category === "education") {
          if (additional.tuitionReimbursement && additional.usedAmount !== additional.maxAmount) {
            const remaining = (additional.maxAmount || additional.tuitionReimbursement) - (additional.usedAmount || 0);
            opportunities.push({
              category: "education",
              title: "Use Tuition Reimbursement",
              description: "Your employer offers tuition reimbursement - invest in yourself while they foot the bill!",
              potentialSavings: remaining,
              source: "employer_benefit",
              actionRequired: `You have $${remaining.toLocaleString()} in tuition reimbursement available. Consider courses or certifications that advance your career.`,
              priority: 6,
            });
          }
        }

        // Commuter benefits
        if (additional.category === "commuter" && !additional.isEnrolled) {
          const monthlyLimit = additional.commuterBenefit || 315;
          opportunities.push({
            category: "commuter",
            title: "Enroll in Commuter Benefits",
            description: "Use pre-tax dollars for transit or parking expenses.",
            potentialSavings: monthlyLimit * 12 * 0.25,
            source: "employer_benefit",
            actionRequired: `Enroll in commuter benefits to save up to $${Math.round(monthlyLimit * 12 * 0.25).toLocaleString()} annually on commuting costs.`,
            priority: 4,
          });
        }
      }
    }

    // Sort opportunities by priority and potential savings
    opportunities.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.potentialSavings - a.potentialSavings;
    });

    const totalPotentialSavings = opportunities.reduce((sum, o) => sum + o.potentialSavings, 0);

    return NextResponse.json({
      benefits,
      opportunities,
      totalPotentialSavings,
      summary: {
        employerCount: benefits.length,
        currentEmployer: benefits.find(b => b.isCurrentEmployer),
        healthPlansCount: benefits.reduce((sum, b) => sum + b.healthBenefits.length, 0),
        retirementPlansCount: benefits.reduce((sum, b) => sum + b.retirementBenefits.length, 0),
        additionalBenefitsCount: benefits.reduce((sum, b) => sum + b.additionalBenefits.length, 0),
        opportunitiesCount: opportunities.length,
      },
    });
  } catch (error) {
    console.error("[Benefits API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch benefits" }, { status: 500 });
  }
}

// POST /api/tax/benefits - Create or update employer benefits
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      employerName,
      isCurrentEmployer = true,
      startDate,
      endDate,
      baseSalary,
      bonusTarget,
      bonusStructure,
      signOnBonus,
      relocationBonus,
      stockGrants,
      vestingSchedule,
      offerLetterUrl,
      offerLetterFileName,
      offerLetterParsedData,
      benefitsSummaryUrl,
      benefitsSummaryFileName,
      benefitsSummaryParsedData,
      notes,
      healthBenefits = [],
      retirementBenefits = [],
      additionalBenefits = [],
    } = body;

    // If setting as current employer, unset other current employers
    if (isCurrentEmployer) {
      await prisma.employerBenefits.updateMany({
        where: { userId, isCurrentEmployer: true },
        data: { isCurrentEmployer: false },
      });
    }

    const benefitsData = {
      userId,
      employerName,
      isCurrentEmployer,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      baseSalary,
      bonusTarget,
      bonusStructure,
      signOnBonus,
      relocationBonus,
      stockGrants,
      vestingSchedule,
      offerLetterUrl,
      offerLetterFileName,
      offerLetterUploadedAt: offerLetterUrl ? new Date() : null,
      offerLetterParsedData,
      benefitsSummaryUrl,
      benefitsSummaryFileName,
      benefitsSummaryUploadedAt: benefitsSummaryUrl ? new Date() : null,
      benefitsSummaryParsedData,
      notes,
    };

    let employerBenefits;
    if (id) {
      // Update existing
      employerBenefits = await prisma.employerBenefits.update({
        where: { id },
        data: benefitsData,
      });

      // Delete and recreate nested benefits for simplicity
      await prisma.healthBenefit.deleteMany({ where: { employerBenefitsId: id } });
      await prisma.retirementBenefit.deleteMany({ where: { employerBenefitsId: id } });
      await prisma.additionalBenefit.deleteMany({ where: { employerBenefitsId: id } });
    } else {
      // Create new
      employerBenefits = await prisma.employerBenefits.create({
        data: benefitsData,
      });
    }

    // Create health benefits
    if (healthBenefits.length > 0) {
      await prisma.healthBenefit.createMany({
        data: healthBenefits.map((hb: Record<string, unknown>) => ({
          ...hb,
          employerBenefitsId: employerBenefits.id,
        })),
      });
    }

    // Create retirement benefits
    if (retirementBenefits.length > 0) {
      await prisma.retirementBenefit.createMany({
        data: retirementBenefits.map((rb: Record<string, unknown>) => ({
          ...rb,
          employerBenefitsId: employerBenefits.id,
        })),
      });
    }

    // Create additional benefits
    if (additionalBenefits.length > 0) {
      await prisma.additionalBenefit.createMany({
        data: additionalBenefits.map((ab: Record<string, unknown>) => ({
          ...ab,
          employerBenefitsId: employerBenefits.id,
        })),
      });
    }

    // Fetch complete record
    const result = await prisma.employerBenefits.findUnique({
      where: { id: employerBenefits.id },
      include: {
        healthBenefits: true,
        retirementBenefits: true,
        additionalBenefits: true,
      },
    });

    return NextResponse.json({ benefits: result }, { status: id ? 200 : 201 });
  } catch (error) {
    console.error("[Benefits API] Error saving:", error);
    return NextResponse.json({ error: "Failed to save benefits" }, { status: 500 });
  }
}

// DELETE /api/tax/benefits - Delete employer benefits
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Benefits ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.employerBenefits.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Benefits not found" }, { status: 404 });
    }

    await prisma.employerBenefits.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Benefits API] Error deleting:", error);
    return NextResponse.json({ error: "Failed to delete benefits" }, { status: 500 });
  }
}
