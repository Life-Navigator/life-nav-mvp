// Vertex AI — Gemini provider adapter.
//
// AUTH/SECRETS: this adapter performs NO calls from the browser and holds NO keys. In LifeNavigator the
// LLM is invoked from the Fly.io backend using Google Application Default Credentials (ADC) / Workload
// Identity — never a hardcoded key, never on Vercel. The frontend resolves a ModelRoute and POSTs to an
// internal API route; the backend executes against Vertex (project + AI_VERTEX_LOCATION). To wire real
// calls server-side, add `@google-cloud/vertexai` as a BACKEND dependency and implement `invoke()` there.

import type { ProviderModel } from '../types';
import { aiConfig } from '../modelRegistry';

export interface GenerateParams {
  model: string; // verified Vertex model id (from the registry)
  system?: string;
  prompt: string;
  // Prefer structured-first: when provided, the model is constrained to JSON matching this schema.
  responseJsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  location?: string;
}

export interface GenerateResult {
  provider: ProviderModel['provider'];
  model: string;
  text: string;
  json?: unknown;
  // usage/latency populated by the real backend implementation
  usage?: { inputTokens?: number; outputTokens?: number };
}

const isBrowser = typeof window !== 'undefined';

/**
 * Placeholder server-side invoke. Real implementation lives on the Fly backend (ADC + vertexai SDK).
 * Throwing here is intentional: it prevents accidental key-less calls and makes the architecture explicit.
 */
export async function invokeGemini(params: GenerateParams): Promise<GenerateResult> {
  if (isBrowser) {
    throw new Error('vertexGemini.invoke must run server-side (no GCP credentials on the client).');
  }
  void params;
  void aiConfig;
  throw new Error(
    'vertexGemini.invoke is a router-foundation stub. Implement on the Fly backend with @google-cloud/vertexai + ADC.'
  );
}

export const VERTEX_GEMINI = {
  provider: 'vertex-gemini' as const,
  location: aiConfig.vertexLocation,
  invoke: invokeGemini,
};
