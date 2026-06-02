/**
 * @jest-environment node
 *
 * Pipeline + graph promoter tests.
 */

import { __test as pipe } from '../pipeline';
import { __test as prom } from '../graph-promoter';

describe('pipeline — text document', () => {
  test('plain text + amount + date → extractors_run + facts present', async () => {
    const text = 'Closing balance: $1,234.56 on 2026-06-01. Account # 1234567890.';
    const r = await pipe.runPipeline({
      filename: 'statement.txt',
      size_bytes: text.length,
      text,
      bytes: new TextEncoder().encode(text),
    });
    expect(r.extractors_run).toContain('text_document');
    expect(r.ok).toBe(true);
    expect(r.deferred).toBe(false);
    const facts = pipe.collectFacts(r);
    expect(facts.some((f) => f.predicate === 'amount_mentioned')).toBe(true);
    expect(facts.every((f) => Object.keys(f.source_locator).length > 0)).toBe(true);
  });

  test('CSV → tabular extractor + primitives over text are NOT triggered (text empty)', async () => {
    const csv = 'a,b\n1,2';
    const r = await pipe.runPipeline({
      filename: 'budget.csv',
      size_bytes: csv.length,
      text: csv,
      bytes: new TextEncoder().encode(csv),
    });
    expect(r.extractors_run).toContain('csv');
    expect(r.ok).toBe(true);
  });
});

describe('pipeline — real extractor path', () => {
  test('PDF malformed bytes → real pdf-parse extractor returns a clean parse error (not a silent stub)', async () => {
    // Sprint N.1 replaced the stub PDF extractor with real pdf-parse.
    // An invalid PDF buffer is rejected at parse time with a structured
    // error — confidence=0 and deferred_reason='pdf_parse_error: ...'.
    const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const r = await pipe.runPipeline({
      filename: 'x.pdf',
      size_bytes: buf.length,
      bytes: buf,
    });
    expect(r.extractors_run).toContain('pdf');
    const pdfOut = r.outputs.find((o) => o.extractor_name === 'pdf')!;
    expect(pdfOut.confidence).toBe(0);
    expect(pdfOut.deferred_reason ?? '').toMatch(/pdf_parse_error|pdf_empty/);
  });
});

describe('pipeline — no extractor', () => {
  test('unknown kind → router error', async () => {
    const r = await pipe.runPipeline({
      filename: 'x.fooz',
      size_bytes: 0,
      bytes: new Uint8Array(),
    });
    expect(r.extractors_run).toEqual([]);
    expect(r.errors[0].extractor).toBe('router');
  });
});

describe('graph promoter', () => {
  test('dedupes by entity_kind+canonical_text', () => {
    const out = prom.promoteEntities({
      entities: [
        { entity_kind: 'email', canonical_text: 'a@b.com', attributes: {}, confidence: 0.8 },
        { entity_kind: 'email', canonical_text: 'A@B.COM', attributes: {}, confidence: 0.95 },
        { entity_kind: 'email', canonical_text: 'a@b.com', attributes: {}, confidence: 0.7 },
      ],
    });
    expect(out.promoted_entities.length).toBe(1);
    expect(out.promoted_entities[0].confidence).toBe(0.95);
  });
  test('drops below floor', () => {
    const out = prom.promoteEntities({
      entities: [
        { entity_kind: 'date', canonical_text: '2026-06-01', attributes: {}, confidence: 0.3 },
      ],
    });
    expect(out.promoted_entities.length).toBe(0);
    expect(out.rejected_entities.length).toBe(1);
  });
  test('marks promoted entities with graph_promoted=true', () => {
    const out = prom.promoteEntities({
      entities: [
        { entity_kind: 'date', canonical_text: '2026-06-01', attributes: {}, confidence: 0.9 },
      ],
    });
    expect(out.promoted_entities[0].graph_promoted).toBe(true);
  });
  test('relationships only emit when both endpoints survived', () => {
    const out = prom.promoteEntities({
      entities: [
        { entity_kind: 'person', canonical_text: 'Alice', attributes: {}, confidence: 0.9 },
        { entity_kind: 'organization', canonical_text: 'Acme', attributes: {}, confidence: 0.95 },
      ],
      relationships: [
        { relationship_kind: 'employed_by', confidence: 0.85, subject_index: 0, object_index: 1 },
      ],
    });
    expect(out.promoted_relationships.length).toBe(1);
    expect(out.promoted_relationships[0].subject_canonical).toBe('Alice');
  });
});
