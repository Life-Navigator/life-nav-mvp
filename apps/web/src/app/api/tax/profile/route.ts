import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db as prisma } from '@/lib/db';


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

// GET /api/tax/profile - Get tax profile for a year (defaults to current year)
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    const profile = await prisma.taxProfile.findUnique({
      where: {
        userId_taxYear: { userId, taxYear: year },
      },
      include: {
        incomes: { orderBy: { amount: "desc" } },
        deductions: { orderBy: { amount: "desc" } },
        credits: { orderBy: { amount: "desc" } },
        estimates: { orderBy: { calculatedAt: "desc" }, take: 1 },
        scenarios: { orderBy: { priority: "desc" } },
        documents: { orderBy: { createdAt: "desc" } },
        quarterlyPayments: { orderBy: { quarter: "asc" } },
        optimizations: { where: { status: "suggested" }, orderBy: { estimatedSavings: "desc" } },
      },
    });

    if (!profile) {
      // Return empty state for new profile
      return NextResponse.json({
        profile: null,
        taxYear: year,
        summary: {
          taxYear: year,
          profileStatus: "draft",
          estimatedTax: 0,
          totalWithholding: 0,
          totalEstimatedPayments: 0,
          refundOrOwed: 0,
          effectiveRate: 0,
          marginalRate: 0,
          documentsReceived: 0,
          documentsExpected: 0,
          optimizationPotential: 0,
        },
      });
    }

    // Calculate summary
    const latestEstimate = profile.estimates[0];
    const totalWithholding = profile.incomes.reduce((sum, i) => sum + i.taxWithheld, 0);
    const totalEstimatedPayments = profile.quarterlyPayments
      .filter((q) => q.status === "paid")
      .reduce((sum, q) => sum + q.actualPayment, 0);
    const optimizationPotential = profile.optimizations.reduce((sum, o) => sum + o.estimatedSavings, 0);

    const summary = {
      taxYear: year,
      profileStatus: profile.status,
      estimatedTax: latestEstimate?.totalTaxLiability || 0,
      totalWithholding,
      totalEstimatedPayments,
      refundOrOwed: latestEstimate?.refundOrOwed || 0,
      effectiveRate: latestEstimate?.effectiveRate || 0,
      marginalRate: latestEstimate?.marginalRate || 0,
      documentsReceived: profile.documents.filter((d) => d.status !== "pending").length,
      documentsExpected: profile.documents.length,
      optimizationPotential,
      quarterlyPaymentStatus: {
        q1: profile.quarterlyPayments.find((q) => q.quarter === 1)?.status || "pending",
        q2: profile.quarterlyPayments.find((q) => q.quarter === 2)?.status || "pending",
        q3: profile.quarterlyPayments.find((q) => q.quarter === 3)?.status || "pending",
        q4: profile.quarterlyPayments.find((q) => q.quarter === 4)?.status || "pending",
      },
    };

    return NextResponse.json({
      profile,
      summary,
      latestEstimate,
    });
  } catch (error) {
    console.error("[Tax API] Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch tax profile" }, { status: 500 });
  }
}

// POST /api/tax/profile - Create or update tax profile
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      taxYear = new Date().getFullYear(),
      filingStatus = "single",
      state,
      dependents = 0,
      isBlind = false,
      isOver65 = false,
      spouseIsBlind = false,
      spouseIsOver65 = false,
      multipleJobs = false,
      claimDependents = 0,
      otherIncome = 0,
      deductionsW4 = 0,
      extraWithholding = 0,
      notes,
    } = body;

    const profile = await prisma.taxProfile.upsert({
      where: {
        userId_taxYear: { userId, taxYear },
      },
      update: {
        filingStatus,
        state,
        dependents,
        isBlind,
        isOver65,
        spouseIsBlind,
        spouseIsOver65,
        multipleJobs,
        claimDependents,
        otherIncome,
        deductionsW4,
        extraWithholding,
        notes,
        status: "in_progress",
      },
      create: {
        userId,
        taxYear,
        filingStatus,
        state,
        dependents,
        isBlind,
        isOver65,
        spouseIsBlind,
        spouseIsOver65,
        multipleJobs,
        claimDependents,
        otherIncome,
        deductionsW4,
        extraWithholding,
        notes,
        status: "draft",
      },
      include: {
        incomes: true,
        deductions: true,
        credits: true,
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("[Tax API] Error creating/updating profile:", error);
    return NextResponse.json({ error: "Failed to save tax profile" }, { status: 500 });
  }
}
