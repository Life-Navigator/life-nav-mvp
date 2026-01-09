/**
 * OCR Field Extraction Patterns
 *
 * Deterministic patterns for extracting structured data from documents
 */

import type { FieldType } from '../types';

export interface ExtractedField {
  field_key: string;
  field_value: string;
  field_type: FieldType;
  confidence_score: number;
  source_page?: number;
  source_text?: string;
}

// Currency extraction
const CURRENCY_PATTERNS = [
  /\$\s*([0-9,]+\.?\d{0,2})/g,
  /([0-9,]+\.?\d{0,2})\s*(?:dollars?|USD)/gi,
];

// Date extraction
const DATE_PATTERNS = [
  /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g,
  /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/g,
];

// Number extraction
const NUMBER_PATTERNS = [
  /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,
];

// Percentage extraction
const PERCENT_PATTERNS = [
  /(\d+\.?\d*)\s*%/g,
];

/**
 * Extract all potential currency values from text
 */
export function extractCurrencyValues(text: string, page?: number): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const pattern of CURRENCY_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1].replace(/,/g, '');
      if (seen.has(value)) continue;
      seen.add(value);

      const startIndex = match.index || 0;
      const contextStart = Math.max(0, startIndex - 50);
      const contextEnd = Math.min(text.length, startIndex + 50);
      const context = text.substring(contextStart, contextEnd);

      fields.push({
        field_key: inferCurrencyFieldKey(context),
        field_value: value,
        field_type: 'currency',
        confidence_score: 0.8,
        source_page: page,
        source_text: context.trim(),
      });
    }
  }

  return fields;
}

/**
 * Extract dates from text
 */
export function extractDates(text: string, page?: number): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const pattern of DATE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1];
      if (seen.has(value)) continue;
      seen.add(value);

      const startIndex = match.index || 0;
      const contextStart = Math.max(0, startIndex - 50);
      const contextEnd = Math.min(text.length, startIndex + 50);
      const context = text.substring(contextStart, contextEnd);

      fields.push({
        field_key: inferDateFieldKey(context),
        field_value: value,
        field_type: 'date',
        confidence_score: 0.75,
        source_page: page,
        source_text: context.trim(),
      });
    }
  }

  return fields;
}

/**
 * Extract percentages (APR, interest rates)
 */
export function extractPercentages(text: string, page?: number): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const pattern of PERCENT_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1];
      if (seen.has(value)) continue;
      seen.add(value);

      const startIndex = match.index || 0;
      const contextStart = Math.max(0, startIndex - 50);
      const contextEnd = Math.min(text.length, startIndex + 50);
      const context = text.substring(contextStart, contextEnd);

      fields.push({
        field_key: inferPercentFieldKey(context),
        field_value: value,
        field_type: 'number',
        confidence_score: 0.85,
        source_page: page,
        source_text: context.trim(),
      });
    }
  }

  return fields;
}

/**
 * Infer field key from context for currency values
 */
function inferCurrencyFieldKey(context: string): string {
  const lower = context.toLowerCase();

  // Education
  if (lower.includes('tuition')) return 'tuition';
  if (lower.includes('fee') || lower.includes('fees')) return 'fees';
  if (lower.includes('scholarship')) return 'scholarship';
  if (lower.includes('grant')) return 'grant';

  // Career
  if (lower.includes('salary') || lower.includes('annual')) return 'annual_income';
  if (lower.includes('hourly') || lower.includes('hour')) return 'hourly_wage';
  if (lower.includes('bonus')) return 'bonus';

  // Housing
  if (lower.includes('rent')) return 'rent';
  if (lower.includes('mortgage')) return 'mortgage';
  if (lower.includes('property tax')) return 'property_tax';

  // Debt
  if (lower.includes('principal') || lower.includes('balance')) return 'loan_principal';
  if (lower.includes('payment') || lower.includes('monthly')) return 'monthly_payment';

  // Insurance
  if (lower.includes('premium')) return 'premium';
  if (lower.includes('deductible')) return 'deductible';

  // Default
  return 'amount';
}

/**
 * Infer field key from context for dates
 */
function inferDateFieldKey(context: string): string {
  const lower = context.toLowerCase();

  if (lower.includes('graduation') || lower.includes('graduate')) return 'graduation_date';
  if (lower.includes('enrollment') || lower.includes('start')) return 'enrollment_date';
  if (lower.includes('due') || lower.includes('deadline')) return 'deadline';
  if (lower.includes('payoff') || lower.includes('maturity')) return 'payoff_date';

  return 'date';
}

/**
 * Infer field key from context for percentages
 */
function inferPercentFieldKey(context: string): string {
  const lower = context.toLowerCase();

  if (lower.includes('apr') || lower.includes('annual percentage rate')) return 'apr';
  if (lower.includes('interest')) return 'interest_rate';
  if (lower.includes('return')) return 'return_rate';

  return 'rate';
}

/**
 * Extract structured fields from full document text
 */
export function extractFieldsFromText(text: string, page?: number): ExtractedField[] {
  const allFields: ExtractedField[] = [];

  // Extract currency values
  allFields.push(...extractCurrencyValues(text, page));

  // Extract dates
  allFields.push(...extractDates(text, page));

  // Extract percentages
  allFields.push(...extractPercentages(text, page));

  // Deduplicate by field_key (keep highest confidence)
  const fieldMap = new Map<string, ExtractedField>();
  for (const field of allFields) {
    const existing = fieldMap.get(field.field_key);
    if (!existing || field.confidence_score > existing.confidence_score) {
      fieldMap.set(field.field_key, field);
    }
  }

  return Array.from(fieldMap.values());
}
