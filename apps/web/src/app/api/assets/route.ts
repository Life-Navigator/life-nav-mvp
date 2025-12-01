import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db as prisma } from '@/lib/db';


interface JWTPayload {
  sub: string;
  email?: string;
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

// GET /api/assets - Get all assets for user
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const includeLoans = searchParams.get("includeLoans") === "true";
    const includeUpgrades = searchParams.get("includeUpgrades") === "true";
    const includeValuations = searchParams.get("includeValuations") === "true";

    const assets = await prisma.asset.findMany({
      where: {
        userId,
        ...(type && { type }),
      },
      include: {
        loans: includeLoans,
        upgrades: includeUpgrades,
        valuations: includeValuations ? {
          orderBy: { valuationDate: "desc" },
          take: 10,
        } : false,
      },
      orderBy: { currentValue: "desc" },
    });

    // Calculate summary
    const summary = {
      totalValue: assets.reduce((sum, a) => sum + a.currentValue, 0),
      totalDebt: assets.reduce((sum, a) => {
        const loanTotal = a.loans?.reduce((ls, l) => ls + (l.isActive ? l.currentBalance : 0), 0) || 0;
        return sum + loanTotal;
      }, 0),
      totalEquity: 0,
      byType: [] as { type: string; count: number; value: number; equity: number }[],
    };
    summary.totalEquity = summary.totalValue - summary.totalDebt;

    // Group by type
    const typeMap = new Map<string, { count: number; value: number; debt: number }>();
    assets.forEach((a) => {
      const existing = typeMap.get(a.type) || { count: 0, value: 0, debt: 0 };
      const assetDebt = a.loans?.reduce((ls, l) => ls + (l.isActive ? l.currentBalance : 0), 0) || 0;
      typeMap.set(a.type, {
        count: existing.count + 1,
        value: existing.value + a.currentValue,
        debt: existing.debt + assetDebt,
      });
    });
    summary.byType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      value: data.value,
      equity: data.value - data.debt,
    }));

    return NextResponse.json({ assets, summary });
  } catch (error) {
    console.error("[Assets API] Error fetching assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

// POST /api/assets - Create a new asset
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      type,
      subtype,
      value,
      currentValue,
      currency = "USD",
      purchaseDate,
      purchasePrice,
      location,
      description,
      notes,
      documents,
      imageUrl,
      images,
    } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        userId,
        name,
        type,
        subtype,
        value: value || currentValue || 0,
        currentValue: currentValue || value || 0,
        currency,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice,
        location,
        description,
        notes,
        documents,
        imageUrl,
        images: images || [],
        lastValuationDate: new Date(),
      },
      include: {
        loans: true,
        upgrades: true,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("[Assets API] Error creating asset:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
