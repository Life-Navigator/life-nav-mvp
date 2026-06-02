/**
 * Azure OpenAI provider — Sprint P.
 *
 * Azure exposes the OpenAI API at a customer-specific endpoint with
 * its own auth header. We require two secrets:
 *
 *   AZURE_OPENAI_ENDPOINT — full hostname (https://<resource>.openai.azure.com)
 *   AZURE_OPENAI_API_KEY  — Azure key
 *
 * The model_id is mapped to the customer's deployment name.
 *
 * NOTE: The secrets registry in `secrets/manager.ts` ships
 * placeholders for these; the operator wires them per-tenant via
 * Google Secret Manager or env.
 */

import { BaseProvider } from './base';
import type { Result, TextCallInput, VisionCallInput } from '@/types/models';

const API_VERSION = '2024-08-01-preview';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | Array<{ type: string; text?: string }> } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
}

function bytesToBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(b).toString('base64');
}

export class AzureOpenAIProvider extends BaseProvider {
  private async resolveEndpoint(): Promise<string | null> {
    // The endpoint lives in env as a non-sensitive URL; the API key is
    // sensitive. We store both in the secrets registry as a single
    // tuple (added below as needed).
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    if (endpoint && endpoint.startsWith('https://')) return endpoint;
    return null;
  }

  async text(input: TextCallInput): Promise<Result<{ text: string }>> {
    const key = await this.loadSecret('AZURE_OPENAI_API_KEY' as never); // Optional in registry
    const endpoint = await this.resolveEndpoint();
    if (!key || !endpoint) return this.notConfigured('AZURE_OPENAI_API_KEY/ENDPOINT');
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(this.model_id)}/chat/completions?api-version=${API_VERSION}`;
    const r = await this.postJson<ChatResponse>(
      url,
      {
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
        ...(input.max_tokens ? { max_tokens: input.max_tokens } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      },
      { 'api-key': key },
      90_000
    );
    return this.mapResult(r);
  }

  async vision(input: VisionCallInput): Promise<Result<{ text: string }>> {
    const key = await this.loadSecret('AZURE_OPENAI_API_KEY' as never);
    const endpoint = await this.resolveEndpoint();
    if (!key || !endpoint) return this.notConfigured('AZURE_OPENAI_API_KEY/ENDPOINT');
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(this.model_id)}/chat/completions?api-version=${API_VERSION}`;
    const dataUrl = `data:${input.image_mime};base64,${bytesToBase64(input.image_bytes)}`;
    const r = await this.postJson<ChatResponse>(
      url,
      {
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
      { 'api-key': key },
      90_000
    );
    return this.mapResult(r);
  }

  private mapResult(r: {
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
      provider: 'azure_openai',
    };
  }
}
