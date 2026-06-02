/**
 * Real vision extractor — Sprint N.1.
 *
 * Runs the BYOM-resolved vision provider against the image bytes.
 * Default capability default is `gemini-2.5-pro`; tenant overrides
 * can pick OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet via the
 * model registry.
 *
 * Prompt is engineered for high-precision OCR plus structural
 * detection (tables / forms / receipts / insurance cards) so the
 * downstream domain templates can do their work.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';
import { resolveModel } from '@/lib/models/registry';
import { instantiateProvider } from '@/lib/models/factory'; // GOVERNED_PROMPT_EXEMPT: media extractor — hardcoded extraction prompt over raw bytes; no retrieved-content mixing.

const OCR_PROMPT =
  'Extract all text from this image verbatim. Preserve numeric values exactly. ' +
  'If the image is a receipt, statement, insurance card, paystub, or form, ' +
  'preserve field labels next to their values (e.g. "Total: $12.34"). ' +
  'If you see tables, render them with tab-separated columns and one row per line. ' +
  'Return ONLY the extracted text — no commentary, no markdown.';

export const visionProdExtractor: ExtractorAdapter = {
  name: 'vision',
  version: '2.0.0',
  supports(c) {
    return (
      c.file_kind === 'jpg' ||
      c.file_kind === 'png' ||
      c.file_kind === 'webp' ||
      c.file_kind === 'tiff' ||
      c.file_kind === 'heic'
    );
  },
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const bytes = input.bytes ?? new Uint8Array();
    if (bytes.length === 0) {
      return {
        extractor_name: 'vision',
        extractor_version: '2.0.0',
        extraction_kind: 'ocr_text',
        confidence: 0,
        deferred_reason: 'image_empty_bytes',
      };
    }
    const mime = input.classification.detected_mime || 'image/jpeg';
    const descriptor = resolveModel({ capability: 'vision' });
    const provider = instantiateProvider(descriptor);
    const t0 = Date.now();
    const r = await provider.vision({
      prompt: OCR_PROMPT,
      image_bytes: bytes,
      image_mime: mime,
      max_tokens: 4096,
    });
    const duration_ms = Date.now() - t0;

    if (!r.ok) {
      return {
        extractor_name: 'vision',
        extractor_version: '2.0.0',
        extraction_kind: 'ocr_text',
        confidence: 0,
        needs_remote_provider: r.error_kind === 'not_configured',
        deferred_reason: `vision_provider_${r.error_kind}: ${r.message}`,
        duration_ms,
      };
    }
    return {
      extractor_name: 'vision',
      extractor_version: '2.0.0',
      extraction_kind: 'ocr_text',
      text: r.data.text,
      structured: { provider: r.provider, model_id: r.model_id, usage: r.usage },
      confidence: 0.88,
      duration_ms,
    };
  },
};

export const __test = { visionProdExtractor };
