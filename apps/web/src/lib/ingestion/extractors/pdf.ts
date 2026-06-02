/**
 * Real PDF extractor — Sprint N.1.
 *
 * Uses `pdf-parse` (production npm package) to extract text + page
 * count + metadata from a PDF buffer.
 *
 * pdf-parse internally uses pdfjs-dist; it works on text PDFs and
 * many mixed PDFs. For PDFs that are pure scans (no text layer),
 * pdf-parse returns empty text; that case is handled by the
 * downstream provider-backed OCR (`vision.ts`).
 *
 * Per-page provenance is preserved via `getPageText(pageNum)` so
 * downstream entity extraction can stamp the page on every fact.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';

interface PdfParseResult {
  numpages: number;
  numrender: number;
  info: Record<string, unknown> | null;
  metadata: { _metadata?: Record<string, unknown> } | null;
  text: string;
}

interface PdfPageData {
  pageIndex: number;
  pageNumber: number;
  pageInfo: { num: number; scale: number };
  getTextContent(opts: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }): Promise<{ items: Array<{ str: string }> }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: any = null;
async function loadPdfParse(): Promise<typeof import('pdf-parse')> {
  if (loaded) return loaded;
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  loaded = require('pdf-parse');
  return loaded;
}

export const pdfRealExtractor: ExtractorAdapter = {
  name: 'pdf',
  version: '2.0.0',
  supports(c) {
    return c.file_kind === 'pdf';
  },
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const bytes = input.bytes ?? new Uint8Array();
    if (bytes.length === 0) {
      return {
        extractor_name: 'pdf',
        extractor_version: '2.0.0',
        extraction_kind: 'pdf_text',
        confidence: 0,
        deferred_reason: 'pdf_empty_bytes',
        needs_remote_provider: false,
      };
    }
    const pdfParse = await loadPdfParse();

    // Capture page-level text via pdf-parse's `pagerender` hook so we
    // can attach the page number to every facts emitted downstream.
    const perPage: string[] = [];
    const pagerender = async (pageData: PdfPageData): Promise<string> => {
      try {
        const content = await pageData.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        });
        const text = content.items
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        perPage[pageData.pageNumber - 1] = text;
        return text;
      } catch {
        perPage[pageData.pageNumber - 1] = '';
        return '';
      }
    };

    const t0 = Date.now();
    let parsed: PdfParseResult;
    try {
      // pdf-parse default export is a function (buffer) => Promise.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed = await (pdfParse as any).default(bytes as unknown as Buffer, { pagerender });
    } catch (e) {
      return {
        extractor_name: 'pdf',
        extractor_version: '2.0.0',
        extraction_kind: 'pdf_text',
        confidence: 0,
        deferred_reason: 'pdf_parse_error: ' + (e instanceof Error ? e.message : 'unknown'),
        needs_remote_provider: false,
      };
    }
    const duration_ms = Date.now() - t0;

    const text = parsed.text ?? '';
    const empty = text.trim().length === 0;
    if (empty) {
      // Pure scan — kick over to provider-backed OCR.
      return {
        extractor_name: 'pdf',
        extractor_version: '2.0.0',
        extraction_kind: 'pdf_text',
        pages: parsed.numpages,
        confidence: 0,
        needs_remote_provider: true,
        deferred_reason: 'pdf_empty_text_layer_requires_ocr',
        duration_ms,
      };
    }

    return {
      extractor_name: 'pdf',
      extractor_version: '2.0.0',
      extraction_kind: 'pdf_text',
      text,
      structured: {
        per_page: perPage,
        info: parsed.info,
        metadata: parsed.metadata?._metadata ?? null,
      },
      pages: parsed.numpages,
      confidence: 0.92,
      duration_ms,
    };
  },
};

export const __test = { pdfRealExtractor };
