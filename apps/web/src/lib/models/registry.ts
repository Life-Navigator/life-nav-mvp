/**
 * BYOM model registry resolver — Sprint P.
 *
 * Selects which provider/model to use for a given capability. Resolution
 * order:
 *
 *   1. Tenant override (models.tenant_model_overrides)
 *   2. Capability default flagged in models.model_registry.default_for
 *   3. Built-in fallback per capability
 *
 * The runtime resolver returns ONLY the descriptor; the caller
 * instantiates the provider class via `instantiateProvider(descriptor)`.
 */

import type { ModelCapability, ModelDescriptor, ModelProviderId } from '@/types/models';

// ---------------------------------------------------------------------------
// Built-in fallbacks — match the seeds in migration 093 so callers can
// resolve a descriptor even when the DB is unreachable.
// ---------------------------------------------------------------------------

export const BUILTIN_MODELS: ModelDescriptor[] = [
  {
    provider: 'gemini',
    model_id: 'gemini-2.5-pro',
    display_name: 'Gemini 2.5 Pro',
    modalities: ['text', 'vision', 'video', 'multimodal'],
    rate_input_micros_per_ktok: 1250,
    rate_output_micros_per_ktok: 5000,
    default_for: ['text', 'vision', 'video'],
  },
  {
    provider: 'gemini',
    model_id: 'gemini-2.5-flash',
    display_name: 'Gemini 2.5 Flash',
    modalities: ['text', 'vision', 'video', 'multimodal'],
    rate_input_micros_per_ktok: 75,
    rate_output_micros_per_ktok: 300,
  },
  {
    provider: 'openai',
    model_id: 'whisper-1',
    display_name: 'OpenAI Whisper',
    modalities: ['speech'],
    default_for: ['speech'],
  },
  {
    provider: 'openai',
    model_id: 'gpt-4o',
    display_name: 'OpenAI GPT-4o',
    modalities: ['text', 'vision', 'speech', 'multimodal'],
    rate_input_micros_per_ktok: 2500,
    rate_output_micros_per_ktok: 10000,
  },
  {
    provider: 'openai',
    model_id: 'gpt-4o-mini',
    display_name: 'OpenAI GPT-4o Mini',
    modalities: ['text', 'vision', 'multimodal'],
    rate_input_micros_per_ktok: 150,
    rate_output_micros_per_ktok: 600,
  },
  {
    provider: 'anthropic',
    model_id: 'claude-3-5-sonnet',
    display_name: 'Claude 3.5 Sonnet',
    modalities: ['text', 'vision', 'multimodal'],
    rate_input_micros_per_ktok: 3000,
    rate_output_micros_per_ktok: 15000,
  },
  {
    provider: 'azure_openai',
    model_id: 'gpt-4o-az',
    display_name: 'Azure OpenAI GPT-4o',
    modalities: ['text', 'vision', 'speech', 'multimodal'],
    rate_input_micros_per_ktok: 2500,
    rate_output_micros_per_ktok: 10000,
  },
];

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolveInputs {
  capability: ModelCapability;
  /** Tenant override for this capability, if any. */
  tenant_override?: { provider: ModelProviderId; model_id: string; enforced?: boolean };
  /** DB-fetched model registry (optional; falls back to BUILTIN). */
  registry?: ModelDescriptor[];
}

export function resolveModel(i: ResolveInputs): ModelDescriptor {
  const registry = i.registry && i.registry.length > 0 ? i.registry : BUILTIN_MODELS;

  // 1. Tenant override.
  if (i.tenant_override) {
    const o = registry.find(
      (m) =>
        m.provider === i.tenant_override!.provider && m.model_id === i.tenant_override!.model_id
    );
    if (o) return o;
    if (i.tenant_override.enforced) {
      // Enforced override but model not found — we still surface the override; the caller will fail-loud at instantiation.
      return {
        provider: i.tenant_override.provider,
        model_id: i.tenant_override.model_id,
        display_name: `${i.tenant_override.provider}/${i.tenant_override.model_id}`,
        modalities: [i.capability],
      };
    }
  }
  // 2. Capability default.
  const def = registry.find(
    (m) => (m.default_for ?? []).includes(i.capability) && m.modalities.includes(i.capability)
  );
  if (def) return def;

  // 3. First registered model that supports the capability.
  const first = registry.find((m) => m.modalities.includes(i.capability));
  if (first) return first;

  // No model supports the capability — return a sentinel that will fail loud.
  return {
    provider: 'local',
    model_id: 'no-model-available',
    display_name: 'No model available',
    modalities: [i.capability],
  };
}

export const __test = { resolveModel, BUILTIN_MODELS };
