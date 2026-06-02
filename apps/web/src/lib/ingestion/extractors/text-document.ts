/**
 * Plain-text / RTF / Markdown / HTML-strip extractor.
 *
 * Deterministic. Pure text in, plain text out. We strip HTML tags
 * via a conservative regex and decode the common entities; we do
 * NOT execute JavaScript or parse the DOM. RTF gets its bracketed
 * control sequences stripped.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput } from '@/types/ingestion';

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripRtf(s: string): string {
  return s
    .replace(/\{\\\*[^}]*\}/g, '')
    .replace(/\\[a-zA-Z]+-?\d*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SUPPORTED = new Set(['txt', 'rtf', 'md', 'html']);

export const textDocumentExtractor: ExtractorAdapter = {
  name: 'text_document',
  version: '1.0.0',
  supports(c) {
    return SUPPORTED.has(c.file_kind);
  },
  extract(input: ExtractorInput): ExtractorOutput {
    const text =
      input.text ??
      new TextDecoder('utf-8', { fatal: false }).decode(input.bytes ?? new Uint8Array());
    let out = text;
    if (input.classification.file_kind === 'html') out = stripHtml(out);
    else if (input.classification.file_kind === 'rtf') out = stripRtf(out);

    return {
      extractor_name: 'text_document',
      extractor_version: '1.0.0',
      extraction_kind: input.classification.file_kind === 'html' ? 'rich_text' : 'plain_text',
      text: out,
      pages: 1,
      confidence: 0.98,
    };
  },
};

export const __test = { stripHtml, stripRtf, textDocumentExtractor };
