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

// GET /api/assets/[id]/loans - Get all loans for an asset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    // Verify asset ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, userId },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const loans = await prisma.assetLoan.findMany({
      where: { assetId },
      orderBy: [{ isActive: "desc" }, { currentBalance: "desc" }],
    });

    const summary = {
      totalDebt: loans.filter((l) => l.isActive).reduce((sum, l) => sum + l.currentBalance, 0),
      totalMonthlyPayment: loans.filter((l) => l.isActive).reduce((sum, l) => sum + l.monthlyPayment, 0),
      equity: asset.currentValue - loans.filter((l) => l.isActive).reduce((sum, l) => sum + l.currentBalance, 0),
      loanToValue: loans.filter((l) => l.isActive).reduce((sum, l) => sum + l.currentBalance, 0) / asset.currentValue * 100,
    };

    return NextResponse.json({ loans, summary });
  } catch (error) {
    console.error("[Loans API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}

// POST /api/assets/[id]/loans - Create a new loan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    // Verify asset ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, userId },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      loanType,
      lender,
      originalAmount,
      currentBalance,
      interestRate,
      monthlyPayment,
      startDate,
      endDate,
      paymentDueDay,
      accountNumber,
      notes,
    } = body;

    if (!loanType || !lender || originalAmount === undefined || currentBalance === undefined ||
        interestRate === undefined || monthlyPayment === undefined || !startDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const loan = await prisma.assetLoan.create({
      data: {
        assetId,
        loanType,
        lender,
        originalAmount,
        currentBalance,
        interestRate,
        monthlyPayment,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        paymentDueDay,
        accountNumber,
        notes,
        isActive: true,
      },
    });

    return NextResponse.json({ loan }, { status: 201 });
  } catch (error) {
    console.error("[Loans API] Error creating loan:", error);
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 });
  }
}
