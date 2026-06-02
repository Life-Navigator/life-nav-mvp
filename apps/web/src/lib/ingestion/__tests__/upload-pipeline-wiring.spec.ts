/**
 * @jest-environment node
 *
 * Sprint N.2 Phases 2 + 3 + 4 verification — proves processUpload
 * always invokes:
 *
 *   - injected MalwareScanner (Phase 2)
 *   - injected StorageAdapter (Phase 3)
 *   - ingestion_malware_scans insert (Phase 2)
 *   - ingestion_extraction_telemetry insert (Phase 4)
 *   - ingestion_files row carries storage_bucket/storage_path (Phase 3)
 *
 * And that an infected scan REJECTS extraction entirely.
 */

import { processUpload } from '../upload-pipeline';
import type { MalwareScanner, ScanResult } from '@/lib/malware/scanner';
import type { StorageAdapter, ObjectRef } from '@/lib/storage/object-store';

interface Op {
  op: 'insert' | 'update';
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

interface MockState {
  ops: Op[];
  insertedIds: Record<string, string>;
}

function mockSupabase() {
  const state: MockState = { ops: [], insertedIds: {} };
  let counter = 0;
  const client = {
    from(table: string) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert(payload: any) {
          counter += 1;
          const id = `${table}_${counter}`;
          state.ops.push({ op: 'insert', table, payload });
          state.insertedIds[table] = id;
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id }, error: null });
                },
              };
            },
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update(payload: any) {
          state.ops.push({ op: 'update', table, payload });
          return {
            eq() {
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
  return { state, client };
}

function makeScanner(
  result: Partial<ScanResult> & { status: ScanResult['status'] }
): MalwareScanner {
  return {
    name: 'clamav',
    async scan(_b: Uint8Array): Promise<ScanResult> {
      return {
        scanner: 'clamav',
        status: result.status,
        signature: result.signature,
        details: result.details ?? {},
        duration_ms: result.duration_ms ?? 5,
        scanner_version: 'tcp-instream',
      };
    },
  };
}

function makeStorage(): { adapter: StorageAdapter; uploaded: boolean } {
  const out = { uploaded: false } as { uploaded: boolean };
  const adapter: StorageAdapter = {
    async uploadObject(args): Promise<ObjectRef> {
      out.uploaded = true;
      return {
        bucket: 'ingestion',
        path: `${args.user_id}/${args.file_id}/${args.version_number}/${args.sha256}`,
        size_bytes: args.bytes.length,
        sha256: args.sha256,
      };
    },
    async getSignedDownloadUrl() {
      return 'https://example.test/url';
    },
    async deleteObject() {
      return { ok: true };
    },
  };
  return { adapter, uploaded: out.uploaded };
}

const TXT = new TextEncoder().encode('hello world from sprint N.2 test');

describe('processUpload — scan + store + telemetry wiring', () => {
  test('clean scan: persists scan row, storage row, telemetry, and succeeds', async () => {
    const { state, client } = mockSupabase();
    const storage = makeStorage();
    const r = await processUpload({
      user_id: 'u1',
      filename: 'hello.txt',
      declared_mime: 'text/plain',
      bytes: TXT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      scanner: makeScanner({ status: 'clean' }),
      storage: storage.adapter,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scan.status).toBe('clean');
    expect(r.scan.scanner).toBe('clamav');
    expect(r.storage?.bucket).toBe('ingestion');
    expect(r.storage?.path).toMatch(/u1\/.+\/1\/.+/);

    // ingestion_malware_scans row
    const scanRows = state.ops.filter(
      (o) => o.table === 'ingestion_malware_scans' && o.op === 'insert'
    );
    expect(scanRows.length).toBe(1);
    expect(scanRows[0].payload.status).toBe('clean');
    expect(scanRows[0].payload.scanner).toBe('clamav');

    // ingestion_files insert carries virus_scan_status=clean
    const fileInsert = state.ops.find((o) => o.table === 'ingestion_files' && o.op === 'insert');
    expect(fileInsert?.payload.virus_scan_status).toBe('clean');

    // ingestion_files update with storage_bucket/storage_path
    const fileUpdate = state.ops.find(
      (o) => o.table === 'ingestion_files' && o.op === 'update' && o.payload.storage_path
    );
    expect(fileUpdate).toBeDefined();
    expect(fileUpdate?.payload.storage_bucket).toBe('ingestion');

    // ingestion_extraction_telemetry row(s)
    const telemetry = state.ops.filter((o) => o.table === 'ingestion_extraction_telemetry');
    expect(telemetry.length).toBeGreaterThanOrEqual(1);
  });

  test('infected scan: rejects extraction; no jobs / extractions / promotions persisted', async () => {
    const { state, client } = mockSupabase();
    const storage = makeStorage();
    const r = await processUpload({
      user_id: 'u2',
      filename: 'evil.txt',
      declared_mime: 'text/plain',
      bytes: TXT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      scanner: makeScanner({ status: 'infected', signature: 'EICAR-Test-File' }),
      storage: storage.adapter,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe('infected');
    expect(r.reason_code).toBe('malware_detected');
    expect(r.client_message).not.toContain('EICAR'); // no leak

    // scan row IS persisted (audit)
    const scanRows = state.ops.filter((o) => o.table === 'ingestion_malware_scans');
    expect(scanRows.length).toBe(1);

    // file row carries virus_scan_status=infected
    const fileInsert = state.ops.find((o) => o.table === 'ingestion_files' && o.op === 'insert');
    expect(fileInsert?.payload.virus_scan_status).toBe('infected');

    // No extraction job / no extractions / no promotions / no storage upload
    expect(state.ops.find((o) => o.table === 'ingestion_extraction_jobs')).toBeUndefined();
    expect(state.ops.find((o) => o.table === 'ingestion_extractions')).toBeUndefined();
    expect(state.ops.find((o) => o.table === 'ingestion_extracted_entities')).toBeUndefined();
    expect(state.ops.find((o) => o.table === 'ingestion_extracted_facts')).toBeUndefined();
  });

  test('scanner error: rejects with scan_error and exposes safe message', async () => {
    const { state, client } = mockSupabase();
    const storage = makeStorage();
    const r = await processUpload({
      user_id: 'u3',
      filename: 'unknown.txt',
      declared_mime: 'text/plain',
      bytes: TXT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      scanner: makeScanner({ status: 'error', details: { reason: 'clamd refused' } }),
      storage: storage.adapter,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe('scan_error');
    expect(r.client_message).toMatch(/scanner is currently unavailable/i);
    // No internal reason leak
    expect(r.client_message).not.toContain('clamd');
    // Audit row exists
    expect(state.ops.filter((o) => o.table === 'ingestion_malware_scans').length).toBe(1);
  });

  test('storage error without INGESTION_STORAGE_FALLBACK: rejects', async () => {
    const { client } = mockSupabase();
    const adapter: StorageAdapter = {
      async uploadObject() {
        throw new Error('bucket missing');
      },
      async getSignedDownloadUrl() {
        return '';
      },
      async deleteObject() {
        return { ok: true };
      },
    };
    delete process.env.INGESTION_STORAGE_FALLBACK;

    const r = await processUpload({
      user_id: 'u4',
      filename: 'hello.txt',
      declared_mime: 'text/plain',
      bytes: TXT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      scanner: makeScanner({ status: 'clean' }),
      storage: adapter,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe('storage_error');
    expect(r.client_message).not.toContain('bucket missing');
  });
});
