import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db as prisma } from '@/lib/db';
import { FilingStatus } from "@/types/tax";


interface JWTPayload {
  sub: string;
  exp: number;
}

// 2024 federal income tax brackets
const federalTaxBrackets2024: Record<FilingStatus, { rate: number; min: number; max: number | null }[]> = {
  single: [
    { rate: 10, min: 0, max: 11600 },
    { rate: 12, min: 11600, max: 47150 },
    { rate: 22, min: 47150, max: 100525 },
    { rate: 24, min: 100525, max: 191950 },
    { rate: 32, min: 191950, max: 243725 },
    { rate: 35, min: 243725, max: 609350 },
    { rate: 37, min: 609350, max: null }
  ],
  married_jointly: [
    { rate: 10, min: 0, max: 23200 },
    { rate: 12, min: 23200, max: 94300 },
    { rate: 22, min: 94300, max: 201050 },
    { rate: 24, min: 201050, max: 383900 },
    { rate: 32, min: 383900, max: 487450 },
    { rate: 35, min: 487450, max: 731200 },
    { rate: 37, min: 731200, max: null }
  ],
  married_separately: [
    { rate: 10, min: 0, max: 11600 },
    { rate: 12, min: 11600, max: 47150 },
    { rate: 22, min: 47150, max: 100525 },
    { rate: 24, min: 100525, max: 191950 },
    { rate: 32, min: 191950, max: 243725 },
    { rate: 35, min: 243725, max: 365600 },
    { rate: 37, min: 365600, max: null }
  ],
  head_of_household: [
    { rate: 10, min: 0, max: 16550 },
    { rate: 12, min: 16550, max: 63100 },
    { rate: 22, min: 63100, max: 100500 },
    { rate: 24, min: 100500, max: 191950 },
    { rate: 32, min: 191950, max: 243700 },
    { rate: 35, min: 243700, max: 609350 },
    { rate: 37, min: 609350, max: null }
  ]
};

// 2024 standard deduction amounts
const standardDeduction2024: Record<FilingStatus, number> = {
  single: 14600,
  married_jointly: 29200,
  married_separately: 14600,
  head_of_household: 21900
};

// Additional standard deduction for age 65+ or blind
const additionalStandardDeduction = {
  single: 1950,
  married_jointly: 1550,
  married_separately: 1550,
  head_of_household: 1950
};

// Capital gains tax brackets 2024
const capitalGainsBrackets: Record<FilingStatus, { rate: number; max: number | null }[]> = {
  single: [
    { rate: 0, max: 47025 },
    { rate: 15, max: 518900 },
    { rate: 20, max: null }
  ],
  married_jointly: [
    { rate: 0, max: 94050 },
    { rate: 15, max: 583750 },
    { rate: 20, max: null }
  ],
  married_separately: [
    { rate: 0, max: 47025 },
    { rate: 15, max: 291850 },
    { rate: 20, max: null }
  ],
  head_of_household: [
    { rate: 0, max: 63000 },
    { rate: 15, max: 551350 },
    { rate: 20, max: null }
  ]
};

// FICA constants
const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_WAGE_BASE = 168600;
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married_jointly: 250000,
  married_separately: 125000,
  head_of_household: 200000
};

// NIIT threshold
const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married_jointly: 250000,
  married_separately: 125000,
  head_of_household: 200000
};
const NIIT_RATE = 0.038;

// Self-employment tax
const SE_TAX_RATE = 0.153; // 12.4% SS + 2.9% Medicare
const SE_INCOME_MULTIPLIER = 0.9235;

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

function calculateBracketTax(taxableIncome: number, filingStatus: FilingStatus) {
  const brackets = federalTaxBrackets2024[filingStatus];
  let tax = 0;
  let remainingIncome = taxableIncome;
  const bracketDetails: { rate: number; min: number; max: number | null; taxableInBracket: number; taxFromBracket: number }[] = [];

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketRange = bracket.max === null ? Infinity : bracket.max - bracket.min;
    const taxableInBracket = Math.min(remainingIncome, bracketRange);
    const taxFromBracket = taxableInBracket * (bracket.rate / 100);

    bracketDetails.push({
      rate: bracket.rate,
      min: bracket.min,
      max: bracket.max,
      taxableInBracket,
      taxFromBracket
    });

    tax += taxFromBracket;
    remainingIncome -= taxableInBracket;
  }

  return { tax, bracketDetails };
}

function calculateCapitalGainsTax(
  longTermGains: number,
  taxableIncome: number,
  filingStatus: FilingStatus
) {
  const brackets = capitalGainsBrackets[filingStatus];
  let tax = 0;
  let remainingGains = longTermGains;
  let currentIncome = taxableIncome - longTermGains; // Ordinary income fills brackets first

  for (const bracket of brackets) {
    if (remainingGains <= 0) break;

    const bracketMax = bracket.max === null ? Infinity : bracket.max;
    const roomInBracket = Math.max(0, bracketMax - currentIncome);
    const gainsInBracket = Math.min(remainingGains, roomInBracket);

    tax += gainsInBracket * (bracket.rate / 100);
    remainingGains -= gainsInBracket;
    currentIncome += gainsInBracket;
  }

  return tax;
}

// POST /api/tax/calculate - Calculate comprehensive tax estimate
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taxYear = new Date().getFullYear(), scenarioId, saveEstimate = true } = body;

    // Fetch the tax profile with all data
    const profile = await prisma.taxProfile.findUnique({
      where: { userId_taxYear: { userId, taxYear } },
      include: {
        incomes: true,
        deductions: true,
        credits: true,
        quarterlyPayments: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Tax profile not found" }, { status: 404 });
    }

    const filingStatus = profile.filingStatus as FilingStatus;

    // Calculate gross income by category
    let wagesIncome = 0;
    let selfEmploymentIncome = 0;
    let businessIncome = 0;
    let interestIncome = 0;
    let dividendIncome = 0;
    let qualifiedDividends = 0;
    let shortTermGains = 0;
    let longTermGains = 0;
    let rentalIncome = 0;
    let retirementIncome = 0;
    let socialSecurityIncome = 0;
    let otherIncome = 0;
    let totalWithholding = 0;
    let qbiEligibleIncome = 0;

    for (const income of profile.incomes) {
      totalWithholding += income.taxWithheld;

      switch (income.category) {
        case "wages":
          wagesIncome += income.amount;
          break;
        case "self_employment":
          selfEmploymentIncome += (income.netIncome ?? income.amount - income.expenses);
          if (income.qbiEligible) qbiEligibleIncome += (income.netIncome ?? income.amount - income.expenses);
          break;
        case "business":
          businessIncome += (income.netIncome ?? income.amount - income.expenses);
          if (income.qbiEligible) qbiEligibleIncome += (income.netIncome ?? income.amount - income.expenses);
          break;
        case "interest":
          interestIncome += income.amount;
          break;
        case "dividends":
          if (income.isQualified) {
            qualifiedDividends += income.amount;
          }
          dividendIncome += income.amount;
          break;
        case "capital_gains":
          if (income.subcategory === "long_term") {
            longTermGains += income.amount;
          } else {
            shortTermGains += income.amount;
          }
          break;
        case "rental":
          rentalIncome += (income.netIncome ?? income.amount - income.expenses);
          break;
        case "retirement":
          retirementIncome += income.amount;
          break;
        case "social_security":
          socialSecurityIncome += income.amount;
          break;
        default:
          otherIncome += income.amount;
      }
    }

    // Calculate taxable Social Security (up to 85%)
    const taxableSocialSecurity = socialSecurityIncome * 0.85; // Simplified - actual calculation is more complex

    const grossIncome = wagesIncome + selfEmploymentIncome + businessIncome +
                       interestIncome + dividendIncome + shortTermGains + longTermGains +
                       rentalIncome + retirementIncome + taxableSocialSecurity + otherIncome;

    // Calculate above-the-line deductions
    let aboveLineDeductions = 0;
    for (const ded of profile.deductions.filter(d => d.category === "above_the_line")) {
      aboveLineDeductions += ded.amount;
    }

    // Self-employment tax deduction (half of SE tax)
    const seIncome = selfEmploymentIncome * SE_INCOME_MULTIPLIER;
    const selfEmploymentTax = Math.min(seIncome, SOCIAL_SECURITY_WAGE_BASE) * 0.124 + seIncome * 0.029;
    const seDeduction = selfEmploymentTax / 2;
    aboveLineDeductions += seDeduction;

    const adjustedGrossIncome = grossIncome - aboveLineDeductions;

    // Calculate standard vs itemized deductions
    let standardDeduction = standardDeduction2024[filingStatus];
    if (profile.isOver65) standardDeduction += additionalStandardDeduction[filingStatus];
    if (profile.isBlind) standardDeduction += additionalStandardDeduction[filingStatus];
    if (filingStatus === "married_jointly" || filingStatus === "married_separately") {
      if (profile.spouseIsOver65) standardDeduction += additionalStandardDeduction[filingStatus];
      if (profile.spouseIsBlind) standardDeduction += additionalStandardDeduction[filingStatus];
    }

    let itemizedDeductions = 0;
    const saltCap = 10000; // SALT cap
    let saltTotal = 0;

    for (const ded of profile.deductions.filter(d => d.category === "itemized")) {
      if (ded.type === "state_local_tax" || ded.type === "property_tax") {
        saltTotal += ded.amount;
      } else if (ded.type === "medical") {
        // Medical expenses only deductible above 7.5% AGI
        const threshold = adjustedGrossIncome * 0.075;
        if (ded.amount > threshold) {
          itemizedDeductions += ded.amount - threshold;
        }
      } else {
        itemizedDeductions += ded.amount;
      }
    }
    itemizedDeductions += Math.min(saltTotal, saltCap);

    const deductionUsed = itemizedDeductions > standardDeduction ? "itemized" : "standard";
    const totalDeductions = Math.max(itemizedDeductions, standardDeduction);

    // QBI Deduction (simplified - 20% of QBI for qualifying taxpayers)
    let qbiDeduction = 0;
    if (qbiEligibleIncome > 0) {
      const taxableIncomeBeforeQBI = adjustedGrossIncome - totalDeductions;
      const qbiLimit = taxableIncomeBeforeQBI * 0.2;
      qbiDeduction = Math.min(qbiEligibleIncome * 0.2, qbiLimit);
    }

    const taxableIncome = Math.max(0, adjustedGrossIncome - totalDeductions - qbiDeduction);

    // Calculate ordinary income tax (excluding long-term gains and qualified dividends)
    const ordinaryTaxableIncome = taxableIncome - longTermGains - qualifiedDividends;
    const { tax: ordinaryIncomeTax, bracketDetails } = calculateBracketTax(
      Math.max(0, ordinaryTaxableIncome),
      filingStatus
    );

    // Calculate capital gains tax on long-term gains and qualified dividends
    const preferentialIncome = longTermGains + qualifiedDividends;
    const capitalGainsTax = calculateCapitalGainsTax(preferentialIncome, taxableIncome, filingStatus);

    // Additional Medicare tax
    const additionalMedicareTax = Math.max(0, wagesIncome - ADDITIONAL_MEDICARE_THRESHOLD[filingStatus]) * ADDITIONAL_MEDICARE_RATE;

    // Net Investment Income Tax (NIIT)
    const netInvestmentIncome = interestIncome + dividendIncome + shortTermGains + longTermGains + rentalIncome;
    const niitThreshold = NIIT_THRESHOLD[filingStatus];
    const niitBase = Math.min(netInvestmentIncome, Math.max(0, adjustedGrossIncome - niitThreshold));
    const netInvestmentIncomeTax = niitBase * NIIT_RATE;

    // Total tax before credits
    const totalTaxBeforeCredits = ordinaryIncomeTax + capitalGainsTax + selfEmploymentTax +
                                  additionalMedicareTax + netInvestmentIncomeTax;

    // Calculate credits
    let nonrefundableCredits = 0;
    let refundableCredits = 0;

    for (const credit of profile.credits) {
      if (credit.isRefundable) {
        refundableCredits += credit.amount;
      } else if (credit.isPartiallyRefundable) {
        nonrefundableCredits += credit.amount - (credit.refundableAmount || 0);
        refundableCredits += credit.refundableAmount || 0;
      } else {
        nonrefundableCredits += credit.amount;
      }
    }

    // Apply non-refundable credits (can't reduce below zero)
    const taxAfterNonrefundable = Math.max(0, totalTaxBeforeCredits - nonrefundableCredits);
    const totalTaxLiability = taxAfterNonrefundable - refundableCredits;

    // Calculate payments
    const estimatedPayments = profile.quarterlyPayments
      .filter(q => q.status === "paid")
      .reduce((sum, q) => sum + q.actualPayment, 0);
    const totalPayments = totalWithholding + estimatedPayments;

    // Final result
    const refundOrOwed = totalPayments - totalTaxLiability;

    // Calculate rates
    const marginalRate = bracketDetails.length > 0 ? bracketDetails[bracketDetails.length - 1].rate : 10;
    const effectiveRate = grossIncome > 0 ? (totalTaxLiability / grossIncome) * 100 : 0;

    const estimate = {
      calculatedAt: new Date(),
      scenarioId,
      grossIncome,
      adjustedGrossIncome,
      taxableIncome,
      aboveLineDeductions,
      standardDeduction,
      itemizedDeductions,
      deductionUsed,
      totalDeductions,
      qbiDeduction,
      ordinaryIncomeTax,
      capitalGainsTax,
      selfEmploymentTax,
      additionalMedicareTax,
      netInvestmentIncomeTax,
      alternativeMinimumTax: 0, // AMT calculation is complex, simplified here
      totalTaxBeforeCredits,
      nonrefundableCredits,
      refundableCredits,
      totalCredits: nonrefundableCredits + refundableCredits,
      totalTaxLiability,
      totalWithholding,
      estimatedPayments,
      totalPayments,
      refundOrOwed,
      marginalRate,
      effectiveRate,
      breakdown: {
        brackets: bracketDetails,
        capitalGains: {
          shortTerm: shortTermGains,
          longTerm: longTermGains,
          rate0: 0,
          rate15: 0,
          rate20: 0
        },
        fica: {
          socialSecurity: Math.min(wagesIncome, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE,
          medicare: wagesIncome * MEDICARE_RATE,
          additionalMedicare: additionalMedicareTax
        },
        selfEmployment: {
          taxableAmount: seIncome,
          tax: selfEmploymentTax,
          deduction: seDeduction
        },
        niit: {
          threshold: niitThreshold,
          netInvestmentIncome,
          tax: netInvestmentIncomeTax
        },
        amt: {
          amtIncome: 0,
          exemption: 0,
          tentativeMinimumTax: 0,
          amtOwed: 0
        }
      }
    };

    // Save estimate if requested
    if (saveEstimate) {
      await prisma.taxEstimate.create({
        data: {
          taxProfileId: profile.id,
          scenarioId,
          grossIncome: estimate.grossIncome,
          adjustedGrossIncome: estimate.adjustedGrossIncome,
          taxableIncome: estimate.taxableIncome,
          aboveLineDeductions: estimate.aboveLineDeductions,
          standardDeduction: estimate.standardDeduction,
          itemizedDeductions: estimate.itemizedDeductions,
          deductionUsed: estimate.deductionUsed,
          totalDeductions: estimate.totalDeductions,
          qbiDeduction: estimate.qbiDeduction,
          ordinaryIncomeTax: estimate.ordinaryIncomeTax,
          capitalGainsTax: estimate.capitalGainsTax,
          selfEmploymentTax: estimate.selfEmploymentTax,
          additionalMedicareTax: estimate.additionalMedicareTax,
          netInvestmentIncomeTax: estimate.netInvestmentIncomeTax,
          alternativeMinimumTax: estimate.alternativeMinimumTax,
          totalTaxBeforeCredits: estimate.totalTaxBeforeCredits,
          nonrefundableCredits: estimate.nonrefundableCredits,
          refundableCredits: estimate.refundableCredits,
          totalCredits: estimate.totalCredits,
          totalTaxLiability: estimate.totalTaxLiability,
          totalWithholding: estimate.totalWithholding,
          estimatedPayments: estimate.estimatedPayments,
          totalPayments: estimate.totalPayments,
          refundOrOwed: estimate.refundOrOwed,
          marginalRate: estimate.marginalRate,
          effectiveRate: estimate.effectiveRate,
          breakdown: estimate.breakdown,
        },
      });

      // Update profile last calculated time
      await prisma.taxProfile.update({
        where: { id: profile.id },
        data: { lastCalculatedAt: new Date() },
      });
    }

    return NextResponse.json({ estimate });
  } catch (error) {
    console.error("[Tax Calculate API] Error:", error);
    return NextResponse.json({ error: "Failed to calculate taxes" }, { status: 500 });
  }
}
