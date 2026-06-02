/**
 * @jest-environment node
 *
 * BYOM model interface tests.
 */

import { __test as regTest } from '../registry';
import { GeminiProvider } from '../providers/gemini';
import { OpenAIProvider } from '../providers/openai';
import { AnthropicProvider } from '../providers/anthropic';
import { instantiateProvider } from '../factory';

const { resolveModel } = regTest;

describe('resolveModel', () => {
  test('returns a tenant override when present', () => {
    const r = resolveModel({
      capability: 'vision',
      tenant_override: { provider: 'openai', model_id: 'gpt-4o' },
    });
    expect(r.provider).toBe('openai');
    expect(r.model_id).toBe('gpt-4o');
  });

  test('falls through to the capability default when no override', () => {
    const r = resolveModel({ capability: 'speech' });
    // Built-in default for speech is whisper-1.
    expect(r.provider).toBe('openai');
    expect(r.model_id).toBe('whisper-1');
  });

  test('falls through to the first supporting model when capability has no default', () => {
    const r = resolveModel({ capability: 'embedding' });
    // None of our built-ins claim embedding default — should return
    // a sentinel that fails loudly at instantiation.
    expect(r.modalities).toContain('embedding');
  });
});

describe('Provider fail-loud (no mocks)', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('Gemini text without GEMINI_API_KEY → not_configured', async () => {
    const p = new GeminiProvider({
      provider: 'gemini',
      model_id: 'gemini-2.5-pro',
      display_name: 'x',
      modalities: ['text'],
    });
    const r = await p.text({ prompt: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_kind).toBe('not_configured');
  });

  test('OpenAI text without OPENAI_API_KEY → not_configured', async () => {
    const p = new OpenAIProvider({
      provider: 'openai',
      model_id: 'gpt-4o',
      display_name: 'x',
      modalities: ['text'],
    });
    const r = await p.text({ prompt: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_kind).toBe('not_configured');
  });

  test('Anthropic text without ANTHROPIC_API_KEY → not_configured', async () => {
    const p = new AnthropicProvider({
      provider: 'anthropic',
      model_id: 'claude-3-5-sonnet',
      display_name: 'x',
      modalities: ['text'],
    });
    const r = await p.text({ prompt: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_kind).toBe('not_configured');
  });

  test('Anthropic speech → capability_unsupported', async () => {
    const p = new AnthropicProvider({
      provider: 'anthropic',
      model_id: 'claude-3-5-sonnet',
      display_name: 'x',
      modalities: ['text', 'vision'],
    });
    const r = await p.speech({ audio_bytes: new Uint8Array(), audio_mime: 'audio/wav' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_kind).toBe('capability_unsupported');
  });
});

describe('Factory', () => {
  test('instantiates each provider class', () => {
    for (const provider of ['gemini', 'openai', 'anthropic', 'azure_openai'] as const) {
      const p = instantiateProvider({
        provider,
        model_id: 'x',
        display_name: 'x',
        modalities: ['text'],
      });
      expect(p.provider).toBe(provider);
    }
  });
  test('local sentinel throws', () => {
    expect(() =>
      instantiateProvider({
        provider: 'local',
        model_id: 'x',
        display_name: 'x',
        modalities: ['text'],
      })
    ).toThrow();
  });
});
