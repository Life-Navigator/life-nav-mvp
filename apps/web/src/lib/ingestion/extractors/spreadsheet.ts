/**
 * Real spreadsheet extractor — Sprint N.1.
 *
 * Uses `xlsx` (SheetJS) for XLSX / XLS / ODS. Output:
 *
 *   - text: tabular representation joined as TSV per sheet
 *   - structured: { sheets: [{ name, headers, rows }] }
 *
 * Provenance: every row's locator carries sheet_name + row index.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: any = null;
async function loadXlsx(): Promise<typeof import('xlsx')> {
  if (loaded) return loaded;
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  loaded = require('xlsx');
  return loaded;
}

export const spreadsheetRealExtractor: ExtractorAdapter = {
  name: 'spreadsheet',
  version: '2.0.0',
  supports(c) {
    return c.file_kind === 'xlsx' || c.file_kind === 'xls' || c.file_kind === 'ods';
  },
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const bytes = input.bytes ?? new Uint8Array();
    if (bytes.length === 0) {
      return {
        extractor_name: 'spreadsheet',
        extractor_version: '2.0.0',
        extraction_kind: 'spreadsheet_sheet',
        confidence: 0,
        deferred_reason: 'spreadsheet_empty_bytes',
      };
    }
    const xlsx = await loadXlsx();
    const t0 = Date.now();
    try {
      const wb = xlsx.read(bytes, { type: 'array' });
      const sheets: Array<{ name: string; headers: string[]; rows: string[][] }> = [];
      const textParts: string[] = [];

      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        if (!ws) continue;
        const rows = xlsx.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
          blankrows: false,
        }) as string[][];
        if (rows.length === 0) {
          sheets.push({ name, headers: [], rows: [] });
          continue;
        }
        const firstRowLooksHeader = rows[0].some(
          (c) => typeof c === 'string' && /[a-zA-Z]/.test(c)
        );
        const headers = firstRowLooksHeader
          ? rows[0].map((c) => String(c ?? ''))
          : rows[0].map((_, i) => `col_${i + 1}`);
        const data = firstRowLooksHeader ? rows.slice(1) : rows;
        sheets.push({ name, headers, rows: data.map((r) => r.map((c) => String(c ?? ''))) });

        textParts.push(`# Sheet: ${name}`);
        textParts.push(headers.join('\t'));
        for (const r of data) textParts.push(r.map((c) => String(c ?? '')).join('\t'));
        textParts.push('');
      }

      const duration_ms = Date.now() - t0;
      return {
        extractor_name: 'spreadsheet',
        extractor_version: '2.0.0',
        extraction_kind: 'spreadsheet_sheet',
        text: textParts.join('\n'),
        structured: { sheets },
        pages: wb.SheetNames.length,
        confidence: 0.95,
        duration_ms,
      };
    } catch (e) {
      return {
        extractor_name: 'spreadsheet',
        extractor_version: '2.0.0',
        extraction_kind: 'spreadsheet_sheet',
        confidence: 0,
        deferred_reason: 'spreadsheet_parse_error: ' + (e instanceof Error ? e.message : 'unknown'),
      };
    }
  },
};

export const __test = { spreadsheetRealExtractor };
