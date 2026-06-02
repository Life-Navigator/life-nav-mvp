/**
 * Domain-specific extractors — Sprint N Phase 5.
 *
 * Built on top of `primitives.ts`. Each template looks for the
 * domain's signature fields and emits structured ExtractedEntity +
 * ExtractedFact rows.
 *
 * Templates implemented:
 *   - financial statement (bank / brokerage)
 *   - medical record (lab results + diagnoses)
 *   - insurance card
 *   - payroll (W-2 + paystub)
 *   - receipt (merchant + line items + total)
 */

import type { ExtractedEntity, ExtractedFact, SourceLocator } from '@/types/ingestion';
import {
  extractAllPrimitives,
  extractAmounts,
  extractAccountNumbers,
  extractDates,
  type PrimitiveContext,
} from './primitives';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blankResult(): { entities: ExtractedEntity[]; facts: ExtractedFact[] } {
  return { entities: [], facts: [] };
}

function loc(ctx: PrimitiveContext, char_start: number, char_end: number): SourceLocator {
  return {
    ...ctx.default_locator,
    char_start: (ctx.base_char ?? 0) + char_start,
    char_end: (ctx.base_char ?? 0) + char_end,
  };
}

function findMatch(text: string, re: RegExp): RegExpExecArray | null {
  re.lastIndex = 0;
  return re.exec(text);
}

// ---------------------------------------------------------------------------
// Financial Statement
// ---------------------------------------------------------------------------

const BANK_KEYWORDS = /\b(?:bank|credit union|brokerage|account statement|monthly statement)\b/i;
const STATEMENT_BALANCE_RE = /(?:ending|closing|new)\s+balance[:\s]+\$\s?([\d,]+\.\d{2})/i;
const STATEMENT_PERIOD_RE =
  /(?:statement|cycle|period)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|–|—)\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;

export function extractFinancialStatement(text: string, ctx: PrimitiveContext) {
  const out = blankResult();
  if (!BANK_KEYWORDS.test(text)) return out;

  const bal = findMatch(text, STATEMENT_BALANCE_RE);
  if (bal) {
    const value = parseFloat(bal[1].replace(/,/g, ''));
    out.entities.push({
      entity_kind: 'amount_usd',
      canonical_text: `$${value.toFixed(2)}`,
      attributes: { role: 'ending_balance', value, unit: 'USD' },
      confidence: 0.92,
    });
    out.facts.push({
      predicate: 'statement_ending_balance',
      object_value: value,
      object_unit: 'USD',
      extraction_confidence: 0.92,
      evidence_text: bal[0],
      source_locator: loc(ctx, bal.index, bal.index + bal[0].length),
    });
  }

  const period = findMatch(text, STATEMENT_PERIOD_RE);
  if (period) {
    out.facts.push({
      predicate: 'statement_period',
      object_jsonb: { start_label: period[1], end_label: period[2] },
      extraction_confidence: 0.85,
      evidence_text: period[0],
      source_locator: loc(ctx, period.index, period.index + period[0].length),
    });
  }

  // Pull account number + dates + amounts from the body for the graph.
  const acct = extractAccountNumbers(text, ctx);
  out.entities.push(...acct.entities);
  out.facts.push(...acct.facts);

  return out;
}

// ---------------------------------------------------------------------------
// Medical Record
// ---------------------------------------------------------------------------

const MEDICAL_KEYWORDS =
  /\b(?:lab\s+result|test\s+result|patient\s+name|diagnosis|prescription)\b/i;
const ICD10_RE = /\b([A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?)\b/g; // ICD-10-CM
const NPI_RE = /\bNPI[:\s]*([0-9]{10})\b/g;
const LAB_RE =
  /\b([A-Z][A-Za-z0-9 ]{2,30})[:\s]+([\d.]+)\s*(mg\/dL|mmol\/L|g\/dL|ng\/mL|U\/L|%|mmHg|bpm)\b/g;

export function extractMedicalRecord(text: string, ctx: PrimitiveContext) {
  const out = blankResult();
  if (!MEDICAL_KEYWORDS.test(text)) return out;

  let m: RegExpExecArray | null;
  ICD10_RE.lastIndex = 0;
  while ((m = ICD10_RE.exec(text)) !== null) {
    const code = m[1];
    out.entities.push({ entity_kind: 'icd10_code', canonical_text: code, confidence: 0.92 });
    out.facts.push({
      predicate: 'diagnosis_code',
      object_text: code,
      extraction_confidence: 0.92,
      evidence_text: m[0],
      source_locator: loc(ctx, m.index, m.index + m[0].length),
    });
  }
  NPI_RE.lastIndex = 0;
  while ((m = NPI_RE.exec(text)) !== null) {
    out.entities.push({ entity_kind: 'npi', canonical_text: m[1], confidence: 0.95 });
    out.facts.push({
      predicate: 'provider_npi',
      object_text: m[1],
      extraction_confidence: 0.95,
      evidence_text: m[0],
      source_locator: loc(ctx, m.index, m.index + m[0].length),
    });
  }
  LAB_RE.lastIndex = 0;
  while ((m = LAB_RE.exec(text)) !== null) {
    const name = m[1].trim();
    const value = parseFloat(m[2]);
    const unit = m[3];
    out.entities.push({
      entity_kind: 'lab_result',
      canonical_text: `${name}: ${value} ${unit}`,
      attributes: { name, value, unit },
      confidence: 0.85,
    });
    out.facts.push({
      predicate: 'lab_result',
      object_value: value,
      object_unit: unit,
      object_jsonb: { name },
      extraction_confidence: 0.85,
      evidence_text: m[0],
      source_locator: loc(ctx, m.index, m.index + m[0].length),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Insurance Card
// ---------------------------------------------------------------------------

const INSURANCE_KEYWORDS =
  /\b(?:member\s+id|policy\s+number|group\s+number|insurance\s+(?:card|carrier|plan)|rxbin|rxpcn)\b/i;
const MEMBER_ID_RE = /\b(?:member\s+id|subscriber\s+id)[:\s]+([A-Z0-9]{6,16})/i;
const GROUP_RE = /\bgroup\s+(?:number|#|no)\s*[:.]?\s*([A-Z0-9]{3,16})/i;
const POLICY_RE = /\bpolicy\s+(?:number|#|no)\s*[:.]?\s*([A-Z0-9]{6,20})/i;
const CARRIER_RE = /\b(?:insurance\s+carrier|insurer|payer)\s*[:.]?\s*([A-Z][A-Za-z &.'-]{2,40})/i;

export function extractInsuranceCard(text: string, ctx: PrimitiveContext) {
  const out = blankResult();
  if (!INSURANCE_KEYWORDS.test(text)) return out;

  for (const [re, kind, predicate] of [
    [MEMBER_ID_RE, 'member_id', 'insurance_member_id'],
    [GROUP_RE, 'group_number', 'insurance_group_number'],
    [POLICY_RE, 'policy_number', 'insurance_policy_number'],
    [CARRIER_RE, 'insurance_carrier', 'insurance_carrier_name'],
  ] as const) {
    const m = findMatch(text, re);
    if (m) {
      const value = m[1].trim();
      out.entities.push({ entity_kind: kind, canonical_text: value, confidence: 0.85 });
      out.facts.push({
        predicate,
        object_text: value,
        extraction_confidence: 0.85,
        evidence_text: m[0],
        source_locator: loc(ctx, m.index, m.index + m[0].length),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Payroll (W-2 + paystub)
// ---------------------------------------------------------------------------

const PAYROLL_KEYWORDS =
  /\b(?:W-?2|wages,?\s+tips,?\s+other\s+compensation|gross\s+pay|net\s+pay|YTD|pay\s+period)\b/i;
const W2_BOX_RE = /\b(?:Box\s+(\d{1,2}))\b[\s:.]*([\d,]+\.\d{2})/g;
const GROSS_RE = /\bgross\s+pay[:\s]+\$?\s?([\d,]+\.\d{2})/i;
const NET_RE = /\bnet\s+pay[:\s]+\$?\s?([\d,]+\.\d{2})/i;
const PAY_PERIOD_RE =
  /\bpay\s+period\s*[:.]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|–|—)\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;

export function extractPayroll(text: string, ctx: PrimitiveContext) {
  const out = blankResult();
  if (!PAYROLL_KEYWORDS.test(text)) return out;

  let m: RegExpExecArray | null;
  W2_BOX_RE.lastIndex = 0;
  while ((m = W2_BOX_RE.exec(text)) !== null) {
    const box = parseInt(m[1], 10);
    const value = parseFloat(m[2].replace(/,/g, ''));
    out.entities.push({
      entity_kind: 'w2_box',
      canonical_text: `Box ${box}: $${value.toFixed(2)}`,
      attributes: { box, value, unit: 'USD' },
      confidence: 0.9,
    });
    out.facts.push({
      predicate: 'w2_box_value',
      object_value: value,
      object_unit: 'USD',
      object_jsonb: { box },
      extraction_confidence: 0.9,
      evidence_text: m[0],
      source_locator: loc(ctx, m.index, m.index + m[0].length),
    });
  }

  const gross = findMatch(text, GROSS_RE);
  if (gross) {
    const value = parseFloat(gross[1].replace(/,/g, ''));
    out.facts.push({
      predicate: 'paystub_gross_pay',
      object_value: value,
      object_unit: 'USD',
      extraction_confidence: 0.92,
      evidence_text: gross[0],
      source_locator: loc(ctx, gross.index, gross.index + gross[0].length),
    });
  }
  const net = findMatch(text, NET_RE);
  if (net) {
    const value = parseFloat(net[1].replace(/,/g, ''));
    out.facts.push({
      predicate: 'paystub_net_pay',
      object_value: value,
      object_unit: 'USD',
      extraction_confidence: 0.92,
      evidence_text: net[0],
      source_locator: loc(ctx, net.index, net.index + net[0].length),
    });
  }
  const period = findMatch(text, PAY_PERIOD_RE);
  if (period) {
    out.facts.push({
      predicate: 'paystub_pay_period',
      object_jsonb: { start_label: period[1], end_label: period[2] },
      extraction_confidence: 0.85,
      evidence_text: period[0],
      source_locator: loc(ctx, period.index, period.index + period[0].length),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------

const RECEIPT_KEYWORDS = /\b(?:subtotal|tax|total|amount\s+due|merchant|cashier|receipt)\b/i;
const TOTAL_RE = /\btotal[:\s]+\$?\s?([\d,]+\.\d{2})/i;
const SUBTOTAL_RE = /\bsubtotal[:\s]+\$?\s?([\d,]+\.\d{2})/i;
const TAX_RE = /\btax[:\s]+\$?\s?([\d,]+\.\d{2})/i;
const MERCHANT_RE = /^([A-Z][A-Z0-9& .'-]{2,40})\s*$/m;

export function extractReceipt(text: string, ctx: PrimitiveContext) {
  const out = blankResult();
  if (!RECEIPT_KEYWORDS.test(text)) return out;

  const merchant = findMatch(text, MERCHANT_RE);
  if (merchant) {
    out.entities.push({
      entity_kind: 'receipt_merchant',
      canonical_text: merchant[1].trim(),
      confidence: 0.7,
    });
    out.facts.push({
      predicate: 'receipt_merchant_name',
      object_text: merchant[1].trim(),
      extraction_confidence: 0.7,
      evidence_text: merchant[0],
      source_locator: loc(ctx, merchant.index, merchant.index + merchant[0].length),
    });
  }
  for (const [re, predicate] of [
    [TOTAL_RE, 'receipt_total'],
    [SUBTOTAL_RE, 'receipt_subtotal'],
    [TAX_RE, 'receipt_tax'],
  ] as const) {
    const m = findMatch(text, re);
    if (m) {
      const value = parseFloat(m[1].replace(/,/g, ''));
      out.facts.push({
        predicate,
        object_value: value,
        object_unit: 'USD',
        extraction_confidence: 0.9,
        evidence_text: m[0],
        source_locator: loc(ctx, m.index, m.index + m[0].length),
      });
    }
  }
  const d = extractDates(text, ctx);
  out.entities.push(...d.entities);
  out.facts.push(...d.facts);
  return out;
}

// ---------------------------------------------------------------------------
// Run all domain templates
// ---------------------------------------------------------------------------

export function runDomainTemplates(text: string, ctx: PrimitiveContext) {
  const merged = blankResult();
  for (const fn of [
    extractFinancialStatement,
    extractMedicalRecord,
    extractInsuranceCard,
    extractPayroll,
    extractReceipt,
  ]) {
    const r = fn(text, ctx);
    merged.entities.push(...r.entities);
    merged.facts.push(...r.facts);
  }
  // Always run primitives — they catch dates/amounts/emails across all docs.
  const p = extractAllPrimitives(text, ctx);
  merged.entities.push(...p.entities);
  merged.facts.push(...p.facts);
  return merged;
}

export const __test = {
  extractFinancialStatement,
  extractMedicalRecord,
  extractInsuranceCard,
  extractPayroll,
  extractReceipt,
  runDomainTemplates,
};
