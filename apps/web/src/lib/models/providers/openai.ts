/**
 * OpenAI provider — Sprint P / N.1.
 *
 * Real HTTP client against OpenAI's REST API:
 *
 *   POST https://api.openai.com/v1/chat/completions          (text + vision)
 *   POST https://api.openai.com/v1/audio/transcriptions      (Whisper)
 *
 * Capabilities:
 *   - text   (chat.completions with role messages)
 *   - vision (chat.completions with multimodal image_url part)
 *   - speech (audio.transcriptions; multipart upload)
 *
 * Video is NOT in OpenAI's public API at the time of writing; we
 * mark `video` unsupported on this provider.
 */

import { BaseProvider } from './base';
import type { Result, SpeechCallInput, TextCallInput, VisionCallInput } from '@/types/models';

const BASE_URL = 'https://api.openai.com';

interface ChatResponse {
  id?: string;
  choices?: Array<{
    message?: { content?: string | Array<{ type: string; text?: string }> };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message: string; type: string };
}

interface TranscriptionResponse {
  text?: string;
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  error?: { message: string };
}

function bytesToBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(b).toString('base64');
}

export class OpenAIProvider extends BaseProvider {
  async text(input: TextCallInput): Promise<Result<{ text: string }>> {
    const key = await this.loadSecret('OPENAI_API_KEY');
    if (!key) return this.notConfigured('OPENAI_API_KEY');
    const r = await this.postJson<ChatResponse>(
      `${BASE_URL}/v1/chat/completions`,
      {
        model: this.model_id,
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
        ...(input.max_tokens ? { max_tokens: input.max_tokens } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      },
      { authorization: `Bearer ${key}` },
      90_000
    );
    return this.mapChat(r);
  }

  async vision(input: VisionCallInput): Promise<Result<{ text: string }>> {
    const key = await this.loadSecret('OPENAI_API_KEY');
    if (!key) return this.notConfigured('OPENAI_API_KEY');
    const dataUrl = `data:${input.image_mime};base64,${bytesToBase64(input.image_bytes)}`;
    const r = await this.postJson<ChatResponse>(
      `${BASE_URL}/v1/chat/completions`,
      {
        model: this.model_id,
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          {
            role: 'user',
            content: [
              { type: 'text', text: input.prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        ...(input.max_tokens ? { max_tokens: input.max_tokens } : {}),
      },
      { authorization: `Bearer ${key}` },
      90_000
    );
    return this.mapChat(r);
  }

  async speech(
    input: SpeechCallInput
  ): Promise<
    Result<{
      transcript: string;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    }>
  > {
    const key = await this.loadSecret('OPENAI_API_KEY');
    if (!key) return this.notConfigured('OPENAI_API_KEY');

    // Use the global FormData + Blob — Node 18+ supports both.
    const form = new FormData();
    const blob = new Blob([input.audio_bytes as unknown as ArrayBuffer], {
      type: input.audio_mime,
    });
    form.append('file', blob, 'audio');
    form.append('model', this.model_id);
    form.append('response_format', 'verbose_json');
    if (input.language) form.append('language', input.language);

    const r = await this.postMultipart<TranscriptionResponse>(
      `${BASE_URL}/v1/audio/transcriptions`,
      form,
      { authorization: `Bearer ${key}` },
      300_000
    );
    if (r.status === 401 || r.status === 403)
      return {
        ok: false,
        error_kind: 'auth_failed',
        message: r.data?.error?.message ?? 'auth failed',
        http_status: r.status,
      };
    if (r.status === 429)
      return { ok: false, error_kind: 'rate_limited', message: 'rate limited', http_status: 429 };
    if (r.status === 400)
      return {
        ok: false,
        error_kind: 'bad_request',
        message: r.data?.error?.message ?? 'bad request',
        http_status: 400,
      };
    if (r.status >= 500 || r.status === 0)
      return {
        ok: false,
        error_kind: 'upstream_error',
        message: r.data?.error?.message ?? `upstream ${r.status}`,
        http_status: r.status,
      };

    return {
      ok: true,
      data: {
        transcript: r.data?.text ?? '',
        language: r.data?.language,
        segments: r.data?.segments,
      },
      usage: {
        tokens_in: 0,
        tokens_out: 0,
        audio_seconds: 0,
        cost_usd_micros: 0, // Whisper is per-minute; estimator separate
        latency_ms: r.latency_ms,
      },
      model_id: this.model_id,
      provider: 'openai',
    };
  }

  private mapChat(r: {
    status: number;
    data: ChatResponse | null;
    latency_ms: number;
  }): Result<{ text: string }> {
    if (r.status === 401 || r.status === 403)
      return {
        ok: false,
        error_kind: 'auth_failed',
        message: r.data?.error?.message ?? 'auth failed',
        http_status: r.status,
      };
    if (r.status === 429)
      return { ok: false, error_kind: 'rate_limited', message: 'rate limited', http_status: 429 };
    if (r.status === 400)
      return {
        ok: false,
        error_kind: 'bad_request',
        message: r.data?.error?.message ?? 'bad request',
        http_status: 400,
      };
    if (r.status >= 500 || r.status === 0)
      return {
        ok: false,
        error_kind: 'upstream_error',
        message: r.data?.error?.message ?? `upstream ${r.status}`,
        http_status: r.status,
      };
    const c = r.data?.choices?.[0]?.message?.content;
    const text =
      typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text ?? '').join('') : '';
    const tokens_in = r.data?.usage?.prompt_tokens ?? 0;
    const tokens_out = r.data?.usage?.completion_tokens ?? 0;
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
      provider: 'openai',
    };
  }
}
