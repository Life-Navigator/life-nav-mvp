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

// GET /api/assets/[id]/upgrades - Get all upgrades for an asset
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

    const upgrades = await prisma.assetUpgrade.findMany({
      where: { assetId },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    // Calculate scenario analysis for planned upgrades
    const scenarios = upgrades
      .filter((u) => u.status === "planned")
      .map((upgrade) => {
        const roi = upgrade.valueIncrease
          ? ((upgrade.valueIncrease - upgrade.estimatedCost) / upgrade.estimatedCost) * 100
          : 0;
        const netValueChange = (upgrade.valueIncrease || 0) - upgrade.estimatedCost;
        // Assume 3% annual appreciation for payback calculation
        const monthlyAppreciation = asset.currentValue * 0.03 / 12;
        const paybackPeriod = netValueChange > 0 && monthlyAppreciation > 0
          ? Math.ceil(upgrade.estimatedCost / monthlyAppreciation)
          : Infinity;

        return {
          upgrade,
          roi,
          paybackPeriod: paybackPeriod === Infinity ? null : paybackPeriod,
          netValueChange,
          isRecommended: roi > 50 || (roi > 0 && paybackPeriod < 60),
        };
      });

    return NextResponse.json({ upgrades, scenarios });
  } catch (error) {
    console.error("[Upgrades API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch upgrades" }, { status: 500 });
  }
}

// POST /api/assets/[id]/upgrades - Create a new upgrade
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
      name,
      description,
      category,
      estimatedCost,
      actualCost,
      valueIncrease,
      status = "planned",
      priority = "medium",
      startDate,
      completionDate,
      contractor,
      warranty,
      documents,
      notes,
    } = body;

    if (!name || !category || estimatedCost === undefined) {
      return NextResponse.json(
        { error: "Name, category, and estimated cost are required" },
        { status: 400 }
      );
    }

    const upgrade = await prisma.assetUpgrade.create({
      data: {
        assetId,
        name,
        description,
        category,
        estimatedCost,
        actualCost,
        valueIncrease,
        status,
        priority,
        startDate: startDate ? new Date(startDate) : null,
        completionDate: completionDate ? new Date(completionDate) : null,
        contractor,
        warranty,
        documents,
        notes,
      },
    });

    return NextResponse.json({ upgrade }, { status: 201 });
  } catch (error) {
    console.error("[Upgrades API] Error creating upgrade:", error);
    return NextResponse.json({ error: "Failed to create upgrade" }, { status: 500 });
  }
}
