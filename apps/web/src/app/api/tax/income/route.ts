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

// GET /api/tax/income - Get all income items for a tax profile
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
      include: { incomes: { orderBy: { amount: "desc" } } },
    });

    if (!profile) {
      return NextResponse.json({ incomes: [], taxYear: year });
    }

    // Calculate totals by category
    const totals = profile.incomes.reduce((acc, income) => {
      acc[income.category] = (acc[income.category] || 0) + income.amount;
      acc.total = (acc.total || 0) + income.amount;
      acc.totalWithheld = (acc.totalWithheld || 0) + income.taxWithheld;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      incomes: profile.incomes,
      totals,
      taxYear: year,
    });
  } catch (error) {
    console.error("[Tax Income API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch income" }, { status: 500 });
  }
}

// POST /api/tax/income - Add a new income item
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
      subcategory,
      source,
      amount,
      frequency = "annual",
      taxWithheld = 0,
      is1099 = false,
      isW2 = false,
      employerEIN,
      expenses = 0,
      qbiEligible = false,
      costBasis,
      acquisitionDate,
      isQualified = false,
      propertyAddress,
      daysRented,
      daysPersonalUse,
      notes,
      documentIds = [],
    } = body;

    if (!category || !source || amount === undefined) {
      return NextResponse.json(
        { error: "Category, source, and amount are required" },
        { status: 400 }
      );
    }

    // Ensure profile exists
    const profile = await prisma.taxProfile.upsert({
      where: { userId_taxYear: { userId, taxYear } },
      update: {},
      create: {
        userId,
        taxYear,
        filingStatus: "single",
        status: "draft",
      },
    });

    const income = await prisma.taxIncome.create({
      data: {
        taxProfileId: profile.id,
        category,
        subcategory,
        source,
        amount,
        frequency,
        taxWithheld,
        is1099,
        isW2,
        employerEIN,
        expenses,
        netIncome: amount - expenses,
        qbiEligible,
        costBasis,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
        isQualified,
        propertyAddress,
        daysRented,
        daysPersonalUse,
        notes,
        documentIds,
      },
    });

    return NextResponse.json({ income }, { status: 201 });
  } catch (error) {
    console.error("[Tax Income API] Error creating income:", error);
    return NextResponse.json({ error: "Failed to create income" }, { status: 500 });
  }
}

// PUT /api/tax/income - Update an income item
export async function PUT(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Income ID is required" }, { status: 400 });
    }

    // Verify ownership through profile
    const existing = await prisma.taxIncome.findUnique({
      where: { id },
      include: { taxProfile: true },
    });

    if (!existing || existing.taxProfile.userId !== userId) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    // Calculate net income if amount or expenses changed
    if (updateData.amount !== undefined || updateData.expenses !== undefined) {
      const amount = updateData.amount ?? existing.amount;
      const expenses = updateData.expenses ?? existing.expenses;
      updateData.netIncome = amount - expenses;
    }

    if (updateData.acquisitionDate) {
      updateData.acquisitionDate = new Date(updateData.acquisitionDate);
    }

    const income = await prisma.taxIncome.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ income });
  } catch (error) {
    console.error("[Tax Income API] Error updating income:", error);
    return NextResponse.json({ error: "Failed to update income" }, { status: 500 });
  }
}

// DELETE /api/tax/income - Delete an income item
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Income ID is required" }, { status: 400 });
    }

    // Verify ownership through profile
    const existing = await prisma.taxIncome.findUnique({
      where: { id },
      include: { taxProfile: true },
    });

    if (!existing || existing.taxProfile.userId !== userId) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    await prisma.taxIncome.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Tax Income API] Error deleting income:", error);
    return NextResponse.json({ error: "Failed to delete income" }, { status: 500 });
  }
}
