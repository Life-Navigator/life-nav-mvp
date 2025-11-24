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

// Document type configurations
const documentTypes = {
  w2: { name: "W-2", description: "Wage and Tax Statement", expectedFields: ["wages", "federalTaxWithheld", "socialSecurityWages", "medicareTaxWithheld"] },
  "1099_misc": { name: "1099-MISC", description: "Miscellaneous Income", expectedFields: ["totalIncome", "federalTaxWithheld"] },
  "1099_nec": { name: "1099-NEC", description: "Nonemployee Compensation", expectedFields: ["totalCompensation"] },
  "1099_div": { name: "1099-DIV", description: "Dividends and Distributions", expectedFields: ["ordinaryDividends", "qualifiedDividends", "capitalGains"] },
  "1099_int": { name: "1099-INT", description: "Interest Income", expectedFields: ["interestIncome", "federalTaxWithheld"] },
  "1099_b": { name: "1099-B", description: "Broker Transactions", expectedFields: ["proceeds", "costBasis", "gainLoss"] },
  "1099_r": { name: "1099-R", description: "Retirement Distributions", expectedFields: ["grossDistribution", "taxableAmount", "federalTaxWithheld"] },
  "1098": { name: "1098", description: "Mortgage Interest Statement", expectedFields: ["mortgageInterest", "pointsPaid", "propertyTax"] },
  "1098_t": { name: "1098-T", description: "Tuition Statement", expectedFields: ["tuitionPaid", "scholarships"] },
  "1098_e": { name: "1098-E", description: "Student Loan Interest", expectedFields: ["studentLoanInterest"] },
  k1: { name: "Schedule K-1", description: "Partner's Share of Income", expectedFields: ["ordinaryIncome", "netRentalIncome", "interestIncome"] },
  receipts: { name: "Receipts", description: "Deduction receipts", expectedFields: [] },
  offer_letter: { name: "Offer Letter", description: "Employment offer letter", expectedFields: ["baseSalary", "bonusTarget", "startDate"] },
  benefits_summary: { name: "Benefits Summary", description: "Benefits enrollment summary", expectedFields: [] },
  other: { name: "Other", description: "Other tax document", expectedFields: [] },
};

// GET /api/tax/documents - Get all tax documents
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const profile = await prisma.taxProfile.findUnique({
      where: { userId_taxYear: { userId, taxYear: year } },
    });

    if (!profile) {
      return NextResponse.json({
        documents: [],
        summary: {
          total: 0,
          pending: 0,
          received: 0,
          reviewed: 0,
          entered: 0,
          expectedTypes: Object.keys(documentTypes),
        },
      });
    }

    const whereClause: Record<string, unknown> = { taxProfileId: profile.id };
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;

    const documents = await prisma.taxDocument.findMany({
      where: whereClause,
      orderBy: [{ status: "asc" }, { type: "asc" }, { receivedDate: "desc" }],
    });

    // Calculate summary by status
    const statusCounts = documents.reduce((acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate totals from documents
    const totals = documents.reduce((acc, doc) => {
      if (doc.grossAmount) acc.totalGross += doc.grossAmount;
      if (doc.taxWithheld) acc.totalWithheld += doc.taxWithheld;
      if (doc.stateTaxWithheld) acc.totalStateWithheld += doc.stateTaxWithheld;
      return acc;
    }, { totalGross: 0, totalWithheld: 0, totalStateWithheld: 0 });

    // Identify missing document types based on income sources
    const incomes = await prisma.taxIncome.findMany({
      where: { taxProfileId: profile.id },
    });

    const expectedDocTypes: string[] = [];
    incomes.forEach(income => {
      if (income.isW2) expectedDocTypes.push("w2");
      if (income.is1099) expectedDocTypes.push("1099_nec");
      if (income.category === "interest") expectedDocTypes.push("1099_int");
      if (income.category === "dividends") expectedDocTypes.push("1099_div");
      if (income.category === "capital_gains") expectedDocTypes.push("1099_b");
      if (income.category === "retirement") expectedDocTypes.push("1099_r");
    });

    const receivedTypes = documents.map(d => d.type);
    const missingTypes = [...new Set(expectedDocTypes)].filter(t => !receivedTypes.includes(t));

    return NextResponse.json({
      documents: documents.map(doc => ({
        ...doc,
        typeInfo: documentTypes[doc.type as keyof typeof documentTypes] || documentTypes.other,
      })),
      summary: {
        total: documents.length,
        ...statusCounts,
        ...totals,
        expectedTypes: [...new Set(expectedDocTypes)],
        missingTypes,
        completionPct: expectedDocTypes.length > 0
          ? Math.round((receivedTypes.filter(t => expectedDocTypes.includes(t)).length / expectedDocTypes.length) * 100)
          : 100,
      },
      documentTypes,
    });
  } catch (error) {
    console.error("[Tax Documents API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

// POST /api/tax/documents - Upload/create a tax document
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      taxYear = new Date().getFullYear(),
      type,
      issuerName,
      issuerEIN,
      documentNumber,
      grossAmount,
      taxWithheld,
      stateTaxWithheld,
      fileUrl,
      fileName,
      fileType,
      fileSize,
      ocrText,
      ocrData,
      notes,
    } = body;

    if (!type || !issuerName) {
      return NextResponse.json(
        { error: "Document type and issuer name are required" },
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

    const document = await prisma.taxDocument.create({
      data: {
        taxProfileId: profile.id,
        type,
        year: taxYear,
        issuerName,
        issuerEIN,
        status: fileUrl ? "received" : "pending",
        receivedDate: fileUrl ? new Date() : null,
        documentNumber,
        grossAmount,
        taxWithheld,
        stateTaxWithheld,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        ocrText,
        ocrData,
        notes,
      },
    });

    // If this is a W-2, auto-create income entry
    if (type === "w2" && grossAmount) {
      const existingIncome = await prisma.taxIncome.findFirst({
        where: {
          taxProfileId: profile.id,
          source: issuerName,
          category: "wages",
        },
      });

      if (!existingIncome) {
        await prisma.taxIncome.create({
          data: {
            taxProfileId: profile.id,
            category: "wages",
            source: issuerName,
            amount: grossAmount,
            taxWithheld: taxWithheld || 0,
            isW2: true,
            employerEIN: issuerEIN,
            documentIds: [document.id],
          },
        });
      }
    }

    return NextResponse.json({
      document: {
        ...document,
        typeInfo: documentTypes[type as keyof typeof documentTypes] || documentTypes.other,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[Tax Documents API] Error creating:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}

// PUT /api/tax/documents - Update document status or data
export async function PUT(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.taxDocument.findUnique({
      where: { id },
      include: { taxProfile: true },
    });

    if (!existing || existing.taxProfile.userId !== userId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Set status timestamps
    if (updateData.status === "received" && !existing.receivedDate) {
      updateData.receivedDate = new Date();
    }
    if (updateData.status === "reviewed" && !existing.reviewedDate) {
      updateData.reviewedDate = new Date();
    }
    if (updateData.status === "entered" && !existing.enteredDate) {
      updateData.enteredDate = new Date();
    }

    const document = await prisma.taxDocument.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      document: {
        ...document,
        typeInfo: documentTypes[document.type as keyof typeof documentTypes] || documentTypes.other,
      },
    });
  } catch (error) {
    console.error("[Tax Documents API] Error updating:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

// DELETE /api/tax/documents - Delete a document
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.taxDocument.findUnique({
      where: { id },
      include: { taxProfile: true },
    });

    if (!existing || existing.taxProfile.userId !== userId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await prisma.taxDocument.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Tax Documents API] Error deleting:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
