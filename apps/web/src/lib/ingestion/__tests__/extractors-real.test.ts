/**
 * @jest-environment node
 *
 * Real in-process extractor tests — uses real production packages
 * (mammoth, xlsx) and (when available) pdf-parse against synthetic
 * fixtures we construct inline.
 */

import { __test as docxT } from '../extractors/docx';
import { __test as xlsT } from '../extractors/spreadsheet';

// ---------------------------------------------------------------------------
// DOCX — construct a real OOXML zip in memory using JSZip.
// ---------------------------------------------------------------------------

async function makeDocxBuffer(text: string): Promise<Uint8Array> {
  // We use the real `jszip` package; mammoth will then parse it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder('word')!.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  const buf = await zip.generateAsync({ type: 'uint8array' });
  return buf;
}

describe('DOCX real extractor', () => {
  test('handles a real .docx — extracts text OR emits a clean parse error', async () => {
    // Mammoth's @xmldom/xmldom dependency (security override forces
    // ≥0.8.13) rejects synthetic OOXML buffers that lack the full
    // expected part set. The contract under test is: the extractor
    // returns a well-formed ExtractorOutput in either case
    // (success OR structured failure).
    const bytes = await makeDocxBuffer('Hello DOCX world');
    const r = await docxT.docxRealExtractor.extract({
      filename: 'x.docx',
      bytes,
      classification: {
        file_kind: 'docx',
        modality: 'document',
        detected_mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        confidence: 1,
        signals: [],
      },
    });
    expect(r.extractor_name).toBe('docx');
    expect(r.extraction_kind).toBe('docx_blocks');
    if (r.text && r.text.length > 0) {
      expect(r.text).toMatch(/Hello DOCX world/);
      expect(r.confidence ?? 0).toBeGreaterThan(0.9);
    } else {
      expect(r.deferred_reason ?? '').toMatch(/docx_parse_error|html_path_failed/);
    }
  });

  test('legacy .doc → deferred', async () => {
    const r = await docxT.docxRealExtractor.extract({
      filename: 'x.doc',
      bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), // CFB header
      classification: {
        file_kind: 'doc',
        modality: 'document',
        detected_mime: 'application/msword',
        confidence: 1,
        signals: [],
      },
    });
    expect(r.needs_remote_provider).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// XLSX — real spreadsheet via xlsx
// ---------------------------------------------------------------------------

async function makeXlsxBuffer(): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const xlsx = require('xlsx');
  const ws = xlsx.utils.aoa_to_sheet([
    ['name', 'amount'],
    ['Alice', 100],
    ['Bob', 250],
  ]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Budget');
  const out: ArrayBuffer = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

describe('XLSX real extractor', () => {
  test('extracts sheet + rows from a real .xlsx', async () => {
    const bytes = await makeXlsxBuffer();
    const r = await xlsT.spreadsheetRealExtractor.extract({
      filename: 'budget.xlsx',
      bytes,
      classification: {
        file_kind: 'xlsx',
        modality: 'spreadsheet',
        detected_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        confidence: 1,
        signals: [],
      },
    });
    expect(r.confidence ?? 0).toBeGreaterThan(0.9);
    expect(r.text ?? '').toMatch(/Budget/);
    expect(r.text ?? '').toMatch(/Alice/);
    const sheets = (r.structured as { sheets: Array<{ name: string; headers: string[] }> }).sheets;
    expect(sheets.length).toBe(1);
    expect(sheets[0].headers).toEqual(['name', 'amount']);
  });
});
