/**
 * Real speech extractor — Sprint N.1.
 *
 * Runs the BYOM-resolved speech provider. Default capability default
 * is OpenAI Whisper (`whisper-1`); tenant overrides can pick Gemini
 * 2.5 Pro for multimodal speech transcription via the model
 * registry.
 *
 * Output: transcript text + structured segments with start/end
 * timestamps so downstream entity extraction can stamp the
 * `timestamp_ms` locator on facts that mention the spoken content.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';
import { resolveModel } from '@/lib/models/registry';
import { instantiateProvider } from '@/lib/models/factory'; // GOVERNED_PROMPT_EXEMPT: media extractor — transcription over raw audio bytes; no retrieved-content mixing.

export const speechProdExtractor: ExtractorAdapter = {
  name: 'speech',
  version: '2.0.0',
  supports(c) {
    return (
      c.file_kind === 'mp3' ||
      c.file_kind === 'wav' ||
      c.file_kind === 'm4a' ||
      c.file_kind === 'aac' ||
      c.file_kind === 'flac'
    );
  },
  async extract(input: ExtractorInput): Promise<ExtractorOutput> {
    const bytes = input.bytes ?? new Uint8Array();
    if (bytes.length === 0) {
      return {
        extractor_name: 'speech',
        extractor_version: '2.0.0',
        extraction_kind: 'transcript',
        confidence: 0,
        deferred_reason: 'audio_empty_bytes',
      };
    }
    const mime = input.classification.detected_mime || 'audio/mpeg';
    const descriptor = resolveModel({ capability: 'speech' });
    const provider = instantiateProvider(descriptor);
    const t0 = Date.now();
    const r = await provider.speech({ audio_bytes: bytes, audio_mime: mime });
    const duration_ms = Date.now() - t0;

    if (!r.ok) {
      return {
        extractor_name: 'speech',
        extractor_version: '2.0.0',
        extraction_kind: 'transcript',
        confidence: 0,
        needs_remote_provider: r.error_kind === 'not_configured',
        deferred_reason: `speech_provider_${r.error_kind}: ${r.message}`,
        duration_ms,
      };
    }
    return {
      extractor_name: 'speech',
      extractor_version: '2.0.0',
      extraction_kind: 'transcript',
      text: r.data.transcript,
      structured: {
        language: r.data.language,
        segments: r.data.segments,
        provider: r.provider,
        model_id: r.model_id,
        usage: r.usage,
      },
      confidence: 0.85,
      language: r.data.language,
      duration_ms,
    };
  },
};

export const __test = { speechProdExtractor };
