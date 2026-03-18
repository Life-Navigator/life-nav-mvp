import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentSource = 'scenario_lab' | 'ingestion';

type DocumentType =
  | 'bank_statement'
  | 'pay_stub'
  | 'tuition_bill'
  | 'loan_statement'
  | 'insurance'
  | 'medical_bill'
  | 'lease'
  | 'other';

type FieldType = 'number' | 'currency' | 'date' | 'text' | 'boolean';

type ExtractionMethod = 'gemini_vision' | 'document_ai';

interface OcrRequest {
  document_id: string;
  document_source: DocumentSource;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  document_type?: DocumentType;
  user_id: string;
}

interface ExtractedField {
  field_key: string;
  field_value: string;
  field_type: FieldType;
  confidence_score: number;
  source_page: number | null;
  source_text: string | null;
  was_redacted: boolean;
  redaction_reason: string | null;
}

interface OcrResponse {
  success: boolean;
  error?: string;
  pages_total: number;
  pages_processed: number;
  extraction_method: ExtractionMethod;
  extracted_fields: ExtractedField[];
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB limit for Gemini

// ---------------------------------------------------------------------------
// Sensitive data patterns (ported from validation.ts for Deno)
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  replacement: string;
}> = [
  {
    name: 'SSN',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: 'XXX-XX-XXXX',
  },
  {
    name: 'CREDIT_CARD',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: 'XXXX-XXXX-XXXX-XXXX',
  },
];

// ---------------------------------------------------------------------------
// Document-type-specific prompts
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_PROMPTS: Record<string, string> = {
  bank_statement: `Extract ALL structured fields from this bank statement:
- Account holder name, account number (last 4 digits only), account type
- Statement period (start date, end date)
- Beginning balance, ending balance
- Total deposits, total withdrawals
- Individual transactions: date, description, amount, running balance
- Bank name, branch, routing number (last 4 digits only)
Return each field as a separate entry.`,

  pay_stub: `Extract ALL structured fields from this pay stub:
- Employee name, employee ID
- Employer name, employer address
- Pay period (start, end), pay date
- Gross pay, net pay
- Individual deductions: federal tax, state tax, social security, medicare, health insurance, 401k, etc.
- YTD totals for each category
- Hours worked (regular, overtime)
Return each field as a separate entry.`,

  tuition_bill: `Extract ALL structured fields from this tuition bill:
- Student name, student ID
- Institution name
- Term/semester
- Tuition amount, fees (itemized)
- Scholarships, grants, financial aid applied
- Total charges, total credits, amount due
- Due date, payment instructions
Return each field as a separate entry.`,

  loan_statement: `Extract ALL structured fields from this loan statement:
- Borrower name
- Loan number (last 4 digits only), loan type
- Original principal, current principal balance
- Interest rate (APR)
- Monthly payment amount
- Payment due date, maturity date
- Escrow balance (if applicable)
- Lender name
Return each field as a separate entry.`,

  insurance: `Extract ALL structured fields from this insurance document:
- Policy holder name
- Policy number (last 4 digits only), group number
- Insurance company, plan name
- Premium amount, payment frequency
- Deductible (individual, family)
- Copay amounts (office visit, specialist, ER)
- Out-of-pocket maximum
- Coverage effective date, expiration date
Return each field as a separate entry.`,

  medical_bill: `Extract ALL structured fields from this medical bill:
- Patient name
- Provider name, provider address
- Date of service
- Itemized charges: procedure/service description, CPT code (if visible), charge amount
- Insurance adjustment, insurance payment
- Patient responsibility, amount due
- Account number (last 4 digits only)
Return each field as a separate entry.`,

  lease: `Extract ALL structured fields from this lease agreement:
- Tenant name(s), landlord name
- Property address
- Monthly rent amount, security deposit
- Lease term (start date, end date)
- Late fee amount, grace period
- Pet deposit/fee (if applicable)
- Utilities included/excluded
Return each field as a separate entry.`,

  other: `Extract ALL identifiable structured data from this document:
- Names, dates, addresses
- Monetary amounts with descriptions
- Account/reference numbers (last 4 digits only for sensitive numbers)
- Key terms, conditions, or deadlines
- Any tabular data (column headers and values)
Return each field as a separate entry.`,
};

// ---------------------------------------------------------------------------
// Gemini JSON Schema for structured extraction
// ---------------------------------------------------------------------------

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field_key: {
            type: 'string',
            description:
              'Snake_case key identifying the field, e.g. "gross_pay", "beginning_balance"',
          },
          field_value: {
            type: 'string',
            description: 'The extracted value as a string',
          },
          field_type: {
            type: 'string',
            enum: ['number', 'currency', 'date', 'text', 'boolean'],
            description: 'The semantic type of the field value',
          },
          confidence: {
            type: 'number',
            description: 'Confidence score between 0.0 and 1.0',
          },
          source_page: {
            type: 'integer',
            description: 'Page number where the field was found (1-based), or null',
          },
          source_text: {
            type: 'string',
            description:
              'Brief surrounding text context (max 100 chars), redacting any SSN or credit card numbers',
          },
        },
        required: [
          'field_key',
          'field_value',
          'field_type',
          'confidence',
        ],
      },
    },
  },
  required: ['fields'],
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function safeError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value);
  return raw.length > 2000 ? raw.slice(0, 2000) : raw;
}

/**
 * Redact sensitive data from extracted field values and source text.
 * Defense-in-depth: catches anything Gemini's prompt instructions missed.
 */
function redactSensitiveData(fields: ExtractedField[]): ExtractedField[] {
  return fields.map((field) => {
    let fieldValue = field.field_value;
    let sourceText = field.source_text;
    let wasRedacted = false;
    const redactionReasons: string[] = [];

    for (const { name, pattern, replacement } of SENSITIVE_PATTERNS) {
      // Reset regex state (global flag)
      pattern.lastIndex = 0;
      if (pattern.test(fieldValue)) {
        pattern.lastIndex = 0;
        fieldValue = fieldValue.replace(pattern, replacement);
        wasRedacted = true;
        redactionReasons.push(name);
      }

      if (sourceText) {
        pattern.lastIndex = 0;
        if (pattern.test(sourceText)) {
          pattern.lastIndex = 0;
          sourceText = sourceText.replace(pattern, replacement);
          wasRedacted = true;
          if (!redactionReasons.includes(name)) {
            redactionReasons.push(name);
          }
        }
      }
    }

    return {
      ...field,
      field_value: fieldValue,
      source_text: sourceText,
      was_redacted: wasRedacted || field.was_redacted,
      redaction_reason: redactionReasons.length > 0
        ? redactionReasons.join(', ')
        : field.redaction_reason,
    };
  });
}

/**
 * Convert Uint8Array to base64 string (Deno-compatible).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Gemini Vision extraction
// ---------------------------------------------------------------------------

async function extractWithGeminiVision(
  fileBase64: string,
  mimeType: string,
  documentType: DocumentType,
  geminiKey: string,
): Promise<{ fields: ExtractedField[]; pagesProcessed: number }> {
  const typePrompt = DOCUMENT_TYPE_PROMPTS[documentType] || DOCUMENT_TYPE_PROMPTS.other;

  const systemPrompt = `You are a document data extraction engine. Your job is to extract structured fields from uploaded documents with high accuracy.

CRITICAL RULES:
1. Extract EVERY identifiable field — do not skip data.
2. For monetary values, include the currency symbol (e.g. "$1,234.56").
3. Use snake_case for field_key names (e.g. "gross_pay", "total_due").
4. NEVER output full SSNs, credit card numbers, or full account numbers. Redact to last 4 digits.
5. Set confidence between 0.0 and 1.0 — use 0.9+ for clearly printed text, lower for handwriting or blurry regions.
6. For source_text, include a short snippet (max 100 chars) of the surrounding text for traceability. Redact any sensitive numbers in the snippet.
7. If a field appears on multiple pages, extract each occurrence separately with the correct source_page.`;

  const response = await fetch(`${GEMINI_GENERATE_URL}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: { mime_type: mimeType, data: fileBase64 },
            },
            { text: typePrompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Gemini API error (${response.status}): ${errorBody.slice(0, 500)}`,
    );
  }

  const result = await response.json();
  const candidates = result.candidates;

  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini returned no candidates');
  }

  const content = candidates[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error('Gemini returned empty content');
  }

  let parsed: { fields: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse Gemini JSON response: ${content.slice(0, 200)}`);
  }

  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    throw new Error('Gemini response missing "fields" array');
  }

  // Determine max page from results
  let maxPage = 1;

  const extractedFields: ExtractedField[] = parsed.fields.map((f) => {
    const sourcePage = typeof f.source_page === 'number' ? f.source_page : null;
    if (sourcePage && sourcePage > maxPage) {
      maxPage = sourcePage;
    }

    return {
      field_key: String(f.field_key || 'unknown'),
      field_value: String(f.field_value || ''),
      field_type: (['number', 'currency', 'date', 'text', 'boolean'].includes(
        String(f.field_type),
      )
        ? String(f.field_type)
        : 'text') as FieldType,
      confidence_score: typeof f.confidence === 'number'
        ? Math.max(0, Math.min(1, f.confidence))
        : 0.5,
      source_page: sourcePage,
      source_text: typeof f.source_text === 'string'
        ? f.source_text.slice(0, 100)
        : null,
      was_redacted: false,
      redaction_reason: null,
    };
  });

  return { fields: extractedFields, pagesProcessed: maxPage };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      },
    );
  }

  const startMs = Date.now();

  try {
    // -----------------------------------------------------------------------
    // Auth: dual-auth (worker-secret OR JWT)
    // -----------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let authedUserId: string | null = null;

    const workerSecret = Deno.env.get('OCR_WORKER_SECRET');
    const providedSecret = req.headers.get('x-worker-secret');
    if (
      workerSecret &&
      providedSecret &&
      constantTimeEqual(providedSecret, workerSecret)
    ) {
      // Trusted service-to-service call — user_id comes from body
    } else {
      // JWT auth
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          },
        );
      }
      const token = authHeader.slice(7);
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          },
        );
      }
      authedUserId = user.id;
    }

    // -----------------------------------------------------------------------
    // Parse request
    // -----------------------------------------------------------------------
    const body: OcrRequest = await req.json();
    const {
      document_id,
      document_source,
      storage_bucket,
      storage_path,
      mime_type,
      document_type,
      user_id,
    } = body;

    if (!document_id || !storage_bucket || !storage_path || !mime_type || !user_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: document_id, storage_bucket, storage_path, mime_type, user_id',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // If JWT-authed, verify user_id matches
    if (authedUserId && authedUserId !== user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        },
      );
    }

    // -----------------------------------------------------------------------
    // Check Gemini API key
    // -----------------------------------------------------------------------
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable');
    }

    // -----------------------------------------------------------------------
    // Download file from Supabase Storage
    // -----------------------------------------------------------------------
    const { data: blob, error: downloadError } = await supabase.storage
      .from(storage_bucket)
      .download(storage_path);

    if (downloadError || !blob) {
      throw new Error(
        `Failed to download file ${storage_path}: ${downloadError?.message}`,
      );
    }

    const fileBytes = new Uint8Array(await blob.arrayBuffer());
    if (fileBytes.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    const fileBase64 = uint8ArrayToBase64(fileBytes);

    // -----------------------------------------------------------------------
    // Extract with Gemini Vision
    // -----------------------------------------------------------------------
    const effectiveDocType: DocumentType = document_type || 'other';

    const { fields, pagesProcessed } = await extractWithGeminiVision(
      fileBase64,
      mime_type,
      effectiveDocType,
      geminiKey,
    );

    // -----------------------------------------------------------------------
    // Defense-in-depth: redact sensitive data from results
    // -----------------------------------------------------------------------
    const redactedFields = redactSensitiveData(fields);

    // Filter out fully redacted fields (field_value is entirely '[REDACTED]')
    const usableFields = redactedFields.filter(
      (f) => f.field_value !== '[REDACTED]',
    );

    // -----------------------------------------------------------------------
    // Update document OCR metadata
    // -----------------------------------------------------------------------
    const ocrMetadata = {
      extraction_method: 'gemini_vision',
      pages_processed: pagesProcessed,
      fields_count: usableFields.length,
      redacted_count: redactedFields.filter((f) => f.was_redacted).length,
      extracted_at: new Date().toISOString(),
    };

    if (document_source === 'scenario_lab') {
      await supabase
        .from('scenario_documents')
        .update({
          detected_document_type: effectiveDocType,
          ocr_metadata: ocrMetadata,
        })
        .eq('id', document_id);
    } else {
      await supabase
        .schema('core')
        .from('upload_documents')
        .update({
          detected_document_type: effectiveDocType,
          ocr_metadata: ocrMetadata,
        })
        .eq('id', document_id);
    }

    // -----------------------------------------------------------------------
    // Return response
    // -----------------------------------------------------------------------
    const response: OcrResponse = {
      success: true,
      pages_total: pagesProcessed,
      pages_processed: pagesProcessed,
      extraction_method: 'gemini_vision',
      extracted_fields: usableFields,
      duration_ms: Date.now() - startMs,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = safeError(error);
    console.error('[document-ocr] Error:', message);

    const response: OcrResponse = {
      success: false,
      error: message,
      pages_total: 0,
      pages_processed: 0,
      extraction_method: 'gemini_vision',
      extracted_fields: [],
      duration_ms: Date.now() - startMs,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
