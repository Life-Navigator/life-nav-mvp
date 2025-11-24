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

// Strategy templates with goal alignment
const strategyTemplates = {
  maximize_401k: {
    name: "Maximize 401(k) Contributions",
    category: "retirement",
    description: "Contribute the maximum $23,000 (plus $7,500 catch-up if 50+) to reduce taxable income and build retirement wealth.",
    complexity: "simple",
    riskLevel: "low",
    timeHorizon: "annual",
    recurringBenefit: true,
    goalCategories: ["retirement", "tax_reduction"],
    prerequisites: ["Employer offers 401(k)", "Have sufficient income"],
    implementationSteps: [
      "Review current 401(k) contribution rate",
      "Calculate amount needed to reach $23,000 limit",
      "Update payroll contribution through HR/benefits portal",
      "Verify changes reflect in next paycheck",
    ],
  },
  roth_conversion_ladder: {
    name: "Roth Conversion Ladder",
    category: "retirement",
    description: "Systematically convert traditional IRA to Roth IRA during lower-income years for tax-free growth and withdrawals.",
    complexity: "complex",
    riskLevel: "medium",
    timeHorizon: "multi_year",
    recurringBenefit: true,
    goalCategories: ["retirement", "tax_reduction", "wealth_building"],
    prerequisites: ["Traditional IRA balance", "Expected future higher tax rates", "5+ years until needed"],
    implementationSteps: [
      "Calculate current year taxable income",
      "Determine space remaining in current tax bracket",
      "Convert that amount from Traditional to Roth IRA",
      "Pay taxes owed from non-retirement funds",
      "Repeat annually until conversion complete",
    ],
  },
  tax_loss_harvesting: {
    name: "Tax-Loss Harvesting",
    category: "investment",
    description: "Strategically sell investments at a loss to offset capital gains and reduce tax liability.",
    complexity: "moderate",
    riskLevel: "low",
    timeHorizon: "annual",
    recurringBenefit: true,
    goalCategories: ["investment", "tax_reduction"],
    prerequisites: ["Taxable investment account", "Unrealized losses available"],
    implementationSteps: [
      "Review investment portfolio for unrealized losses",
      "Identify positions to sell (avoid wash sale rule)",
      "Sell losing positions before year end",
      "Use losses to offset gains + $3,000 ordinary income",
      "Consider similar replacement investments after 31 days",
    ],
  },
  charitable_bunching: {
    name: "Charitable Donation Bunching",
    category: "charitable",
    description: "Bundle 2-3 years of charitable donations into one year to exceed standard deduction and itemize.",
    complexity: "moderate",
    riskLevel: "low",
    timeHorizon: "multi_year",
    recurringBenefit: true,
    goalCategories: ["charitable", "tax_reduction"],
    prerequisites: ["Regular charitable giving", "Itemized deductions near standard deduction threshold"],
    implementationSteps: [
      "Calculate annual charitable giving amount",
      "Determine if bunching would exceed standard deduction",
      "Consider Donor Advised Fund for convenience",
      "Make larger donation in bunching year",
      "Take standard deduction in off years",
    ],
  },
  hsa_maximization: {
    name: "HSA Triple Tax Advantage",
    category: "healthcare",
    description: "Maximize HSA contributions for triple tax benefits: deductible, tax-free growth, tax-free withdrawals for medical.",
    complexity: "simple",
    riskLevel: "low",
    timeHorizon: "annual",
    recurringBenefit: true,
    goalCategories: ["healthcare", "retirement", "tax_reduction"],
    prerequisites: ["High-deductible health plan (HDHP)", "HSA eligibility"],
    implementationSteps: [
      "Verify HDHP enrollment and HSA eligibility",
      "Set contribution to maximum ($4,150 individual / $8,300 family)",
      "Invest HSA funds beyond emergency reserve",
      "Pay medical expenses out of pocket if possible",
      "Save receipts for future tax-free reimbursement",
    ],
  },
  mega_backdoor_roth: {
    name: "Mega Backdoor Roth",
    category: "retirement",
    description: "Contribute after-tax dollars to 401(k) and convert to Roth for additional $46,000+ in Roth savings annually.",
    complexity: "expert",
    riskLevel: "low",
    timeHorizon: "annual",
    recurringBenefit: true,
    goalCategories: ["retirement", "wealth_building"],
    prerequisites: ["401(k) allows after-tax contributions", "In-plan Roth conversion available", "High income"],
    implementationSteps: [
      "Verify plan allows after-tax contributions",
      "Calculate maximum after-tax contribution space",
      "Set up after-tax contributions through payroll",
      "Execute in-plan Roth conversion (ideally automatic)",
      "Track basis for tax reporting purposes",
    ],
  },
  s_corp_election: {
    name: "S-Corp Election",
    category: "business",
    description: "Elect S-Corp status to reduce self-employment tax by splitting income between salary and distributions.",
    complexity: "expert",
    riskLevel: "medium",
    timeHorizon: "multi_year",
    recurringBenefit: true,
    goalCategories: ["business", "tax_reduction"],
    prerequisites: ["Self-employment income > $50k", "LLC or eligible entity", "Reasonable salary determination"],
    implementationSteps: [
      "Consult tax professional about eligibility",
      "Determine reasonable salary based on industry standards",
      "File Form 2553 for S-Corp election",
      "Set up payroll for officer salary",
      "Take remaining profits as distributions (no SE tax)",
    ],
  },
  qualified_opportunity_zone: {
    name: "Qualified Opportunity Zone Investment",
    category: "investment",
    description: "Defer and potentially reduce capital gains taxes by investing in Qualified Opportunity Zone funds.",
    complexity: "expert",
    riskLevel: "high",
    timeHorizon: "lifetime",
    recurringBenefit: false,
    goalCategories: ["investment", "tax_reduction", "real_estate"],
    prerequisites: ["Recent capital gains to defer", "10+ year investment horizon", "Risk tolerance"],
    implementationSteps: [
      "Identify capital gains eligible for deferral",
      "Research Qualified Opportunity Zone funds",
      "Complete due diligence on specific investments",
      "Invest within 180 days of gain recognition",
      "Hold for 10+ years for maximum tax benefit",
    ],
  },
};

// GET /api/tax/strategies - Get strategies with goal alignment
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    // Get user's goals for alignment scoring
    const goals = await prisma.goal.findMany({
      where: { userId, status: { in: ["active", "in_progress"] } },
    });

    // Get existing strategies
    const profile = await prisma.taxProfile.findUnique({
      where: { userId_taxYear: { userId, taxYear: year } },
    });

    const whereClause: Record<string, unknown> = { userId };
    if (category) whereClause.category = category;
    if (status) whereClause.currentStatus = status;

    const existingStrategies = await prisma.taxStrategy.findMany({
      where: whereClause,
      include: { milestones: { orderBy: { order: "asc" } } },
      orderBy: [{ currentStatus: "asc" }, { estimatedAnnualSavings: "desc" }],
    });

    // Get tax estimate for context
    const estimate = profile ? await prisma.taxEstimate.findFirst({
      where: { taxProfileId: profile.id },
      orderBy: { calculatedAt: "desc" },
    }) : null;

    // Generate recommended strategies based on profile
    const recommendations: Array<{
      template: keyof typeof strategyTemplates;
      strategy: typeof strategyTemplates[keyof typeof strategyTemplates];
      alignmentScore: number;
      alignedGoals: string[];
      estimatedSavings: number;
      reason: string;
    }> = [];

    const marginalRate = estimate?.marginalRate || 22;
    const taxableIncome = estimate?.taxableIncome || 0;

    // Check each template for relevance
    for (const [key, template] of Object.entries(strategyTemplates)) {
      const alignedGoals = goals.filter(g =>
        template.goalCategories.some(cat =>
          g.category?.toLowerCase().includes(cat) || g.title?.toLowerCase().includes(cat)
        )
      );

      const alignmentScore = Math.min(100, alignedGoals.length * 25);
      let estimatedSavings = 0;
      let reason = "";

      switch (key) {
        case "maximize_401k":
          estimatedSavings = 23000 * (marginalRate / 100);
          reason = "Reduces taxable income by up to $23,000";
          break;
        case "roth_conversion_ladder":
          if (marginalRate <= 22) {
            estimatedSavings = 10000 * 0.10; // Future tax savings estimate
            reason = "Your current marginal rate is relatively low - good time to convert";
          }
          break;
        case "tax_loss_harvesting":
          estimatedSavings = 3000 * (marginalRate / 100);
          reason = "Offset up to $3,000 of ordinary income plus capital gains";
          break;
        case "charitable_bunching":
          estimatedSavings = 5000 * (marginalRate / 100);
          reason = "Could help you exceed standard deduction threshold";
          break;
        case "hsa_maximization":
          estimatedSavings = 4150 * (marginalRate / 100 + 0.0765 + 0.05); // Income + FICA + state est
          reason = "Triple tax advantage - immediate deduction, tax-free growth, tax-free withdrawals";
          break;
        case "mega_backdoor_roth":
          if (taxableIncome > 150000) {
            estimatedSavings = 46000 * 0.15; // Future tax-free growth estimate
            reason = "High income makes mega backdoor Roth valuable for tax-free retirement wealth";
          }
          break;
        case "s_corp_election":
          if (taxableIncome > 60000) {
            estimatedSavings = taxableIncome * 0.4 * 0.0765 * 2; // SE tax savings estimate
            reason = "Self-employment income could save significantly on SE tax";
          }
          break;
      }

      if (estimatedSavings > 0) {
        recommendations.push({
          template: key as keyof typeof strategyTemplates,
          strategy: template,
          alignmentScore,
          alignedGoals: alignedGoals.map(g => g.title),
          estimatedSavings: Math.round(estimatedSavings),
          reason,
        });
      }
    }

    // Sort by alignment score then savings
    recommendations.sort((a, b) => {
      if (b.alignmentScore !== a.alignmentScore) return b.alignmentScore - a.alignmentScore;
      return b.estimatedSavings - a.estimatedSavings;
    });

    return NextResponse.json({
      strategies: existingStrategies,
      recommendations: recommendations.slice(0, 5),
      templates: strategyTemplates,
      summary: {
        activeStrategies: existingStrategies.filter(s => s.currentStatus === "in_progress").length,
        completedStrategies: existingStrategies.filter(s => s.currentStatus === "completed").length,
        totalEstimatedSavings: existingStrategies.reduce((sum, s) => sum + (s.estimatedAnnualSavings || 0), 0),
        recommendationCount: recommendations.length,
        topRecommendation: recommendations[0] || null,
      },
    });
  } catch (error) {
    console.error("[Tax Strategies API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch strategies" }, { status: 500 });
  }
}

// POST /api/tax/strategies - Create or start a strategy
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      templateKey,
      taxYear = new Date().getFullYear(),
      name,
      category,
      description,
      estimatedAnnualSavings,
      estimatedLifetimeSavings,
      implementationCost,
      complexity,
      riskLevel,
      timeHorizon,
      alignedGoalIds = [],
      milestones = [],
      notes,
    } = body;

    // Get or create profile
    const profile = await prisma.taxProfile.upsert({
      where: { userId_taxYear: { userId, taxYear } },
      update: {},
      create: { userId, taxYear, filingStatus: "single", status: "draft" },
    });

    // Use template if provided
    const template = templateKey ? strategyTemplates[templateKey as keyof typeof strategyTemplates] : null;

    const strategy = await prisma.taxStrategy.create({
      data: {
        userId,
        taxProfileId: profile.id,
        name: name || template?.name || "Custom Strategy",
        category: category || template?.category || "other",
        description: description || template?.description || "",
        currentStatus: "not_started",
        implementationPlan: template?.implementationSteps || null,
        estimatedAnnualSavings,
        estimatedLifetimeSavings,
        implementationCost,
        complexity: complexity || template?.complexity || "moderate",
        riskLevel: riskLevel || template?.riskLevel || "low",
        timeHorizon: timeHorizon || template?.timeHorizon || "annual",
        recurringBenefit: template?.recurringBenefit || false,
        alignedGoalIds,
        prerequisites: template?.prerequisites || null,
        notes,
      },
    });

    // Create milestones from template or provided
    const stepsToCreate = milestones.length > 0
      ? milestones
      : (template?.implementationSteps || []).map((step: string, idx: number) => ({
          title: step,
          order: idx + 1,
        }));

    if (stepsToCreate.length > 0) {
      await prisma.taxStrategyMilestone.createMany({
        data: stepsToCreate.map((m: { title: string; description?: string; dueDate?: string; order?: number }, idx: number) => ({
          taxStrategyId: strategy.id,
          title: m.title,
          description: m.description,
          order: m.order || idx + 1,
          dueDate: m.dueDate ? new Date(m.dueDate) : null,
          status: "pending",
        })),
      });
    }

    const result = await prisma.taxStrategy.findUnique({
      where: { id: strategy.id },
      include: { milestones: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ strategy: result }, { status: 201 });
  } catch (error) {
    console.error("[Tax Strategies API] Error creating:", error);
    return NextResponse.json({ error: "Failed to create strategy" }, { status: 500 });
  }
}

// PUT /api/tax/strategies - Update strategy or milestone
export async function PUT(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, milestoneId, ...updateData } = body;

    if (milestoneId) {
      // Update milestone
      const milestone = await prisma.taxStrategyMilestone.findUnique({
        where: { id: milestoneId },
        include: { taxStrategy: true },
      });

      if (!milestone || milestone.taxStrategy.userId !== userId) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }

      if (updateData.status === "completed" && !milestone.completedDate) {
        updateData.completedDate = new Date();
      }

      const updated = await prisma.taxStrategyMilestone.update({
        where: { id: milestoneId },
        data: updateData,
      });

      return NextResponse.json({ milestone: updated });
    }

    if (!id) {
      return NextResponse.json({ error: "Strategy ID is required" }, { status: 400 });
    }

    // Update strategy
    const existing = await prisma.taxStrategy.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    // Set dates based on status changes
    if (updateData.currentStatus === "in_progress" && !existing.startDate) {
      updateData.startDate = new Date();
    }
    if (updateData.currentStatus === "completed" && !existing.completedDate) {
      updateData.completedDate = new Date();
    }

    const strategy = await prisma.taxStrategy.update({
      where: { id },
      data: updateData,
      include: { milestones: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error("[Tax Strategies API] Error updating:", error);
    return NextResponse.json({ error: "Failed to update strategy" }, { status: 500 });
  }
}

// DELETE /api/tax/strategies
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Strategy ID is required" }, { status: 400 });
    }

    const existing = await prisma.taxStrategy.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    await prisma.taxStrategy.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Tax Strategies API] Error deleting:", error);
    return NextResponse.json({ error: "Failed to delete strategy" }, { status: 500 });
  }
}
