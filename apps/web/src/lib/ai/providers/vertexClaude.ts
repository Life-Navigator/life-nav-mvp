// Vertex AI — Claude (Anthropic via Model Garden) provider adapter.
//
// AVAILABILITY: Claude on Vertex is region-limited and uses versioned, publisher-scoped model ids:
//   publishers/anthropic/models/claude-sonnet-4-5@<YYYYMMDD>  (commonly us-east5 / europe-west1)
// VERIFY the exact id + region in Vertex AI Model Garden before enabling AI_ENABLE_CLAUDE /
// AI_ENABLE_CLAUDE_OPUS. The router will not select Claude unless its flag is on AND the model is listed
// as available in the configured region (modelRegistry.regions) — otherwise it falls back to Gemini.
//
// AUTH/SECRETS: same as Gemini — invoked from the Fly backend via ADC, never from the browser, no keys.

import type { ProviderModel } from '../types';
import { aiConfig, MODEL_REGISTRY } from '../modelRegistry';
import type { GenerateParams, GenerateResult } from './vertexGemini';

const isBrowser = typeof window !== 'undefined';

/** Build the publisher-scoped Vertex resource id Anthropic models use on Model Garden. */
export function claudePublisherModel(modelId: string): string {
  // If an env override already provides the full publisher path, pass it through.
  if (modelId.startsWith('publishers/')) return modelId;
  return `publishers/anthropic/models/${modelId}`;
}

/** Regions where the given Claude registry key is expected to serve (VERIFY in Model Garden). */
export function claudeRegions(key: 'claude-sonnet' | 'claude-opus'): string[] {
  return MODEL_REGISTRY[key].regions;
}

export async function invokeClaude(params: GenerateParams): Promise<GenerateResult> {
  if (isBrowser) {
    throw new Error('vertexClaude.invoke must run server-side (no GCP credentials on the client).');
  }
  if (!aiConfig.enableClaude && !aiConfig.enableClaudeOpus) {
    throw new Error(
      'Claude on Vertex is disabled (AI_ENABLE_CLAUDE / AI_ENABLE_CLAUDE_OPUS = false).'
    );
  }
  void params;
  throw new Error(
    'vertexClaude.invoke is a router-foundation stub. Implement on the Fly backend with the Vertex ' +
      'Anthropic endpoint + ADC, using claudePublisherModel(model) and a Claude-supported region.'
  );
}

export const VERTEX_CLAUDE = {
  provider: 'vertex-claude' as const,
  location: aiConfig.vertexLocation,
  publisherModel: claudePublisherModel,
  invoke: invokeClaude,
};
