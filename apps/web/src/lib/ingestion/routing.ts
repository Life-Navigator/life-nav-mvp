/**
 * Extractor routing — Sprint N.1 production.
 *
 * Order matters: real in-process extractors are listed BEFORE the
 * provider-stub fallbacks so the production extractor handles the
 * file. The provider-stub fallback only runs if the real extractor
 * sets `needs_remote_provider: true` (pure-scan PDF, legacy .doc).
 *
 * For audio, image, video we replace the stubs with real
 * provider-backed extractors that hit Gemini Vision / Whisper /
 * Gemini multimodal video — see `extractors/vision-prod.ts`,
 * `extractors/speech-prod.ts`, `extractors/video-prod.ts`.
 */

import type { ClassifiedFile } from '@/types/ingestion';
import type { ExtractorAdapter } from './extractors/types';

import { textDocumentExtractor } from './extractors/text-document';
import { csvExtractor } from './extractors/csv';
import { jsonExtractor } from './extractors/json';
import { xmlExtractor } from './extractors/xml';

import { pdfRealExtractor } from './extractors/pdf';
import { docxRealExtractor } from './extractors/docx';
import { spreadsheetRealExtractor } from './extractors/spreadsheet';

import { visionProdExtractor } from './extractors/vision-prod';
import { speechProdExtractor } from './extractors/speech-prod';
import { videoProdExtractor } from './extractors/video-prod';

import { presentationExtractor, odtExtractor } from './extractors/providers';

const REGISTRY: ExtractorAdapter[] = [
  // ── Real in-process extractors ──────────────────────────────────────────
  textDocumentExtractor,
  csvExtractor,
  jsonExtractor,
  xmlExtractor,
  pdfRealExtractor,
  docxRealExtractor,
  spreadsheetRealExtractor,
  // ── Real provider-backed extractors (BYOM) ──────────────────────────────
  visionProdExtractor,
  speechProdExtractor,
  videoProdExtractor,
  // ── Provider-deferred (presentation + ODT remain stubs) ────────────────
  presentationExtractor,
  odtExtractor,
];

export function routeExtractors(c: ClassifiedFile): ExtractorAdapter[] {
  return REGISTRY.filter((a) => a.supports(c));
}

export const __test = { REGISTRY, routeExtractors };
