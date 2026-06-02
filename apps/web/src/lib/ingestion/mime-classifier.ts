/**
 * File-kind classifier — Sprint N Phase 1.
 *
 * Pure function. Detects FileKind + modality from:
 *   1. Magic bytes (first 32 bytes of the file)
 *   2. File extension fallback
 *
 * Magic-byte detection is the source of truth; extension is the
 * fallback when the buffer is too short or magic is absent (e.g.
 * plain text / CSV / JSON).
 *
 * Output includes the `signals[]` so the audit log shows what
 * matched.
 */

import type { ClassifiedFile, FileKind, FileModality } from '@/types/ingestion';

// ---------------------------------------------------------------------------
// Static maps
// ---------------------------------------------------------------------------

const KIND_MIMES: Record<FileKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  rtf: 'application/rtf',
  md: 'text/markdown',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  tiff: 'image/tiff',
  heic: 'image/heic',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  other: 'application/octet-stream',
  unknown: 'application/octet-stream',
};

const KIND_MODALITY: Record<FileKind, FileModality> = {
  pdf: 'document',
  docx: 'document',
  doc: 'document',
  txt: 'document',
  rtf: 'document',
  md: 'document',
  odt: 'document',
  html: 'document',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  pptx: 'presentation',
  ppt: 'presentation',
  odp: 'presentation',
  json: 'structured',
  xml: 'structured',
  jpg: 'image',
  png: 'image',
  webp: 'image',
  tiff: 'image',
  heic: 'image',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  other: 'other',
  unknown: 'other',
};

const EXT_TO_KIND: Record<string, FileKind> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'doc',
  txt: 'txt',
  rtf: 'rtf',
  md: 'md',
  xlsx: 'xlsx',
  xls: 'xls',
  csv: 'csv',
  pptx: 'pptx',
  ppt: 'ppt',
  odt: 'odt',
  ods: 'ods',
  odp: 'odp',
  json: 'json',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  tif: 'tiff',
  tiff: 'tiff',
  heic: 'heic',
  mp3: 'mp3',
  wav: 'wav',
  m4a: 'm4a',
  aac: 'aac',
  flac: 'flac',
  mp4: 'mp4',
  mov: 'mov',
  avi: 'avi',
  mkv: 'mkv',
  webm: 'webm',
};

// ---------------------------------------------------------------------------
// Magic bytes — by initial signature prefix
// ---------------------------------------------------------------------------

interface MagicRule {
  kind: FileKind;
  prefix: number[];
  label: string;
}

const MAGIC_RULES: MagicRule[] = [
  // PDF — "%PDF-"
  { kind: 'pdf', prefix: [0x25, 0x50, 0x44, 0x46, 0x2d], label: 'magic:%PDF-' },
  // PNG
  { kind: 'png', prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], label: 'magic:PNG' },
  // JPEG (FF D8 FF)
  { kind: 'jpg', prefix: [0xff, 0xd8, 0xff], label: 'magic:JPEG' },
  // WebP — "RIFF....WEBP"
  { kind: 'webp', prefix: [0x52, 0x49, 0x46, 0x46], label: 'magic:RIFF' },
  // TIFF — II*\0 or MM\0*
  { kind: 'tiff', prefix: [0x49, 0x49, 0x2a, 0x00], label: 'magic:TIFF-II' },
  { kind: 'tiff', prefix: [0x4d, 0x4d, 0x00, 0x2a], label: 'magic:TIFF-MM' },
  // FLAC
  { kind: 'flac', prefix: [0x66, 0x4c, 0x61, 0x43], label: 'magic:fLaC' },
  // OGG (not in our list but tag as wav fallback skipped)
  // WAV — "RIFF....WAVE" (we'll resolve below via secondary check)
  // MP3 — ID3 tag or FF Fx
  { kind: 'mp3', prefix: [0x49, 0x44, 0x33], label: 'magic:ID3' },
  // MP4/M4A/MOV — ISO BMFF: skip 4-byte size + "ftyp"
  // We detect "ftyp" at bytes 4..8.
  // Handled below as a special case (offset != 0).
  // ZIP-based (docx/xlsx/pptx/odt/ods/odp/epub) — "PK\x03\x04"
  { kind: 'other', prefix: [0x50, 0x4b, 0x03, 0x04], label: 'magic:ZIP' },
  // Matroska / WebM EBML
  { kind: 'mkv', prefix: [0x1a, 0x45, 0xdf, 0xa3], label: 'magic:EBML' },
  // AVI — "RIFF" + "AVI " (secondary check)
  // FLV (not in list)
  // RTF — "{\\rtf"
  { kind: 'rtf', prefix: [0x7b, 0x5c, 0x72, 0x74, 0x66], label: 'magic:RTF' },
];

function startsWith(buf: Uint8Array, prefix: number[]): boolean {
  if (buf.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (buf[i] !== prefix[i]) return false;
  return true;
}

function asAscii(buf: Uint8Array, start: number, len: number): string {
  return Array.from(buf.slice(start, start + len))
    .map((b) => String.fromCharCode(b))
    .join('');
}

// ---------------------------------------------------------------------------
// classifyFile — exported entry
// ---------------------------------------------------------------------------

export interface ClassifyInputs {
  filename: string;
  declared_mime?: string;
  /** Optional buffer — used for magic-byte sniffing. */
  head?: Uint8Array;
}

export function classifyFile(inputs: ClassifyInputs): ClassifiedFile {
  const signals: string[] = [];
  const ext = (inputs.filename.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  const head = inputs.head;

  let kind: FileKind = 'unknown';
  let confidence = 0;

  // 1. Magic-byte detection.
  if (head && head.length >= 4) {
    for (const rule of MAGIC_RULES) {
      if (startsWith(head, rule.prefix)) {
        signals.push(rule.label);
        kind = rule.kind;
        confidence = 0.95;
        break;
      }
    }
  }

  // 2. RIFF disambiguation — WebP vs WAV vs AVI
  if (head && kind === 'webp' && head.length >= 12) {
    const tag = asAscii(head, 8, 4);
    if (tag === 'WEBP') {
      kind = 'webp';
      confidence = 0.97;
      signals.push('magic:RIFF/WEBP');
    } else if (tag === 'WAVE') {
      kind = 'wav';
      confidence = 0.97;
      signals.push('magic:RIFF/WAVE');
    } else if (tag === 'AVI ') {
      kind = 'avi';
      confidence = 0.97;
      signals.push('magic:RIFF/AVI');
    }
  }

  // 3. ISO BMFF — bytes 4..7 == "ftyp", brand at 8..11.
  if (head && head.length >= 12 && asAscii(head, 4, 4) === 'ftyp') {
    const brand = asAscii(head, 8, 4);
    signals.push(`magic:ftyp/${brand}`);
    if (brand === 'qt  ') {
      kind = 'mov';
      confidence = 0.95;
    } else if (brand.startsWith('M4A') || brand === 'mp42') {
      kind = brand.startsWith('M4A') ? 'm4a' : 'mp4';
      confidence = 0.95;
    } else if (brand.startsWith('iso')) {
      kind = 'mp4';
      confidence = 0.95;
    } else if (brand.startsWith('M4V')) {
      kind = 'mp4';
      confidence = 0.95;
    } else {
      kind = 'mp4';
      confidence = 0.85;
    }
  }

  // 4. EBML disambiguation — MKV vs WEBM
  if (head && kind === 'mkv' && inputs.declared_mime === 'video/webm') {
    kind = 'webm';
    signals.push('declared_mime:webm');
  }

  // 5. ZIP-based offices — peek for OOXML / OpenDocument prefix in the
  // local file header path. For Sprint N we trust the extension when
  // the magic is ZIP.
  if (kind === 'other' && head && startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    if (ext === 'docx') {
      kind = 'docx';
      confidence = 0.95;
      signals.push('zip+ext:docx');
    } else if (ext === 'xlsx') {
      kind = 'xlsx';
      confidence = 0.95;
      signals.push('zip+ext:xlsx');
    } else if (ext === 'pptx') {
      kind = 'pptx';
      confidence = 0.95;
      signals.push('zip+ext:pptx');
    } else if (ext === 'odt') {
      kind = 'odt';
      confidence = 0.95;
      signals.push('zip+ext:odt');
    } else if (ext === 'ods') {
      kind = 'ods';
      confidence = 0.95;
      signals.push('zip+ext:ods');
    } else if (ext === 'odp') {
      kind = 'odp';
      confidence = 0.95;
      signals.push('zip+ext:odp');
    } else {
      confidence = 0.7;
      signals.push('zip+unknown_ext');
    }
  }

  // 6. Extension fallback.
  if (kind === 'unknown' || kind === 'other') {
    const fromExt = EXT_TO_KIND[ext];
    if (fromExt) {
      kind = fromExt;
      confidence = Math.max(confidence, 0.6);
      signals.push(`ext:${ext}`);
    }
  }

  // 7. HTML/XML/JSON text sniff (only if no magic + extension hinted).
  if ((kind === 'unknown' || kind === 'other') && head) {
    const peek = asAscii(head, 0, Math.min(head.length, 512)).trim();
    if (peek.startsWith('<?xml')) {
      kind = 'xml';
      confidence = 0.85;
      signals.push('sniff:<?xml');
    } else if (peek.startsWith('<!DOCTYPE html') || peek.startsWith('<html')) {
      kind = 'html';
      confidence = 0.85;
      signals.push('sniff:html');
    } else if (peek.startsWith('{') || peek.startsWith('[')) {
      kind = 'json';
      confidence = 0.7;
      signals.push('sniff:json');
    }
  }

  // 8. Final: declared MIME backstop.
  if (kind === 'unknown' && inputs.declared_mime) {
    for (const [k, mime] of Object.entries(KIND_MIMES)) {
      if (mime === inputs.declared_mime) {
        kind = k as FileKind;
        confidence = 0.5;
        signals.push(`declared_mime:${mime}`);
        break;
      }
    }
  }

  return {
    file_kind: kind,
    modality: KIND_MODALITY[kind],
    detected_mime: KIND_MIMES[kind],
    confidence: Number(confidence.toFixed(2)),
    signals,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function mimeForKind(kind: FileKind): string {
  return KIND_MIMES[kind] ?? 'application/octet-stream';
}

export function modalityForKind(kind: FileKind): FileModality {
  return KIND_MODALITY[kind] ?? 'other';
}

export const __test = {
  classifyFile,
  EXT_TO_KIND,
  MAGIC_RULES,
  KIND_MIMES,
  KIND_MODALITY,
  startsWith,
  asAscii,
};
