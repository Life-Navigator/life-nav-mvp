/**
 * JSON extractor.
 *
 * Parses + flattens to (path, value) pairs. Strings, numbers, booleans,
 * and null become leaves; arrays use bracketed index paths.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';

type Leaf = { path: string; value: string | number | boolean | null };

export function flattenJson(value: unknown, path: string = '$'): Leaf[] {
  const out: Leaf[] = [];
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return out;
    out.push({ path, value: value as Leaf['value'] });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...flattenJson(v, `${path}[${i}]`)));
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    const child = path === '$' ? `$.${k}` : `${path}.${k}`;
    out.push(...flattenJson(v, child));
  }
  return out;
}

export const jsonExtractor: ExtractorAdapter = {
  name: 'json',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'json';
  },
  extract(input: ExtractorInput): ExtractorOutput {
    const text =
      input.text ??
      new TextDecoder('utf-8', { fatal: false }).decode(input.bytes ?? new Uint8Array());
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return {
        extractor_name: 'json',
        extractor_version: '1.0.0',
        extraction_kind: 'plain_text',
        text,
        confidence: 0.2,
        deferred_reason: 'json_parse_error: ' + (e instanceof Error ? e.message : 'unknown'),
      };
    }
    const leaves = flattenJson(parsed);
    return {
      extractor_name: 'json',
      extractor_version: '1.0.0',
      extraction_kind: 'json_tree',
      structured: { root: parsed, leaves } as unknown as Record<string, unknown>,
      confidence: 0.95,
    };
  },
};

export const __test = { flattenJson, jsonExtractor };
