/**
 * Shared base for all model providers — Sprint P / N.1.
 *
 * No mocks. No stubs. Each provider class makes real HTTP calls to
 * its real upstream endpoint. When the credential is absent, the
 * call FAILS LOUD with `error_kind: 'not_configured'`.
 *
 * The base exposes:
 *   - getSecret() — typed accessor for the provider's API key
 *   - postJson() / postMultipart() — fetch wrappers with timing
 *   - estimateCostMicros() — uniform helper from registry rates
 */

import { getSecret } from '@/lib/secrets/manager';
import type { SecretName } from '@/lib/secrets/manager';
import type {
  ModelDescriptor,
  ModelProvider,
  ModelProviderId,
  ProviderFailure,
  Result,
  SpeechCallInput,
  TextCallInput,
  VideoCallInput,
  VisionCallInput,
} from '@/types/models';

export abstract class BaseProvider implements ModelProvider {
  readonly provider: ModelProviderId;
  readonly model_id: string;
  protected readonly descriptor: ModelDescriptor;

  constructor(descriptor: ModelDescriptor) {
    this.descriptor = descriptor;
    this.provider = descriptor.provider;
    this.model_id = descriptor.model_id;
  }

  // Required by the interface; subclasses override the ones they support
  // and leave the rest returning a `capability_unsupported` failure.

  async text(_: TextCallInput): Promise<Result<{ text: string }>> {
    return this.unsupported('text');
  }
  async vision(_: VisionCallInput): Promise<Result<{ text: string }>> {
    return this.unsupported('vision');
  }
  async speech(
    _: SpeechCallInput
  ): Promise<
    Result<{
      transcript: string;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    }>
  > {
    return this.unsupported('speech');
  }
  async video(
    _: VideoCallInput
  ): Promise<Result<{ summary: string; transcript?: string; key_entities?: string[] }>> {
    return this.unsupported('video');
  }

  // ---- Helpers --------------------------------------------------------

  protected async loadSecret(name: SecretName): Promise<string | null> {
    return getSecret(name);
  }

  protected unsupported(kind: string): ProviderFailure {
    return {
      ok: false,
      error_kind: 'capability_unsupported',
      message: `${this.provider}/${this.model_id} does not implement ${kind}`,
    };
  }

  protected notConfigured(envName: string): ProviderFailure {
    return {
      ok: false,
      error_kind: 'not_configured',
      message: `Missing credential ${envName}; provider ${this.provider} cannot run.`,
    };
  }

  protected async postJson<T>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    timeoutMs = 60_000
  ): Promise<{ status: number; data: T | null; latency_ms: number; raw_text?: string }> {
    const t0 = Date.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      const latency_ms = Date.now() - t0;
      let data: T | null = null;
      try {
        data = text ? (JSON.parse(text) as T) : null;
      } catch {
        /* leave raw */
      }
      return { status: res.status, data, latency_ms, raw_text: text };
    } finally {
      clearTimeout(t);
    }
  }

  protected async postMultipart<T>(
    url: string,
    form: FormData,
    headers: Record<string, string>,
    timeoutMs = 120_000
  ): Promise<{ status: number; data: T | null; latency_ms: number; raw_text?: string }> {
    const t0 = Date.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers, // do NOT set content-type — fetch will set the boundary
        body: form,
        signal: controller.signal,
      });
      const text = await res.text();
      const latency_ms = Date.now() - t0;
      let data: T | null = null;
      try {
        data = text ? (JSON.parse(text) as T) : null;
      } catch {
        /* leave raw */
      }
      return { status: res.status, data, latency_ms, raw_text: text };
    } finally {
      clearTimeout(t);
    }
  }

  protected estimateCostMicros(tokens_in: number, tokens_out: number): number {
    const i = this.descriptor.rate_input_micros_per_ktok ?? 0;
    const o = this.descriptor.rate_output_micros_per_ktok ?? 0;
    return Math.round((tokens_in / 1000) * i + (tokens_out / 1000) * o);
  }
}
