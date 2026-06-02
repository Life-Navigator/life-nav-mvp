/**
 * CSV extractor.
 *
 * Conservative RFC4180-style parser:
 *   - sniffs the delimiter from a sample (`,`, `;`, `\t`, `|`)
 *   - handles quoted fields with embedded commas and escaped quotes
 *   - treats the first row as headers when ≥1 cell is non-numeric
 *
 * Output:
 *   - extraction_kind: 'tabular'
 *   - structured: { headers, rows, delimiter, header_inferred }
 *   - facts: NONE here — domain extractors run downstream on the table
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';

const DELIM_CANDIDATES = [',', ';', '\t', '|'];

export function sniffDelimiter(sample: string): string {
  let best = ',';
  let bestScore = -1;
  for (const d of DELIM_CANDIDATES) {
    const lines = sample
      .split(/\r?\n/)
      .slice(0, 10)
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;
    const counts = lines.map((l) => l.split(d).length);
    const mean = counts.reduce((s, x) => s + x, 0) / counts.length;
    const variance = counts.reduce((s, x) => s + (x - mean) ** 2, 0) / counts.length;
    // High mean + low variance = good delimiter
    const score = mean - variance;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
  header_inferred: boolean;
}

export function parseCsv(text: string): ParsedCsv {
  const delim = sniffDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: delim, header_inferred: false };
  }
  const first = parseLine(lines[0], delim);
  const headerLooksLikeData = first.every((c) => /^-?\d+(\.\d+)?$/.test(c.trim()));
  const headers = headerLooksLikeData ? first.map((_, i) => `col_${i + 1}`) : first;
  const start = headerLooksLikeData ? 0 : 1;
  const rows: string[][] = [];
  for (let i = start; i < lines.length; i++) rows.push(parseLine(lines[i], delim));
  return { headers, rows, delimiter: delim, header_inferred: headerLooksLikeData };
}

export const csvExtractor: ExtractorAdapter = {
  name: 'csv',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'csv';
  },
  extract(input: ExtractorInput): ExtractorOutput {
    const text =
      input.text ??
      new TextDecoder('utf-8', { fatal: false }).decode(input.bytes ?? new Uint8Array());
    const parsed = parseCsv(text);
    return {
      extractor_name: 'csv',
      extractor_version: '1.0.0',
      extraction_kind: 'tabular',
      text: undefined,
      structured: parsed as unknown as Record<string, unknown>,
      confidence: parsed.rows.length > 0 ? 0.95 : 0.5,
    };
  },
};

export const __test = { sniffDelimiter, parseLine, parseCsv, csvExtractor };
