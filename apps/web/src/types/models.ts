/**
 * BYOM (Bring Your Own Model) types — Sprint P / Sprint N.1.
 *
 * Common interface every provider implements. The interface is the
 * source of truth for:
 *
 *   - Sprint N.1 multimodal extractors (vision / speech / video)
 *   - Sprint P BYOM tenant model overrides
 *
 * All shapes are deliberately small. The intent is: any future
 * provider (a new vendor, a self-hosted local LLM) can be added by
 * implementing this interface.
 */

export type ModelProviderId = 'gemini' | 'openai' | 'anthropic' | 'azure_openai' | 'local';

export type ModelCapability = 'text' | 'vision' | 'speech' | 'video' | 'embedding' | 'multimodal';

export interface ModelDescriptor {
  provider: ModelProviderId;
  model_id: string; // canonical e.g. 'gemini-2.5-pro'
  display_name: string;
  modalities: ModelCapability[];
  context_window?: number;
  rate_input_micros_per_ktok?: number; // cost
  rate_output_micros_per_ktok?: number;
  default_for?: ModelCapability[];
}

// ---------------------------------------------------------------------------
// Call I/O
// ---------------------------------------------------------------------------

export interface CallUsage {
  tokens_in: number;
  tokens_out: number;
  audio_seconds?: number;
  video_seconds?: number;
  pages?: number;
  cost_usd_micros: number;
  latency_ms: number;
}

export interface TextCallInput {
  prompt: string;
  system?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface VisionCallInput {
  prompt: string;
  /** Raw image bytes or base64. */
  image_bytes: Uint8Array;
  image_mime: string;
  system?: string;
  max_tokens?: number;
}

export interface SpeechCallInput {
  audio_bytes: Uint8Array;
  audio_mime: string;
  language?: string;
}

export interface VideoCallInput {
  /** For now: short videos uploaded inline. Longer videos require the
   *  provider's file API which is provider-specific. */
  video_bytes: Uint8Array;
  video_mime: string;
  prompt: string;
}

export interface ProviderResponse<T> {
  ok: true;
  data: T;
  usage: CallUsage;
  model_id: string;
  provider: ModelProviderId;
  error_kind?: undefined;
  message?: undefined;
}

export interface ProviderFailure {
  ok: false;
  error_kind:
    | 'not_configured'
    | 'auth_failed'
    | 'rate_limited'
    | 'bad_request'
    | 'capability_unsupported'
    | 'upstream_error'
    | 'timeout';
  message: string;
  http_status?: number;
  data?: undefined;
}

export type Result<T> = ProviderResponse<T> | ProviderFailure;

// ---------------------------------------------------------------------------
// The interface — every provider implements this.
// ---------------------------------------------------------------------------

export interface ModelProvider {
  readonly provider: ModelProviderId;
  readonly model_id: string;

  text(input: TextCallInput): Promise<Result<{ text: string }>>;
  vision(input: VisionCallInput): Promise<Result<{ text: string }>>;
  speech(
    input: SpeechCallInput
  ): Promise<
    Result<{
      transcript: string;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    }>
  >;
  video(
    input: VideoCallInput
  ): Promise<Result<{ summary: string; transcript?: string; key_entities?: string[] }>>;
}
