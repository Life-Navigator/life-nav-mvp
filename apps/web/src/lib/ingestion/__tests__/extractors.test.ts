/**
 * @jest-environment node
 *
 * Structured extractor tests — CSV / JSON / XML / plain-text / RTF / HTML.
 */

import { __test as csvT } from '../extractors/csv';
import { __test as jsonT } from '../extractors/json';
import { __test as xmlT } from '../extractors/xml';
import { __test as txtT } from '../extractors/text-document';

describe('CSV', () => {
  test('sniffs comma', () => expect(csvT.sniffDelimiter('a,b,c\n1,2,3')).toBe(','));
  test('sniffs semicolon', () => expect(csvT.sniffDelimiter('a;b;c\n1;2;3')).toBe(';'));
  test('sniffs tab', () => expect(csvT.sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t'));
  test('handles quoted fields with commas', () => {
    const r = csvT.parseLine('a,"b, with comma",c', ',');
    expect(r).toEqual(['a', 'b, with comma', 'c']);
  });
  test('handles escaped quotes', () => {
    const r = csvT.parseLine('"He said ""hi""",x', ',');
    expect(r).toEqual(['He said "hi"', 'x']);
  });
  test('infers headers when first row contains text', () => {
    const p = csvT.parseCsv('name,age\nAlice,30\nBob,25');
    expect(p.headers).toEqual(['name', 'age']);
    expect(p.header_inferred).toBe(false);
  });
  test('falls back to col_N headers when first row is numeric', () => {
    const p = csvT.parseCsv('1,2,3\n4,5,6');
    expect(p.headers).toEqual(['col_1', 'col_2', 'col_3']);
    expect(p.header_inferred).toBe(true);
  });
});

describe('JSON', () => {
  test('flattens nested objects', () => {
    const leaves = jsonT.flattenJson({ a: { b: 1, c: [2, 3] } });
    expect(leaves).toEqual(
      expect.arrayContaining([
        { path: '$.a.b', value: 1 },
        { path: '$.a.c[0]', value: 2 },
        { path: '$.a.c[1]', value: 3 },
      ])
    );
  });
  test('plain scalars become single leaves', () => {
    expect(jsonT.flattenJson(42)).toEqual([{ path: '$', value: 42 }]);
  });
  test('extractor returns json_tree', () => {
    const out = jsonT.jsonExtractor.extract({
      text: '{"a":1}',
      filename: 'x.json',
      classification: {
        file_kind: 'json',
        modality: 'structured',
        detected_mime: 'application/json',
        confidence: 1,
        signals: [],
      },
    }) as { extraction_kind: string };
    expect(out.extraction_kind).toBe('json_tree');
  });
  test('parse error → deferred sentinel', () => {
    const out = jsonT.jsonExtractor.extract({
      text: 'not json',
      filename: 'x.json',
      classification: {
        file_kind: 'json',
        modality: 'structured',
        detected_mime: 'application/json',
        confidence: 1,
        signals: [],
      },
    }) as { deferred_reason?: string };
    expect(out.deferred_reason).toMatch(/json_parse_error/);
  });
});

describe('XML', () => {
  test('extracts (path, value) pairs', () => {
    const p = xmlT.parseXml('<root><child>hi</child><a x="1">v</a></root>');
    expect(p.root_tag).toBe('root');
    expect(p.leaves).toEqual(
      expect.arrayContaining([
        { path: 'root/child', value: 'hi' },
        { path: 'root/a/@x', value: '1' },
        { path: 'root/a', value: 'v' },
      ])
    );
  });
  test('handles self-closing tags + attribute extraction', () => {
    const p = xmlT.parseXml('<root><br/><img src="x.png"/>content</root>');
    expect(p.root_tag).toBe('root');
    expect(p.leaves.some((l) => l.path === 'root/img/@src' && l.value === 'x.png')).toBe(true);
    expect(p.leaves.some((l) => l.value === 'content')).toBe(true);
  });
});

describe('text-document', () => {
  test('strips HTML tags', () => {
    expect(txtT.stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });
  test('decodes common entities', () => {
    expect(txtT.stripHtml('&amp; &lt; &gt; &quot;')).toBe('& < > "');
  });
  test('strips script blocks', () => {
    expect(txtT.stripHtml('<script>alert("x")</script>Hi')).toBe('Hi');
  });
  test('strips RTF control words', () => {
    const out = txtT.stripRtf('{\\rtf1\\ansi\\deff0 Hello world}');
    expect(out).toBe('Hello world');
  });
});
