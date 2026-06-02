/**
 * BYOM factory — instantiate a real provider class from a descriptor.
 *
 * The factory is the only place that maps a `ModelProviderId` to a
 * concrete class. Adding a new provider means:
 *   1. Implement `BaseProvider` for the new vendor.
 *   2. Add a branch here.
 *   3. Add a row to `models.model_registry` via migration or service.
 */

import type { ModelDescriptor, ModelProvider } from '@/types/models';
import { AnthropicProvider } from './providers/anthropic';
import { AzureOpenAIProvider } from './providers/azure-openai';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';

export function instantiateProvider(d: ModelDescriptor): ModelProvider {
  switch (d.provider) {
    case 'gemini':
      return new GeminiProvider(d);
    case 'openai':
      return new OpenAIProvider(d);
    case 'anthropic':
      return new AnthropicProvider(d);
    case 'azure_openai':
      return new AzureOpenAIProvider(d);
    case 'local':
    default:
      throw new Error(`Provider ${d.provider} not implemented`);
  }
}
