/**
 * Gemini provider — Sprint P / N.1.
 *
 * Real HTTP client against the Google AI Studio (Generative Language)
 * REST API:
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * Capabilities:
 *   - text   (generateContent with a text part)
 *   - vision (generateContent with an inline image part)
 *   - video  (uploadFile + generateContent with file_uri part)
 *
 * Speech is implemented by Gemini via inline audio in generateContent
 * — but for production-grade speech we route to OpenAI Whisper by
 * default; this class still implements speech() as a safety net.
 *
 * No mocks. No simulated responses. If GEMINI_API_KEY is missing the
 * methods return `error_kind: 'not_configured'`.
 */

import { BaseProvider } from './base';
import type {
  Result,
  SpeechCallInput,
  TextCallInput,
  VideoCallInput,
  VisionCallInput,
} from '@/types/models';

const BASE_URL = 'https://generativelanguage.googleapis.com';

interface GeminiContent {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code: number; message: string; status: string };
}

function bytesToBase64(b: Uint8Array): string {
  // Node 18+ has Buffer; we avoid it for portability.
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(b).toString('base64');
}

export class GeminiProvider extends BaseProvider {
  private async generate(
    parts: unknown[],
    system?: string,
    maxTokens?: number
  ): Promise<{
    status: number;
    data: GeminiContent | null;
    latency_ms: number;
    raw_text?: string;
    key?: string;
  }> {
    const key = await this.loadSecret('GEMINI_API_KEY');
    if (!key) return { status: 0, data: null, latency_ms: 0 };
    const url = `${BASE_URL}/v1beta/models/${encodeURIComponent(this.model_id)}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      contents: [{ role: 'user', parts }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(maxTokens ? { generationConfig: { maxOutputTokens: maxTokens } } : {}),
    };
    const r = await this.postJson<GeminiContent>(url, body, {}, 90_000);
    return { ...r, key };
  }

  async text(input: TextCallInput): Promise<Result<{ text: string }>> {
    const r = await this.generate([{ text: input.prompt }], input.system, input.max_tokens);
    if (!r.key) return this.notConfigured('GEMINI_API_KEY');
    return this.mapTextResult(r);
  }

  async vision(input: VisionCallInput): Promise<Result<{ text: string }>> {
    const r = await this.generate(
      [
        { text: input.prompt },
        { inlineData: { mimeType: input.image_mime, data: bytesToBase64(input.image_bytes) } },
      ],
      input.system,
      input.max_tokens
    );
    if (!r.key) return this.notConfigured('GEMINI_API_KEY');
    return this.mapTextResult(r);
  }

  async video(
    input: VideoCallInput
  ): Promise<Result<{ summary: string; transcript?: string; key_entities?: string[] }>> {
    // For short videos (≤ ~20MB), the API accepts inline data. Longer
    // videos require an upload to the Files API first. We attempt
    // inline; if the upstream rejects we surface a clean failure.
    const r = await this.generate(
      [
        { text: input.prompt },
        { inlineData: { mimeType: input.video_mime, data: bytesToBase64(input.video_bytes) } },
      ],
      undefined,
      4096
    );
    if (!r.key) return this.notConfigured('GEMINI_API_KEY');
    const t = this.mapTextResult(r);
    if (!t.ok)
      return t as Result<{ summary: string; transcript?: string; key_entities?: string[] }>;
    return {
      ok: true,
      data: { summary: t.data.text },
      usage: t.usage,
      model_id: this.model_id,
      provider: 'gemini',
    };
  }

  async speech(input: SpeechCallInput): Promise<Result<{ transcript: string; language?: string }>> {
    // Gemini multimodal can transcribe audio inline. This is the
    // fallback when OpenAI Whisper is not configured.
    const r = await this.generate(
      [
        {
          text: 'Transcribe this audio verbatim. Preserve speaker turns if multiple speakers are present. Return only the transcript.',
        },
        { inlineData: { mimeType: input.audio_mime, data: bytesToBase64(input.audio_bytes) } },
      ],
      undefined,
      4096
    );
    if (!r.key) return this.notConfigured('GEMINI_API_KEY');
    const t = this.mapTextResult(r);
    if (!t.ok) return t as Result<{ transcript: string; language?: string }>;
    return {
      ok: true,
      data: { transcript: t.data.text },
      usage: t.usage,
      model_id: this.model_id,
      provider: 'gemini',
    };
  }

  // ----------------------------------------------------------------

  private mapTextResult(r: {
    status: number;
    data: GeminiContent | null;
    latency_ms: number;
    raw_text?: string;
  }): Result<{ text: string }> {
    if (r.status === 401 || r.status === 403) {
      return {
        ok: false,
        error_kind: 'auth_failed',
        message: r.data?.error?.message ?? 'auth failed',
        http_status: r.status,
      };
    }
    if (r.status === 429) {
      return { ok: false, error_kind: 'rate_limited', message: 'rate limited', http_status: 429 };
    }
    if (r.status === 400) {
      return {
        ok: false,
        error_kind: 'bad_request',
        message: r.data?.error?.message ?? 'bad request',
        http_status: 400,
      };
    }
    if (r.status >= 500 || r.status === 0) {
      return {
        ok: false,
        error_kind: 'upstream_error',
        message: r.data?.error?.message ?? `upstream ${r.status}`,
        http_status: r.status,
      };
    }
    const text = r.data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const tokens_in = r.data?.usageMetadata?.promptTokenCount ?? 0;
    const tokens_out = r.data?.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      ok: true,
      data: { text },
      usage: {
        tokens_in,
        tokens_out,
        cost_usd_micros: this.estimateCostMicros(tokens_in, tokens_out),
        latency_ms: r.latency_ms,
      },
      model_id: this.model_id,
      provider: 'gemini',
    };
  }
}
