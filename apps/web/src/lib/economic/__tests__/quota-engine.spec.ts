/**
 * @jest-environment node
 */

import {
  checkFile,
  checkDailyUploadBudget,
  BETA_FILE_LIMITS,
  BETA_DAILY_UPLOAD_BUDGET_BYTES,
  costDimensionForKind,
} from '../quota-engine';

describe('checkFile — size caps', () => {
  test('PDF under 50 MB → allowed', () => {
    const r = checkFile({ file_kind: 'pdf', size_bytes: 1_000_000 });
    expect(r.allowed).toBe(true);
  });
  test('PDF at 50 MB → allowed (boundary)', () => {
    const r = checkFile({ file_kind: 'pdf', size_bytes: BETA_FILE_LIMITS.pdf.max_bytes });
    expect(r.allowed).toBe(true);
  });
  test('PDF over 50 MB → file_too_large', () => {
    const r = checkFile({ file_kind: 'pdf', size_bytes: BETA_FILE_LIMITS.pdf.max_bytes + 1 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason_code).toBe('file_too_large');
  });
  test('PDF with > 250 pages → too_many_pages', () => {
    const r = checkFile({ file_kind: 'pdf', size_bytes: 1_000_000, pages: 251 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason_code).toBe('too_many_pages');
  });
  test('DOCX cap is 25 MB', () => {
    const r = checkFile({ file_kind: 'docx', size_bytes: 26 * 1024 * 1024 });
    expect(r.allowed).toBe(false);
  });
  test('XLSX shares DOCX cap', () => {
    const r = checkFile({ file_kind: 'xlsx', size_bytes: 26 * 1024 * 1024 });
    expect(r.allowed).toBe(false);
  });
  test('CSV maps to xlsx cap', () => {
    const r = checkFile({ file_kind: 'csv', size_bytes: 26 * 1024 * 1024 });
    expect(r.allowed).toBe(false);
  });
});

describe('checkFile — duration caps', () => {
  test('audio under 15 minutes → allowed', () => {
    const r = checkFile({ file_kind: 'mp3', size_bytes: 5_000_000, duration_seconds: 14 * 60 });
    expect(r.allowed).toBe(true);
  });
  test('audio at exactly 15 minutes → allowed', () => {
    const r = checkFile({ file_kind: 'mp3', size_bytes: 5_000_000, duration_seconds: 15 * 60 });
    expect(r.allowed).toBe(true);
  });
  test('audio over 15 minutes → duration_too_long', () => {
    const r = checkFile({ file_kind: 'mp3', size_bytes: 5_000_000, duration_seconds: 16 * 60 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason_code).toBe('duration_too_long');
  });
  test('video over 5 minutes → duration_too_long', () => {
    const r = checkFile({ file_kind: 'mp4', size_bytes: 10_000_000, duration_seconds: 6 * 60 });
    expect(r.allowed).toBe(false);
  });
  test('video at 4 minutes 59 seconds → allowed', () => {
    const r = checkFile({
      file_kind: 'mp4',
      size_bytes: 10_000_000,
      duration_seconds: 4 * 60 + 59,
    });
    expect(r.allowed).toBe(true);
  });
});

describe('checkFile — image + txt fallbacks', () => {
  test('image at 25 MB → allowed', () => {
    const r = checkFile({ file_kind: 'png', size_bytes: 25 * 1024 * 1024 });
    expect(r.allowed).toBe(true);
  });
  test('image at 26 MB → blocked', () => {
    const r = checkFile({ file_kind: 'png', size_bytes: 26 * 1024 * 1024 });
    expect(r.allowed).toBe(false);
  });
  test('unknown kind → allowed (engine is gated by validateUpload upstream)', () => {
    const r = checkFile({ file_kind: 'sketch', size_bytes: 999_999_999 });
    expect(r.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Daily upload budget
// ---------------------------------------------------------------------------

function makeSupabase(rows: Array<{ size_bytes: number }>) {
  return {
    from() {
      const chain = {
        eq() {
          return chain;
        },
        gte() {
          return chain;
        },
        then(onF: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(onF);
        },
      };
      return { select: () => chain };
    },
  };
}

describe('checkDailyUploadBudget', () => {
  test('empty history + 100 MB new file → allowed', async () => {
    const r = await checkDailyUploadBudget({
      supabase: makeSupabase([]),
      user_id: 'u1',
      new_file_bytes: 100 * 1024 * 1024,
    });
    expect(r.allowed).toBe(true);
  });

  test('480 MB used + 100 MB new file → blocked', async () => {
    const r = await checkDailyUploadBudget({
      supabase: makeSupabase([{ size_bytes: 480 * 1024 * 1024 }]),
      user_id: 'u1',
      new_file_bytes: 100 * 1024 * 1024,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason_code).toBe('daily_upload_budget_exceeded');
  });

  test('500 MB used + tiny new file → blocked', async () => {
    const r = await checkDailyUploadBudget({
      supabase: makeSupabase([{ size_bytes: BETA_DAILY_UPLOAD_BUDGET_BYTES }]),
      user_id: 'u1',
      new_file_bytes: 1,
    });
    expect(r.allowed).toBe(false);
  });

  test('multiple historical files sum correctly', async () => {
    const r = await checkDailyUploadBudget({
      supabase: makeSupabase([
        { size_bytes: 200 * 1024 * 1024 },
        { size_bytes: 200 * 1024 * 1024 },
      ]),
      user_id: 'u1',
      new_file_bytes: 150 * 1024 * 1024,
    });
    expect(r.allowed).toBe(false); // 400 + 150 > 500
  });
});

describe('costDimensionForKind', () => {
  test('audio → speech_minute', () => {
    expect(costDimensionForKind('mp3')).toBe('speech_minute');
    expect(costDimensionForKind('wav')).toBe('speech_minute');
  });
  test('video → video_minute', () => {
    expect(costDimensionForKind('mp4')).toBe('video_minute');
  });
  test('image → vision_image', () => {
    expect(costDimensionForKind('png')).toBe('vision_image');
  });
  test('PDF → vision_image (OCR fallback dimension)', () => {
    expect(costDimensionForKind('pdf')).toBe('vision_image');
  });
  test('unknown → other', () => {
    expect(costDimensionForKind('sketch')).toBe('other');
  });
});
