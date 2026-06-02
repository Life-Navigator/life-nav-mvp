/**
 * Real video extractor — Sprint N.1.
 *
 * Uses the BYOM-resolved multimodal video provider (default
 * `gemini-2.5-pro`). For short videos (≲20MB) we send the bytes
 * inline; for longer videos the provider class is expected to
 * upload via its files API.
 *
 * Output text: a structured summary covering spoken content, on-
 * screen text, recognized entities, action items.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';
import { resolveModel } from '@/lib/models/registry';
import { instantiateProvider } from '@/lib/models/factory'; // GOVERNED_PROMPT_EXEMPT: media extractor — hardcoded extraction prompt over raw bytes; no retrieved-content mixing.

const VIDEO_PROMPT =
  'Analyze this video and return a structured summary in plain English including: ' +
  'TRANSCRIPT (verbatim spoken content), ON_SCREEN_TEXT (text appearing in frames), ' +
  'KEY_ENTITIES (people, organizations, places, amounts, dates, products), ' +
  'TOPICS (themes), and ACTION_ITEMS (commitments or follow-ups). ' +
  'Render each section with its label on its own line followed by the content. ' +
  'Be exact with numbers and dates.';

export const videoProdExtractor: ExtractorAdapter = {
  name: 'video',
  version: '2.0.0',
  supports(c) {
    return (
      c.file_kind === 'mp4' ||
      c.file_kind === 'mov' ||
      c.file_kind === 'avi' ||
      c.file_kind === 'mkv' ||
      c.file_kind === 'webm'
    );
  },
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const bytes = input.bytes ?? new Uint8Array();
    if (bytes.length === 0) {
      return {
        extractor_name: 'video',
        extractor_version: '2.0.0',
        extraction_kind: 'scene_summary',
        confidence: 0,
        deferred_reason: 'video_empty_bytes',
      };
    }
    const mime = input.classification.detected_mime || 'video/mp4';
    const descriptor = resolveModel({ capability: 'video' });
    const provider = instantiateProvider(descriptor);
    const t0 = Date.now();
    const r = await provider.video({ video_bytes: bytes, video_mime: mime, prompt: VIDEO_PROMPT });
    const duration_ms = Date.now() - t0;

    if (!r.ok) {
      return {
        extractor_name: 'video',
        extractor_version: '2.0.0',
        extraction_kind: 'scene_summary',
        confidence: 0,
        needs_remote_provider: r.error_kind === 'not_configured',
        deferred_reason: `video_provider_${r.error_kind}: ${r.message}`,
        duration_ms,
      };
    }
    return {
      extractor_name: 'video',
      extractor_version: '2.0.0',
      extraction_kind: 'scene_summary',
      text: r.data.summary,
      structured: {
        transcript: r.data.transcript,
        key_entities: r.data.key_entities,
        provider: r.provider,
        model_id: r.model_id,
        usage: r.usage,
      },
      confidence: 0.8,
      duration_ms,
    };
  },
};

export const __test = { videoProdExtractor };
