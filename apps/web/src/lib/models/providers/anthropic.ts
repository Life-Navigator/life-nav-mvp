/**
 * Anthropic provider — Sprint P.
 *
 * Real HTTP client against the Anthropic Messages API:
 *
 *   POST https://api.anthropic.com/v1/messages
 *
 * Capabilities:
 *   - text   (messages with role 'user')
 *   - vision (messages with content blocks: image + text)
 *
 * Speech and video are not provided by Anthropic at the time of
 * writing; the base class returns capability_unsupported.
 */

import { BaseProvider } from './base';
import type { Result, TextCallInput, VisionCallInput } from '@/types/models';

const BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

interface MessageResponse {
  id?: string;
  content?: Array<{ type: 'text' | 'image'; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type: string; message: string };
}

function bytesToBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(b).toString('base64');
}

export class AnthropicProvider extends BaseProvider {
  async text(input: TextCallInput): Promise<Result<{ text: string }>> {
    const key = await this.loadSecret('ANTHROPIC_API_KEY');
    if (!key) return this.notConfigured('ANTHROPIC_API_KEY');
    const r = await this.postJson<MessageResponse>(
      `${BASE_URL}/v1/messages`,
      {
        model: this.model_id,
        max_tokens: input.max_tokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        messages: [{ role: 'user', content: input.prompt }],
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      },
      { 'x-api-key': key, 'anthropic-version': API_VERSION },
      90_000
    );
    return this.mapResult(r);
  }

  async vision(input: VisionCallInput): Promise<Result<{ text: string }>> {
    const key = await this.loadSecret('ANTHROPIC_API_KEY');
    if (!key) return this.notConfigured('ANTHROPIC_API_KEY');
    const r = await this.postJson<MessageResponse>(
      `${BASE_URL}/v1/messages`,
      {
        model: this.model_id,
        max_tokens: input.max_tokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.image_mime,
                  data: bytesToBase64(input.image_bytes),
                },
              },
              { type: 'text', text: input.prompt },
            ],
          },
        ],
      },
      { 'x-api-key': key, 'anthropic-version': API_VERSION },
      90_000
    );
    return this.mapResult(r);
  }

  private mapResult(r: {
    status: number;
    data: MessageResponse | null;
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
    const text = (r.data?.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    const tokens_in = r.data?.usage?.input_tokens ?? 0;
    const tokens_out = r.data?.usage?.output_tokens ?? 0;
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
      provider: 'anthropic',
    };
  }
}
