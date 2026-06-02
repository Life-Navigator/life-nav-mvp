/**
 * XML extractor — pure regex-based parser.
 *
 * Deliberately does NOT pull in an XML library. We extract
 * `(path, value)` pairs by walking the tag stack with a lightweight
 * tokenizer. Attributes become `path/@attr` leaves.
 *
 * The output is a sketch of the structure suitable for entity
 * extraction; we do not validate against any schema.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';

interface XmlLeaf {
  path: string;
  value: string;
}

const TOKEN_RE =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([a-zA-Z][\w:-]*)>|<([a-zA-Z][\w:-]*)([^>]*?)\/>|<([a-zA-Z][\w:-]*)([^>]*?)>|([^<]+)/g;

const ATTR_RE = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"|([a-zA-Z][\w:-]*)\s*=\s*'([^']*)'/g;

export function parseXml(text: string): { leaves: XmlLeaf[]; root_tag?: string } {
  const leaves: XmlLeaf[] = [];
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  let root_tag: string | undefined;

  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const cdata = m[1];
    const closeTag = m[2];
    const selfOpen = m[3];
    const selfAttrs = m[4];
    const openTag = m[5];
    const openAttrs = m[6];
    const textChunk = m[7];

    if (closeTag) {
      stack.pop();
      continue;
    }
    if (selfOpen) {
      const path = [...stack, selfOpen].join('/');
      pushAttrs(leaves, path, selfAttrs ?? '');
      if (!root_tag) root_tag = selfOpen;
      continue;
    }
    if (openTag) {
      if (!root_tag) root_tag = openTag;
      stack.push(openTag);
      pushAttrs(leaves, stack.join('/'), openAttrs ?? '');
      continue;
    }
    if (cdata !== undefined) {
      const v = cdata.trim();
      if (v) leaves.push({ path: stack.join('/'), value: v });
      continue;
    }
    if (textChunk) {
      const v = textChunk.trim();
      if (v) leaves.push({ path: stack.join('/'), value: v });
      continue;
    }
  }
  return { leaves, root_tag };
}

function pushAttrs(leaves: XmlLeaf[], path: string, attrs: string) {
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(attrs)) !== null) {
    const k = m[1] ?? m[3];
    const v = m[2] ?? m[4];
    if (k && v != null) leaves.push({ path: `${path}/@${k}`, value: v });
  }
}

export const xmlExtractor: ExtractorAdapter = {
  name: 'xml',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'xml';
  },
  extract(input: ExtractorInput): ExtractorOutput {
    const text =
      input.text ??
      new TextDecoder('utf-8', { fatal: false }).decode(input.bytes ?? new Uint8Array());
    const parsed = parseXml(text);
    return {
      extractor_name: 'xml',
      extractor_version: '1.0.0',
      extraction_kind: 'xml_tree',
      structured: parsed as unknown as Record<string, unknown>,
      confidence: parsed.leaves.length > 0 ? 0.9 : 0.4,
    };
  },
};

export const __test = { parseXml, xmlExtractor };
