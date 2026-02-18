/**
 * File validation utilities with magic number (file signature) checking
 *
 * Magic numbers are byte sequences at the beginning of files that identify file types.
 * This provides security against file type spoofing via MIME type manipulation.
 */

/**
 * File type signatures (magic numbers)
 * Format: [offset, signature bytes, file type]
 */
const FILE_SIGNATURES = {
  // Images
  JPEG: { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeTypes: ['image/jpeg', 'image/jpg'] },
  PNG: { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeTypes: ['image/png'] },
  GIF: { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeTypes: ['image/gif'] },
  WEBP: { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeTypes: ['image/webp'], extraCheck: (buffer: Uint8Array) => {
    // WebP has "WEBP" at bytes 8-11
    return buffer.length >= 12 &&
           buffer[8] === 0x57 && buffer[9] === 0x45 &&
           buffer[10] === 0x42 && buffer[11] === 0x50;
  }},
  BMP: { bytes: [0x42, 0x4D], offset: 0, mimeTypes: ['image/bmp'] },

  // Documents
  PDF: { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeTypes: ['application/pdf'] },

  // Archives
  ZIP: { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeTypes: ['application/zip'] },

  // Office documents (all use ZIP format)
  DOCX: { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  XLSX: { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  PPTX: { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'] },
} as const;

type SignatureFileType = keyof typeof FILE_SIGNATURES;
export type SupportedFileType = SignatureFileType | 'CSV';
type OfficeContainerType = 'DOCX' | 'XLSX' | 'PPTX';
type FileSignature = {
  bytes: readonly number[];
  offset: number;
  mimeTypes: readonly string[];
  extraCheck?: (buffer: Uint8Array) => boolean;
};

const OFFICE_MIME_TO_TYPE: Record<string, OfficeContainerType> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
};

const OFFICE_EXTENSION_TO_TYPE: Record<string, OfficeContainerType> = {
  docx: 'DOCX',
  xlsx: 'XLSX',
  pptx: 'PPTX',
};

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/x-csv',
  'application/vnd.ms-excel', // Common browser MIME for CSV files.
]);

/**
 * Check if bytes match a signature
 */
function matchesSignature(buffer: Uint8Array, signature: FileSignature): boolean {
  if (buffer.length < signature.offset + signature.bytes.length) {
    return false;
  }

  for (let i = 0; i < signature.bytes.length; i++) {
    if (buffer[signature.offset + i] !== signature.bytes[i]) {
      return false;
    }
  }

  // Check extra validation if provided
  if ('extraCheck' in signature && signature.extraCheck) {
    return signature.extraCheck(buffer);
  }

  return true;
}

/**
 * Detect file type from buffer using magic numbers
 */
export function detectFileType(buffer: ArrayBuffer | Uint8Array): SupportedFileType | null {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  // Check against all known signatures
  for (const [fileType, signature] of Object.entries(FILE_SIGNATURES)) {
    if (matchesSignature(bytes, signature)) {
      return fileType as SignatureFileType;
    }
  }

  return null;
}

function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

function isLikelyTextData(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let printable = 0;

  for (const byte of bytes) {
    const isWhitespace = byte === 9 || byte === 10 || byte === 13; // tab/newline/carriage return
    const isAsciiPrintable = byte >= 32 && byte <= 126;
    if (isWhitespace || isAsciiPrintable) {
      printable++;
    }
  }

  return printable / bytes.length > 0.9;
}

function looksLikeCsv(bytes: Uint8Array): boolean {
  if (!isLikelyTextData(bytes)) return false;
  const sample = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const lines = sample
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (lines.length === 0) return false;
  return lines.some((line) => line.includes(',') || line.includes(';') || line.includes('\t'));
}

function inferOfficeContainerType(
  detectedType: SupportedFileType | null,
  normalizedMimeType: string,
  extension: string
): SupportedFileType | null {
  if (detectedType !== 'ZIP') return detectedType;
  return OFFICE_MIME_TO_TYPE[normalizedMimeType] || OFFICE_EXTENSION_TO_TYPE[extension] || 'ZIP';
}

/**
 * Validate file type against allowed types using magic numbers
 */
export async function validateFileType(
  file: File,
  allowedTypes: SupportedFileType[]
): Promise<{ valid: boolean; detectedType: SupportedFileType | null; error?: string }> {
  try {
    const normalizedMimeType = normalizeMimeType(file.type || '');
    const extension = getFileExtension(file.name || '');

    // Read first 512 bytes to support text-based heuristics (CSV).
    const slice = file.slice(0, 512);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let detectedType = detectFileType(bytes);
    detectedType = inferOfficeContainerType(detectedType, normalizedMimeType, extension);

    // CSV has no reliable magic number. Use MIME/extension + text heuristic.
    if (!detectedType && (CSV_MIME_TYPES.has(normalizedMimeType) || extension === 'csv') && looksLikeCsv(bytes)) {
      detectedType = 'CSV' as SupportedFileType;
    }

    if (!detectedType) {
      return {
        valid: false,
        detectedType: null,
        error: 'Unknown or unsupported file type',
      };
    }

    if (!allowedTypes.includes(detectedType)) {
      return {
        valid: false,
        detectedType,
        error: `File type ${detectedType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }

    if (detectedType === 'CSV') {
      if (!(CSV_MIME_TYPES.has(normalizedMimeType) || extension === 'csv')) {
        return {
          valid: false,
          detectedType,
          error: `File MIME type (${file.type}) does not match detected file type (${detectedType})`,
        };
      }
    } else {
      // Also verify MIME type matches detected type (defense in depth).
      // For ZIP-based office files, allow extension fallback where browsers emit generic ZIP MIME.
      const signature = FILE_SIGNATURES[detectedType as SignatureFileType];
      const mimeMatches = (signature.mimeTypes as readonly string[]).includes(normalizedMimeType);
      const officeTypeFromExtension = OFFICE_EXTENSION_TO_TYPE[extension];
      const isOfficeFallback =
        (detectedType === 'DOCX' || detectedType === 'XLSX' || detectedType === 'PPTX') &&
        officeTypeFromExtension === detectedType;

      if (!mimeMatches && !isOfficeFallback) {
        return {
          valid: false,
          detectedType,
          error: `File MIME type (${file.type}) does not match detected file type (${detectedType})`,
        };
      }
    }

    return {
      valid: true,
      detectedType,
    };
  } catch (error) {
    return {
      valid: false,
      detectedType: null,
      error: 'Failed to validate file type',
    };
  }
}

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSizeBytes: number
): { valid: boolean; error?: string } {
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export async function validateFile(
  file: File,
  options: {
    allowedTypes: SupportedFileType[];
    maxSizeBytes: number;
  }
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Validate size
  const sizeValidation = validateFileSize(file, options.maxSizeBytes);
  if (!sizeValidation.valid && sizeValidation.error) {
    errors.push(sizeValidation.error);
  }

  // Validate type
  const typeValidation = await validateFileType(file, options.allowedTypes);
  if (!typeValidation.valid && typeValidation.error) {
    errors.push(typeValidation.error);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get MIME types for allowed file types
 */
export function getMimeTypes(fileTypes: SupportedFileType[]): string[] {
  const mimeTypes = new Set<string>();

  for (const fileType of fileTypes) {
    if (fileType === 'CSV') {
      CSV_MIME_TYPES.forEach((mime) => mimeTypes.add(mime));
      continue;
    }
    const signature = FILE_SIGNATURES[fileType];
    signature.mimeTypes.forEach(mime => mimeTypes.add(mime));
  }

  return Array.from(mimeTypes);
}
