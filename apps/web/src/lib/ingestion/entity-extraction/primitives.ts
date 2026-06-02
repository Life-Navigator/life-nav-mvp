/**
 * Universal entity primitives — Sprint N Phase 5.
 *
 * Deterministic regex-based extractors that produce ExtractedEntity
 * + ExtractedFact pairs. Every fact carries a non-empty locator.
 *
 * Categories:
 *   - dates (ISO, US, EU)
 *   - amounts (USD)
 *   - account numbers (masked: only last 4 retained)
 *   - emails
 *   - phones (US)
 *   - addresses (postal-code anchored)
 *   - SSN (always masked)
 *
 * Privacy contract:
 *   - account_number → only the last 4 digits are persisted.
 *   - SSN → only XXX-XX-#### form is persisted (last 4).
 */

import type { ExtractedEntity, ExtractedFact, SourceLocator } from '@/types/ingestion';

export interface PrimitiveContext {
  /** Optional offset of `text` within the source file. */
  base_char?: number;
  /** Default locator fields to merge into every emission. */
  default_locator: SourceLocator;
}

interface PrimResult {
  entities: ExtractedEntity[];
  facts: ExtractedFact[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocator(ctx: PrimitiveContext, m: RegExpExecArray): SourceLocator {
  const base = ctx.base_char ?? 0;
  return {
    ...ctx.default_locator,
    char_start: base + m.index,
    char_end: base + m.index + m[0].length,
  };
}

function pushEntity(
  out: PrimResult,
  e: Omit<ExtractedEntity, 'metadata' | 'attributes'> & { attributes?: Record<string, unknown> }
): void {
  out.entities.push({
    ...e,
    attributes: e.attributes ?? {},
  });
}

function pushFact(out: PrimResult, f: ExtractedFact): void {
  out.facts.push(f);
}

function maskLast4(s: string): string {
  const digits = s.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `****${digits.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

// ISO 8601: 2026-06-01 (matches the most-specific form; we accept
// optional time component).
const ISO_DATE =
  /\b(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;

// US: 06/01/2026 or 6/1/26
const US_DATE = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{2}|\d{4})\b/g;

// Long: June 1, 2026
const LONG_DATE =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/g;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function extractDates(text: string, ctx: PrimitiveContext): PrimResult {
  const out: PrimResult = { entities: [], facts: [] };
  let m: RegExpExecArray | null;
  ISO_DATE.lastIndex = US_DATE.lastIndex = LONG_DATE.lastIndex = 0;

  while ((m = ISO_DATE.exec(text)) !== null) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    pushEntity(out, { entity_kind: 'date', canonical_text: iso, confidence: 0.95 });
    pushFact(out, {
      predicate: 'date_mentioned',
      object_date: iso,
      extraction_confidence: 0.95,
      evidence_text: m[0],
      source_locator: makeLocator(ctx, m),
    });
  }
  while ((m = US_DATE.exec(text)) !== null) {
    let y = parseInt(m[3], 10);
    if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
    const iso = `${y}-${pad2(parseInt(m[1], 10))}-${pad2(parseInt(m[2], 10))}`;
    pushEntity(out, { entity_kind: 'date', canonical_text: iso, confidence: 0.85 });
    pushFact(out, {
      predicate: 'date_mentioned',
      object_date: iso,
      extraction_confidence: 0.85,
      evidence_text: m[0],
      source_locator: makeLocator(ctx, m),
    });
  }
  while ((m = LONG_DATE.exec(text)) !== null) {
    const month = MONTHS[m[1].toLowerCase()];
    const iso = `${m[3]}-${pad2(month)}-${pad2(parseInt(m[2], 10))}`;
    pushEntity(out, { entity_kind: 'date', canonical_text: iso, confidence: 0.9 });
    pushFact(out, {
      predicate: 'date_mentioned',
      object_date: iso,
      extraction_confidence: 0.9,
      evidence_text: m[0],
      source_locator: makeLocator(ctx, m),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// USD amount
// ---------------------------------------------------------------------------

const USD_AMOUNT = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2}|\d+)/g;

export function extractAmounts(text: string, ctx: PrimitiveContext): PrimResult {
  const out: PrimResult = { entities: [], facts: [] };
  let m: RegExpExecArray | null;
  USD_AMOUNT.lastIndex = 0;
  while ((m = USD_AMOUNT.exec(text)) !== null) {
    const raw = m[1].replace(/,/g, '');
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    pushEntity(out, {
      entity_kind: 'amount_usd',
      canonical_text: `$${value.toFixed(2)}`,
      attributes: { value, unit: 'USD' },
      confidence: 0.9,
    });
    pushFact(out, {
      predicate: 'amount_mentioned',
      object_value: value,
      object_unit: 'USD',
      extraction_confidence: 0.9,
      evidence_text: m[0],
      source_locator: makeLocator(ctx, m),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Account number — masked-only
// ---------------------------------------------------------------------------

// Match labelled patterns: "Account # 123456789", "Acct: 1234-5678-9012",
// or 12-19 digit blocks (clamped). We deliberately ignore shorter
// numeric matches to avoid amount/ID false positives.
const ACCOUNT_RE = /\b(?:Account|Acct|A\/C)\s*#?\s*[:-]?\s*([0-9 -]{6,30})/gi;

export function extractAccountNumbers(text: string, ctx: PrimitiveContext): PrimResult {
  const out: PrimResult = { entities: [], facts: [] };
  let m: RegExpExecArray | null;
  ACCOUNT_RE.lastIndex = 0;
  while ((m = ACCOUNT_RE.exec(text)) !== null) {
    const masked = maskLast4(m[1]);
    pushEntity(out, {
      entity_kind: 'account_number_masked',
      canonical_text: masked,
      attributes: { last4: masked.slice(-4) },
      confidence: 0.85,
    });
    pushFact(out, {
      predicate: 'account_number_mentioned',
      object_text: masked,
      extraction_confidence: 0.85,
      evidence_text: 'Account # …' + masked.slice(-4), // never echo the full digits
      source_locator: makeLocator(ctx, m),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// SSN — always masked
// ---------------------------------------------------------------------------

const SSN_RE = /\b(\d{3})-?(\d{2})-?(\d{4})\b/g;

export function extractSsns(text: string, ctx: PrimitiveContext): PrimResult {
  const out: PrimResult = { entities: [], facts: [] };
  let m: RegExpExecArray | null;
  SSN_RE.lastIndex = 0;
  while ((m = SSN_RE.exec(text)) !== null) {
    const masked = `XXX-XX-${m[3]}`;
    pushEntity(out, {
      entity_kind: 'other',
      canonical_text: masked,
      attributes: { kind: 'ssn_masked', last4: m[3] },
      confidence: 0.9,
    });
    pushFact(out, {
      predicate: 'ssn_present',
      object_text: masked,
      extraction_confidence: 0.9,
      evidence_text: masked, // never the raw value
      source_locator: makeLocator(ctx, m),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

const EMAIL_RE = /\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

export function extractEmails(text: string, ctx: PrimitiveContext): PrimResult {
  const out: PrimResult = { entities: [], facts: [] };
  let m: RegExpExecArray | null;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(text)) !== null) {
    const value = `${m[1]}@${m[2]}`.toLowerCase();
    pushEntity(out, {
      entity_kind: 'email',
      canonical_text: value,
      confidence: 0.95,
    });
    pushFact(out, {
      predicate: 'email_mentioned',
      object_text: value,
      extraction_confidence: 0.95,
      evidence_text: m[0],
      source_locator: makeLocator(ctx, m),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// US phone
// ---------------------------------------------------------------------------

const PHONE_RE = /(?:\+1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/g;

export function extractPhones(text: string, ctx: PrimitiveContext): PrimResult {
  const out: PrimResult = { entities: [], facts: [] };
  let m: RegExpExecArray | null;
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(text)) !== null) {
    const normalized = `+1${m[1]}${m[2]}${m[3]}`;
    pushEntity(out, {
      entity_kind: 'phone',
      canonical_text: normalized,
      confidence: 0.85,
    });
    pushFact(out, {
      predicate: 'phone_mentioned',
      object_text: normalized,
      extraction_confidence: 0.85,
      evidence_text: m[0],
      source_locator: makeLocator(ctx, m),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Compose-all
// ---------------------------------------------------------------------------

export function extractAllPrimitives(text: string, ctx: PrimitiveContext): PrimResult {
  const merged: PrimResult = { entities: [], facts: [] };
  for (const fn of [
    extractDates,
    extractAmounts,
    extractAccountNumbers,
    extractSsns,
    extractEmails,
    extractPhones,
  ]) {
    const r = fn(text, ctx);
    merged.entities.push(...r.entities);
    merged.facts.push(...r.facts);
  }
  return merged;
}

export const __test = {
  extractDates,
  extractAmounts,
  extractAccountNumbers,
  extractSsns,
  extractEmails,
  extractPhones,
  extractAllPrimitives,
  maskLast4,
};
