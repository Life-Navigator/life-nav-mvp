/**
 * @jest-environment node
 *
 * Classifier + validators tests.
 */

import { __test as cls } from '../mime-classifier';
import { __test as val } from '../validators';

const { classifyFile } = cls;

function bytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
}

describe('classifyFile — magic-byte detection', () => {
  test('PDF', () => {
    const r = classifyFile({ filename: 'x.pdf', head: bytes('255044462d') });
    expect(r.file_kind).toBe('pdf');
    expect(r.modality).toBe('document');
    expect(r.signals).toContain('magic:%PDF-');
  });
  test('PNG', () => {
    const r = classifyFile({ filename: 'x.png', head: bytes('89504e470d0a1a0a') });
    expect(r.file_kind).toBe('png');
  });
  test('JPEG', () => {
    const r = classifyFile({ filename: 'x.jpg', head: bytes('ffd8ffe000104a4649') });
    expect(r.file_kind).toBe('jpg');
  });
  test('RIFF + WAVE → wav', () => {
    const r = classifyFile({ filename: 'x.wav', head: bytes('524946462400000057415645') });
    expect(r.file_kind).toBe('wav');
  });
  test('RIFF + WEBP → webp', () => {
    const r = classifyFile({ filename: 'x.webp', head: bytes('52494646240000005745425056503820') });
    expect(r.file_kind).toBe('webp');
  });
  test('RIFF + AVI → avi', () => {
    // "RIFF????AVI "
    const r = classifyFile({ filename: 'x.avi', head: bytes('524946462400000041564920') });
    expect(r.file_kind).toBe('avi');
  });
  test('ISO BMFF ftyp/M4A → m4a', () => {
    // size(4) + 'ftyp' + 'M4A '
    const r = classifyFile({
      filename: 'x.m4a',
      head: bytes('0000002066747970' + '4d34412020000000'),
    });
    expect(r.file_kind).toBe('m4a');
  });
  test('FLAC', () => {
    const r = classifyFile({ filename: 'x.flac', head: bytes('664c6143' + '00000000') });
    expect(r.file_kind).toBe('flac');
  });
  test('ZIP + docx → docx', () => {
    const r = classifyFile({ filename: 'x.docx', head: bytes('504b0304' + '14000600') });
    expect(r.file_kind).toBe('docx');
  });
});

describe('classifyFile — sniffs without magic', () => {
  test('<?xml → xml', () => {
    const head = new TextEncoder().encode('<?xml version="1.0"?><root/>');
    const r = classifyFile({ filename: 'x.unknown', head });
    expect(r.file_kind).toBe('xml');
  });
  test('<html → html', () => {
    const head = new TextEncoder().encode('<!DOCTYPE html><html>');
    const r = classifyFile({ filename: 'x.unknown', head });
    expect(r.file_kind).toBe('html');
  });
  test('{ → json (low confidence)', () => {
    const head = new TextEncoder().encode('{"a":1}');
    const r = classifyFile({ filename: 'x.unknown', head });
    expect(r.file_kind).toBe('json');
    expect(r.confidence).toBeLessThan(0.9);
  });
});

describe('classifyFile — extension fallback', () => {
  test('csv with no magic', () => {
    const r = classifyFile({ filename: 'budget.csv', head: new TextEncoder().encode('a,b\n1,2') });
    expect(r.file_kind).toBe('csv');
  });
  test('unknown extension → unknown', () => {
    const r = classifyFile({ filename: 'x.fooz' });
    expect(r.file_kind).toBe('unknown');
  });
});

describe('validateUpload', () => {
  const cleanClass = {
    file_kind: 'pdf' as const,
    modality: 'document' as const,
    detected_mime: 'application/pdf',
    confidence: 0.95,
    signals: ['magic:%PDF-'],
  };
  test('happy path', () => {
    const v = val.validateUpload({
      filename: 'x.pdf',
      declared_mime: 'application/pdf',
      size_bytes: 1024,
      classification: cleanClass,
    });
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });
  test('size cap → error', () => {
    const v = val.validateUpload({
      filename: 'x.pdf',
      size_bytes: 1024 * 1024 * 1024,
      classification: cleanClass,
    });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/size_exceeds_cap/);
  });
  test('mime mismatch at high confidence → error', () => {
    const v = val.validateUpload({
      filename: 'x.pdf',
      declared_mime: 'application/zip',
      size_bytes: 100,
      classification: cleanClass,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.startsWith('mime_mismatch'))).toBe(true);
  });
  test('mime mismatch at low confidence → warning only', () => {
    const v = val.validateUpload({
      filename: 'x.csv',
      declared_mime: 'application/zip',
      size_bytes: 100,
      classification: {
        ...cleanClass,
        confidence: 0.7,
        file_kind: 'csv',
        modality: 'spreadsheet',
        detected_mime: 'text/csv',
      },
    });
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => w.startsWith('mime_mismatch'))).toBe(true);
  });
  test('unknown file_kind rejected', () => {
    const v = val.validateUpload({
      filename: 'x.bin',
      size_bytes: 100,
      classification: { ...cleanClass, file_kind: 'unknown' },
    });
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('file_kind_unknown');
  });
});

describe('canExtractGivenScan', () => {
  test('clean passes', () => {
    expect(val.canExtractGivenScan('clean').ok).toBe(true);
  });
  test('infected blocks', () => {
    expect(val.canExtractGivenScan('infected').ok).toBe(false);
  });
  test('pending blocks', () => {
    expect(val.canExtractGivenScan('pending').ok).toBe(false);
  });
});

describe('validateFacts', () => {
  test('valid fact passes', () => {
    const v = val.validateFacts([
      {
        predicate: 'amount_mentioned',
        extraction_confidence: 0.9,
        object_value: 100,
        object_unit: 'USD',
        source_locator: { char_start: 0, char_end: 10 },
      },
    ]);
    expect(v.ok).toBe(true);
  });
  test('empty locator → error', () => {
    const v = val.validateFacts([
      {
        predicate: 'x',
        extraction_confidence: 0.9,
        source_locator: {},
      },
    ]);
    expect(v.ok).toBe(false);
    expect(v.errors[0].reason).toBe('locator_empty');
  });
  test('out-of-range confidence → error', () => {
    const v = val.validateFacts([
      {
        predicate: 'x',
        extraction_confidence: 1.5,
        source_locator: { page: 1 },
      },
    ]);
    expect(v.ok).toBe(false);
  });
});
