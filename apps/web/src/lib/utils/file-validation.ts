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

export type SupportedFileType = keyof typeof FILE_SIGNATURES;

/**
 * Check if bytes match a signature
 */
function matchesSignature(buffer: Uint8Array, signature: typeof FILE_SIGNATURES[SupportedFileType]): boolean {
  if (buffer.length < signature.offset + signature.bytes.length) {
    return false;
  }

  for (let i = 0; i < signature.bytes.length; i++) {
    if (buffer[signature.offset + i] !== signature.bytes[i]) {
      return false;
    }
  }

  // Check extra validation if provided
  if (signature.extraCheck) {
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
      return fileType as SupportedFileType;
    }
  }

  return null;
}

/**
 * Validate file type against allowed types using magic numbers
 */
export async function validateFileType(
  file: File,
  allowedTypes: SupportedFileType[]
): Promise<{ valid: boolean; detectedType: SupportedFileType | null; error?: string }> {
  try {
    // Read first 32 bytes (enough for most signatures)
    const slice = file.slice(0, 32);
    const buffer = await slice.arrayBuffer();
    const detectedType = detectFileType(buffer);

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

    // Also verify MIME type matches detected type (defense in depth)
    const signature = FILE_SIGNATURES[detectedType];
    if (!signature.mimeTypes.includes(file.type)) {
      return {
        valid: false,
        detectedType,
        error: `File MIME type (${file.type}) does not match detected file type (${detectedType})`,
      };
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
    const signature = FILE_SIGNATURES[fileType];
    signature.mimeTypes.forEach(mime => mimeTypes.add(mime));
  }

  return Array.from(mimeTypes);
}
