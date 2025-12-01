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

// GET /api/assets/[id] - Get a specific asset with all details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const asset = await prisma.asset.findFirst({
      where: { id, userId },
      include: {
        loans: {
          orderBy: { createdAt: "desc" },
        },
        upgrades: {
          orderBy: { createdAt: "desc" },
        },
        valuations: {
          orderBy: { valuationDate: "desc" },
          take: 20,
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Calculate equity
    const totalDebt = asset.loans
      ?.filter((l) => l.isActive)
      .reduce((sum, l) => sum + l.currentBalance, 0) || 0;
    const equity = asset.currentValue - totalDebt;

    // Calculate upgrade stats
    const upgradeStats = {
      totalPlanned: asset.upgrades?.filter((u) => u.status === "planned").length || 0,
      totalInProgress: asset.upgrades?.filter((u) => u.status === "in_progress").length || 0,
      totalCompleted: asset.upgrades?.filter((u) => u.status === "completed").length || 0,
      estimatedCostPlanned: asset.upgrades
        ?.filter((u) => u.status === "planned")
        .reduce((sum, u) => sum + u.estimatedCost, 0) || 0,
      totalSpent: asset.upgrades
        ?.filter((u) => u.status === "completed")
        .reduce((sum, u) => sum + (u.actualCost || u.estimatedCost), 0) || 0,
      totalValueAdded: asset.upgrades
        ?.filter((u) => u.status === "completed")
        .reduce((sum, u) => sum + (u.valueIncrease || 0), 0) || 0,
    };

    return NextResponse.json({
      asset,
      equity,
      totalDebt,
      upgradeStats,
    });
  } catch (error) {
    console.error("[Assets API] Error fetching asset:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

// PUT /api/assets/[id] - Update an asset
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify ownership
    const existing = await prisma.asset.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const {
      name,
      type,
      subtype,
      value,
      currentValue,
      currency,
      purchaseDate,
      purchasePrice,
      location,
      description,
      notes,
      documents,
      imageUrl,
      images,
    } = body;

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(subtype !== undefined && { subtype }),
        ...(value !== undefined && { value }),
        ...(currentValue !== undefined && {
          currentValue,
          lastValuationDate: new Date(),
        }),
        ...(currency && { currency }),
        ...(purchaseDate !== undefined && {
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null
        }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(location !== undefined && { location }),
        ...(description !== undefined && { description }),
        ...(notes !== undefined && { notes }),
        ...(documents !== undefined && { documents }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(images !== undefined && { images }),
      },
      include: {
        loans: true,
        upgrades: true,
      },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("[Assets API] Error updating asset:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

// DELETE /api/assets/[id] - Delete an asset
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.asset.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await prisma.asset.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Assets API] Error deleting asset:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
