/**
 * OCR Document Extractor
 *
 * Two-layer extraction:
 * 1. Text extraction (PDF text layer or OCR)
 * 2. Structured field extraction with redaction
 */

import { extractFieldsFromText, type ExtractedField } from './patterns';
import { detectSensitiveData } from '../validation';
import crypto from 'crypto';

export interface DocumentExtractionResult {
  success: boolean;
  error?: string;
  pages_total: number;
  pages_processed: number;
  extracted_fields: ExtractedField[];
  extraction_method: 'pdf_text' | 'ocr_image';
  duration_ms: number;
}

/**
 * Extract text from PDF using pdf-parse
 */
async function extractTextFromPDF(fileBuffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // Dynamic import to avoid bundling issues
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(fileBuffer);

    return {
      text: data.text,
      pages: data.numpages,
    };
  } catch (error) {
    console.error('[OCR] PDF text extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from image using Tesseract OCR
 */
async function extractTextFromImage(fileBuffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // Dynamic import to avoid bundling issues
    const Tesseract = await import('tesseract.js');

    const worker = await Tesseract.createWorker('eng');
    const { data } = await worker.recognize(fileBuffer);
    await worker.terminate();

    return {
      text: data.text,
      pages: 1,
    };
  } catch (error) {
    console.error('[OCR] Image OCR failed:', error);
    throw new Error('Failed to perform OCR on image');
  }
}

/**
 * Main extraction function
 */
export async function extractDocumentFields(
  fileBuffer: Buffer,
  mimeType: string
): Promise<DocumentExtractionResult> {
  const startTime = Date.now();

  try {
    let extractionResult: { text: string; pages: number };
    let extractionMethod: 'pdf_text' | 'ocr_image';

    // Layer 1: Text extraction
    if (mimeType === 'application/pdf') {
      extractionResult = await extractTextFromPDF(fileBuffer);
      extractionMethod = 'pdf_text';

      // If PDF has insufficient text, fall back to OCR (future enhancement)
      if (extractionResult.text.trim().length < 50) {
        console.log('[OCR] PDF has insufficient text, would fall back to OCR (not implemented yet)');
        // For MVP, we accept the text as-is
      }
    } else if (mimeType.startsWith('image/')) {
      extractionResult = await extractTextFromImage(fileBuffer);
      extractionMethod = 'ocr_image';
    } else {
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }

    // Layer 2: Structured field extraction
    const rawFields = extractFieldsFromText(extractionResult.text);

    // Layer 3: Redaction
    const redactedFields = rawFields.map(field => {
      // Check for sensitive data in source_text
      if (field.source_text) {
        const redactionResult = detectSensitiveData(field.source_text);

        if (redactionResult.hasSensitiveData) {
          // Replace source_text with redacted version
          return {
            ...field,
            source_text: redactionResult.redacted,
            // Store hash instead of full text for audit trail
            was_redacted: true,
            redaction_reason: redactionResult.redactions.map(r => r.type).join(', '),
          };
        }
      }

      // Check field value itself
      const valueRedaction = detectSensitiveData(field.field_value);
      if (valueRedaction.hasSensitiveData) {
        // If the value itself is sensitive, mark but don't store
        return {
          ...field,
          field_value: '[REDACTED]',
          was_redacted: true,
          redaction_reason: valueRedaction.redactions.map(r => r.type).join(', '),
          confidence_score: 0, // Mark as unusable
        };
      }

      return {
        ...field,
        was_redacted: false,
      };
    });

    // Filter out fully redacted fields (confidence = 0)
    const usableFields = redactedFields.filter(f => f.confidence_score > 0);

    const duration = Date.now() - startTime;

    return {
      success: true,
      pages_total: extractionResult.pages,
      pages_processed: extractionResult.pages,
      extracted_fields: usableFields,
      extraction_method: extractionMethod,
      duration_ms: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      pages_total: 0,
      pages_processed: 0,
      extracted_fields: [],
      extraction_method: 'pdf_text',
      duration_ms: duration,
    };
  }
}

/**
 * Generate snippet hash for audit trail (instead of storing full snippet)
 */
export function generateSnippetHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}
