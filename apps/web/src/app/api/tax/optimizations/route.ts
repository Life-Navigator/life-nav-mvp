import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { FilingStatus } from "@/types/tax";

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

// Tax optimization templates
const optimizationStrategies = {
  retirement_contribution: {
    title: "Maximize Retirement Contributions",
    description: "Increase your 401(k) or IRA contributions to reduce taxable income and grow your retirement savings tax-deferred.",
    complexity: "simple",
    timeframe: "this_year",
    getActionRequired: (remaining: number, type: string) =>
      `Contribute an additional $${remaining.toLocaleString()} to your ${type} before the deadline.`,
  },
  hsa_contribution: {
    title: "Maximize HSA Contributions",
    description: "HSA contributions are triple tax-advantaged: tax-deductible, grow tax-free, and withdrawals for medical expenses are tax-free.",
    complexity: "simple",
    timeframe: "this_year",
  },
  charitable_bunching: {
    title: "Charitable Donation Bunching",
    description: "Bundle multiple years of charitable donations into one year to exceed the standard deduction threshold and itemize.",
    complexity: "moderate",
    timeframe: "this_year",
  },
  tax_loss_harvesting: {
    title: "Tax-Loss Harvesting",
    description: "Sell investments at a loss to offset capital gains and up to $3,000 of ordinary income per year.",
    complexity: "moderate",
    timeframe: "this_year",
  },
  roth_conversion: {
    title: "Roth IRA Conversion",
    description: "Convert traditional IRA to Roth IRA during lower-income years to pay taxes now at a lower rate.",
    complexity: "complex",
    timeframe: "multi_year",
  },
  income_timing: {
    title: "Income Timing Strategies",
    description: "Defer income to next year or accelerate income into current year depending on expected tax rates.",
    complexity: "moderate",
    timeframe: "this_year",
  },
  state_tax_planning: {
    title: "State Tax Optimization",
    description: "Consider relocation or remote work arrangements in states with lower or no income tax.",
    complexity: "complex",
    timeframe: "multi_year",
  },
  business_entity: {
    title: "Business Entity Optimization",
    description: "Evaluate S-Corp election for self-employment income to reduce self-employment tax.",
    complexity: "complex",
    timeframe: "multi_year",
  },
  qbi_maximization: {
    title: "QBI Deduction Optimization",
    description: "Structure business income to maximize the 20% Qualified Business Income deduction.",
    complexity: "complex",
    timeframe: "this_year",
  },
  education_credits: {
    title: "Education Tax Credits",
    description: "Claim AOTC or LLC for qualifying education expenses - up to $2,500 per eligible student.",
    complexity: "simple",
    timeframe: "this_year",
  },
  energy_credits: {
    title: "Clean Energy Tax Credits",
    description: "Install solar panels, heat pumps, or buy an EV to claim significant energy tax credits.",
    complexity: "moderate",
    timeframe: "multi_year",
  },
};

// GET /api/tax/optimizations - Generate tax optimization suggestions
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    const profile = await prisma.taxProfile.findUnique({
      where: { userId_taxYear: { userId, taxYear: year } },
      include: {
        incomes: true,
        deductions: true,
        credits: true,
        optimizations: true,
        estimates: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
    });

    if (!profile) {
      return NextResponse.json({
        optimizations: [],
        totalPotentialSavings: 0,
        topRecommendations: [],
      });
    }

    const filingStatus = profile.filingStatus as FilingStatus;
    const latestEstimate = profile.estimates[0];
    const marginalRate = latestEstimate?.marginalRate || 22;

    const suggestions: {
      category: string;
      title: string;
      description: string;
      estimatedSavings: number;
      confidenceLevel: string;
      timeframe: string;
      complexity: string;
      actionRequired: string;
      deadline?: Date;
    }[] = [];

    // Calculate total income
    const wagesIncome = profile.incomes
      .filter(i => i.category === "wages")
      .reduce((sum, i) => sum + i.amount, 0);
    const selfEmploymentIncome = profile.incomes
      .filter(i => i.category === "self_employment" || i.category === "business")
      .reduce((sum, i) => sum + (i.netIncome ?? i.amount - i.expenses), 0);

    // Check retirement contribution opportunities
    const retirementDeductions = profile.deductions
      .filter(d => d.type === "401k" || d.type === "ira")
      .reduce((sum, d) => sum + d.amount, 0);

    const max401k = 23000; // 2024 limit
    const maxIRA = 7000; // 2024 limit
    const catchUpAge = profile.isOver65;

    if (retirementDeductions < max401k + maxIRA) {
      const remaining401k = Math.max(0, max401k - retirementDeductions);
      const remainingIRA = maxIRA; // Simplified
      const totalRemaining = remaining401k + remainingIRA;

      if (totalRemaining > 0) {
        const savings = totalRemaining * (marginalRate / 100);
        suggestions.push({
          category: "retirement_contribution",
          title: optimizationStrategies.retirement_contribution.title,
          description: optimizationStrategies.retirement_contribution.description,
          estimatedSavings: Math.round(savings),
          confidenceLevel: "high",
          timeframe: "this_year",
          complexity: "simple",
          actionRequired: `You can contribute up to $${totalRemaining.toLocaleString()} more to retirement accounts. This could save approximately $${Math.round(savings).toLocaleString()} in taxes.`,
          deadline: new Date(year, 11, 31), // Dec 31 for 401k
        });
      }
    }

    // HSA contribution check
    const hasHSA = profile.deductions.some(d => d.type === "hsa");
    const hsaContributions = profile.deductions
      .filter(d => d.type === "hsa")
      .reduce((sum, d) => sum + d.amount, 0);
    const maxHSA = filingStatus === "married_jointly" ? 8300 : 4150; // 2024 family/individual

    if (hsaContributions < maxHSA) {
      const remaining = maxHSA - hsaContributions;
      const savings = remaining * (marginalRate / 100);
      suggestions.push({
        category: "hsa_contribution",
        title: optimizationStrategies.hsa_contribution.title,
        description: optimizationStrategies.hsa_contribution.description,
        estimatedSavings: Math.round(savings),
        confidenceLevel: hasHSA ? "high" : "medium",
        timeframe: "this_year",
        complexity: "simple",
        actionRequired: hasHSA
          ? `Contribute an additional $${remaining.toLocaleString()} to your HSA to maximize the tax benefit.`
          : "Consider opening an HSA if you have a high-deductible health plan (HDHP).",
        deadline: new Date(year + 1, 3, 15), // April 15 next year
      });
    }

    // Charitable bunching analysis
    const itemizedDeductions = profile.deductions
      .filter(d => d.category === "itemized")
      .reduce((sum, d) => sum + d.amount, 0);
    const standardDeduction = filingStatus === "married_jointly" ? 29200 : 14600;
    const charitableDeductions = profile.deductions
      .filter(d => d.type === "charitable")
      .reduce((sum, d) => sum + d.amount, 0);

    if (itemizedDeductions < standardDeduction && charitableDeductions > 0) {
      const gapToItemize = standardDeduction - itemizedDeductions;
      const potentialSavings = gapToItemize * (marginalRate / 100) * 0.5; // Conservative estimate

      if (gapToItemize < charitableDeductions * 3) { // If bunching is feasible
        suggestions.push({
          category: "deduction_bunching",
          title: optimizationStrategies.charitable_bunching.title,
          description: optimizationStrategies.charitable_bunching.description,
          estimatedSavings: Math.round(potentialSavings),
          confidenceLevel: "medium",
          timeframe: "this_year",
          complexity: "moderate",
          actionRequired: `Consider bunching 2-3 years of charitable donations into one year to exceed the standard deduction of $${standardDeduction.toLocaleString()} and benefit from itemizing.`,
        });
      }
    }

    // Self-employment / S-Corp analysis
    if (selfEmploymentIncome > 50000) {
      const seRate = 0.153;
      const currentSETax = selfEmploymentIncome * 0.9235 * seRate;
      const reasonableSalary = selfEmploymentIncome * 0.6;
      const potentialSCorpSETax = reasonableSalary * seRate / 2; // Only employer portion on salary
      const savings = currentSETax - potentialSCorpSETax;

      if (savings > 2000) {
        suggestions.push({
          category: "business_structure",
          title: optimizationStrategies.business_entity.title,
          description: optimizationStrategies.business_entity.description,
          estimatedSavings: Math.round(savings),
          confidenceLevel: "medium",
          timeframe: "multi_year",
          complexity: "complex",
          actionRequired: `With self-employment income of $${selfEmploymentIncome.toLocaleString()}, an S-Corp election could save approximately $${Math.round(savings).toLocaleString()} annually in self-employment taxes. Consult a tax professional.`,
        });
      }
    }

    // Tax-loss harvesting check
    const capitalGains = profile.incomes
      .filter(i => i.category === "capital_gains")
      .reduce((sum, i) => sum + i.amount, 0);

    if (capitalGains > 3000) {
      const potentialSavings = Math.min(capitalGains, 10000) * (marginalRate / 100) * 0.5;
      suggestions.push({
        category: "tax_loss_harvesting",
        title: optimizationStrategies.tax_loss_harvesting.title,
        description: optimizationStrategies.tax_loss_harvesting.description,
        estimatedSavings: Math.round(potentialSavings),
        confidenceLevel: "medium",
        timeframe: "this_year",
        complexity: "moderate",
        actionRequired: `Review your investment portfolio for positions with unrealized losses that could offset your $${capitalGains.toLocaleString()} in capital gains.`,
        deadline: new Date(year, 11, 31),
      });
    }

    // Energy credits
    const hasEnergyCredits = profile.credits.some(c => c.type === "energy" || c.type === "ev_credit");
    if (!hasEnergyCredits && latestEstimate && latestEstimate.totalTaxLiability > 5000) {
      suggestions.push({
        category: "capital_gains",
        title: optimizationStrategies.energy_credits.title,
        description: optimizationStrategies.energy_credits.description,
        estimatedSavings: 7500, // Average EV credit
        confidenceLevel: "medium",
        timeframe: "multi_year",
        complexity: "moderate",
        actionRequired: "Consider purchasing a qualifying electric vehicle (up to $7,500 credit) or installing solar panels (30% credit) to reduce your tax liability.",
      });
    }

    // Roth conversion analysis (if in lower bracket)
    if (marginalRate <= 22 && retirementDeductions > 0) {
      const conversionAmount = Math.min(
        (filingStatus === "married_jointly" ? 94300 : 47150) - (latestEstimate?.taxableIncome || 0),
        50000
      );

      if (conversionAmount > 5000) {
        suggestions.push({
          category: "roth_conversion",
          title: optimizationStrategies.roth_conversion.title,
          description: optimizationStrategies.roth_conversion.description,
          estimatedSavings: conversionAmount * 0.15, // Assuming future higher bracket
          confidenceLevel: "medium",
          timeframe: "multi_year",
          complexity: "complex",
          actionRequired: `Your current marginal rate of ${marginalRate}% is relatively low. Consider converting up to $${conversionAmount.toLocaleString()} from traditional to Roth IRA while staying in your current bracket.`,
          deadline: new Date(year, 11, 31),
        });
      }
    }

    // Sort by estimated savings
    suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

    // Calculate totals
    const totalPotentialSavings = suggestions.reduce((sum, s) => sum + s.estimatedSavings, 0);
    const topRecommendations = suggestions.slice(0, 3);

    return NextResponse.json({
      optimizations: suggestions,
      totalPotentialSavings,
      topRecommendations,
    });
  } catch (error) {
    console.error("[Tax Optimizations API] Error:", error);
    return NextResponse.json({ error: "Failed to generate optimizations" }, { status: 500 });
  }
}

// POST /api/tax/optimizations - Save an optimization status
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      taxYear = new Date().getFullYear(),
      category,
      title,
      description,
      estimatedSavings,
      confidenceLevel = "medium",
      timeframe = "this_year",
      complexity = "moderate",
      actionRequired,
      deadline,
      status = "considering",
    } = body;

    const profile = await prisma.taxProfile.findUnique({
      where: { userId_taxYear: { userId, taxYear } },
    });

    if (!profile) {
      return NextResponse.json({ error: "Tax profile not found" }, { status: 404 });
    }

    const optimization = await prisma.taxOptimization.create({
      data: {
        taxProfileId: profile.id,
        category,
        title,
        description,
        estimatedSavings,
        confidenceLevel,
        timeframe,
        complexity,
        actionRequired,
        deadline: deadline ? new Date(deadline) : null,
        status,
        source: "user",
      },
    });

    return NextResponse.json({ optimization }, { status: 201 });
  } catch (error) {
    console.error("[Tax Optimizations API] Error saving:", error);
    return NextResponse.json({ error: "Failed to save optimization" }, { status: 500 });
  }
}
