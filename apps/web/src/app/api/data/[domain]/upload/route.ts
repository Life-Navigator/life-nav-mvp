import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { uploadFile, generateFileId } from '@/lib/services/storage';
import { validateFile, type SupportedFileType } from '@/lib/utils/file-validation';
import { db as prisma } from '@/lib/db';
import {
  scanFileBeforeStorage,
  queueAsyncScan,
  getDomainScanConfig,
} from '@/lib/middleware/virus-scan-middleware';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 120 seconds for OCR processing

/**
 * Domain-specific upload configurations with OCR document type mapping
 */
const DOMAIN_CONFIGS: Record<string, {
  allowedTypes: SupportedFileType[];
  maxSizeBytes: number;
  tableName?: string;
  ocrDocumentTypes: string[];
  enableOcr: boolean;
}> = {
  financial: {
    allowedTypes: ['PDF', 'XLSX', 'ZIP'],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    tableName: 'FinancialDocument',
    ocrDocumentTypes: ['bank_statement', 'receipt', 'invoice', 'tax_form'],
    enableOcr: true,
  },
  health: {
    allowedTypes: ['PDF', 'PNG', 'JPEG'],
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    tableName: 'HealthDocument',
    ocrDocumentTypes: ['lab_result', 'prescription', 'insurance_card', 'medical_record'],
    enableOcr: true,
  },
  career: {
    allowedTypes: ['PDF', 'DOCX'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    tableName: 'CareerDocument',
    ocrDocumentTypes: ['resume', 'certificate'],
    enableOcr: true,
  },
  education: {
    allowedTypes: ['PDF', 'PNG', 'JPEG'],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    tableName: 'EducationDocument',
    ocrDocumentTypes: ['transcript', 'diploma', 'certificate'],
    enableOcr: true,
  },
};

/**
 * Detect document type from filename and domain
 */
function detectDocumentType(filename: string, domain: string, allowedTypes: string[]): string {
  const lowerFilename = filename.toLowerCase();

  // Domain-specific detection
  if (domain === 'financial') {
    if (lowerFilename.includes('statement')) return 'bank_statement';
    if (lowerFilename.includes('receipt')) return 'receipt';
    if (lowerFilename.includes('invoice')) return 'invoice';
    if (lowerFilename.includes('tax') || lowerFilename.includes('w2') || lowerFilename.includes('1099')) return 'tax_form';
  } else if (domain === 'health') {
    if (lowerFilename.includes('lab') || lowerFilename.includes('result')) return 'lab_result';
    if (lowerFilename.includes('prescription') || lowerFilename.includes('rx')) return 'prescription';
    if (lowerFilename.includes('insurance')) return 'insurance_card';
  } else if (domain === 'career') {
    if (lowerFilename.includes('resume') || lowerFilename.includes('cv')) return 'resume';
    if (lowerFilename.includes('cert')) return 'certificate';
  } else if (domain === 'education') {
    if (lowerFilename.includes('transcript')) return 'transcript';
    if (lowerFilename.includes('diploma')) return 'diploma';
    if (lowerFilename.includes('cert')) return 'certificate';
  }

  return allowedTypes[0] || 'generic';
}

/**
 * Check if file type should be processed with OCR
 */
function shouldProcessWithOcr(mimeType: string): boolean {
  const ocrMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/webp',
  ];
  return ocrMimeTypes.includes(mimeType);
}

/**
 * Get auth token from request
 */
async function getAuthToken(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Try to get from cookies
  const token = request.cookies.get('token')?.value;
  return token || '';
}

/**
 * Save extracted data to database based on domain
 */
async function saveExtractedData(
  domain: string,
  userId: string,
  extractedData: any
): Promise<void> {
  try {
    if (domain === 'financial' && extractedData.transactions?.length > 0) {
      // Save transactions to database
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      await fetch(`${backendUrl}/api/v1/finance/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          transactions: extractedData.transactions.map((tx: any) => ({
            transaction_date: tx.date,
            description: tx.description,
            amount: tx.amount,
            transaction_type: tx.transaction_type,
            category: 'Uncategorized', // Will be categorized by ML
            is_manual: false,
            metadata_: { source: 'ocr', confidence: tx.confidence },
          })),
        }),
      });
    }

    if (domain === 'health' && extractedData.healthData?.length > 0) {
      // Save health data to database
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      await fetch(`${backendUrl}/api/v1/health/lab-results/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          labResults: extractedData.healthData.map((data: any) => ({
            test_name: data.test_name,
            result_value: data.result_value,
            result_unit: data.result_unit,
            reference_range: data.reference_range,
            test_date: data.date,
            provider: data.provider,
            metadata_: { source: 'ocr', confidence: data.confidence },
          })),
        }),
      });
    }
  } catch (error) {
    console.error('Failed to save extracted data:', error);
  }
}

/**
 * Sanitize error messages to prevent information leakage
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Only return safe error messages
    const safeMessages = [
      'File too large',
      'Invalid file type',
      'Upload failed',
      'Validation failed',
    ];

    for (const msg of safeMessages) {
      if (error.message.toLowerCase().includes(msg.toLowerCase())) {
        return error.message;
      }
    }
  }

  // Generic error for anything else
  return 'An error occurred during upload';
}

/**
 * POST /api/data/[domain]/upload
 * Upload domain-specific data file
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const startTime = Date.now();
  const { domain } = await params;

  try {
    // Validate domain
    const domainConfig = DOMAIN_CONFIGS[domain];
    if (!domainConfig) {
      return NextResponse.json(
        { success: false, error: 'Invalid domain' },
        { status: 400 }
      );
    }

    // Authenticate user
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = await validateFile(file, {
      allowedTypes: domainConfig.allowedTypes,
      maxSizeBytes: domainConfig.maxSizeBytes,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Virus scan before storage (sync mode for small files)
    const scanConfig = getDomainScanConfig(domain);
    let virusScanResult: {
      proceed: boolean;
      scanResult?: any;
      asyncJobId?: string;
      error?: string;
      fileId: string;
    } | null = null;

    try {
      virusScanResult = await scanFileBeforeStorage(file, userId, domain, scanConfig);

      if (!virusScanResult.proceed) {
        console.warn(
          `[Upload] Virus scan blocked upload for user=${userId}, domain=${domain}: ${virusScanResult.error}`
        );
        return NextResponse.json(
          {
            success: false,
            error: virusScanResult.error || 'File blocked by security scan',
            virusScanStatus: virusScanResult.scanResult?.status,
            virusName: virusScanResult.scanResult?.virusName,
          },
          { status: 400 }
        );
      }
    } catch (scanError) {
      // Log but continue - don't block uploads if scanning service is unavailable
      console.error('[Upload] Virus scan error:', scanError);
    }

    // Upload to storage
    const result = await uploadFile(file, domain, userId, {
      originalFilename: file.name,
      domain,
    });

    if (!result.success) {
      console.error(`Upload failed for domain=${domain}, user=${userId}:`, result.error);
      return NextResponse.json(
        { success: false, error: 'Upload failed' },
        { status: 500 }
      );
    }

    // Queue async virus scan for large files that weren't scanned synchronously
    let asyncScanJobId: string | undefined;
    if (virusScanResult?.asyncJobId) {
      // File was not scanned sync - queue async scan with the uploaded file URL
      try {
        asyncScanJobId = await queueAsyncScan(
          result.fileId,
          result.fileUrl,
          userId,
          domain,
          file.name,
          'normal'
        );
      } catch (asyncScanError) {
        console.error('[Upload] Failed to queue async virus scan:', asyncScanError);
      }
    }

    // Get document type from form data or detect from filename
    const documentType = formData.get('documentType') as string ||
      detectDocumentType(file.name, domain, domainConfig.ocrDocumentTypes);

    // Process with OCR if enabled and applicable
    let ocrResult: any = null;
    let extractedData: any = null;

    if (domainConfig.enableOcr && shouldProcessWithOcr(file.type)) {
      try {
        // Call backend OCR service
        const ocrResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:8000'}/api/v1/ocr/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken(request)}`,
          },
          body: JSON.stringify({
            fileUrl: result.fileUrl,
            fileId: result.fileId,
            documentType,
            domain,
          }),
        });

        if (ocrResponse.ok) {
          ocrResult = await ocrResponse.json();
          extractedData = ocrResult.extractedData;

          // If OCR extracted transactions or health data, save to database
          if (extractedData) {
            await saveExtractedData(domain, userId, extractedData);
          }
        }
      } catch (ocrError) {
        // Log but don't fail - file is already uploaded
        console.warn('OCR processing failed:', ocrError);
      }
    }

    // Determine virus scan status for database record
    const virusScanStatus = virusScanResult?.scanResult?.status ||
      (asyncScanJobId ? 'pending' : 'skipped');

    // Record upload in database (if table exists)
    let documentId: string | undefined;
    try {
      // Generic document record - adapt based on your schema
      const document = await (prisma as any).document?.create?.({
        data: {
          id: generateFileId(),
          userId,
          domain,
          filename: file.name,
          fileId: result.fileId,
          fileUrl: result.fileUrl,
          fileSize: result.size,
          mimeType: file.type,
          provider: result.provider,
          documentType,
          ocrProcessed: ocrResult?.success ?? false,
          ocrConfidence: ocrResult?.confidence,
          extractedText: ocrResult?.rawText?.substring(0, 10000), // Limit stored text
          virusScanStatus,
          virusScanAt: virusScanResult?.scanResult?.scannedAt,
          status: 'uploaded',
          createdAt: new Date(),
        },
      });
      documentId = document?.id;
    } catch (dbError) {
      // Log but don't fail - file is already uploaded
      console.warn('Failed to record document in database:', dbError);
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      fileUrl: result.fileUrl,
      documentId,
      size: result.size,
      provider: result.provider,
      documentType,
      ocrProcessed: ocrResult?.success ?? false,
      extractedData: extractedData ? {
        entityCount: extractedData.entities?.length ?? 0,
        transactionCount: extractedData.transactions?.length ?? 0,
        healthDataCount: extractedData.healthData?.length ?? 0,
      } : null,
      virusScan: {
        status: virusScanStatus,
        scannedAt: virusScanResult?.scanResult?.scannedAt,
        asyncJobId: asyncScanJobId,
      },
      processingTime,
      message: ocrResult?.success
        ? 'File uploaded and processed successfully'
        : asyncScanJobId
          ? 'File uploaded successfully, virus scan pending'
          : 'File uploaded successfully',
    });
  } catch (error) {
    console.error(`Upload error for domain=${domain}:`, error);

    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data/[domain]/upload
 * Delete an uploaded file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;

  try {
    // Validate domain
    if (!DOMAIN_CONFIGS[domain]) {
      return NextResponse.json(
        { success: false, error: 'Invalid domain' },
        { status: 400 }
      );
    }

    // Authenticate user
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get file ID from request body
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID required' },
        { status: 400 }
      );
    }

    // Verify ownership before deletion
    try {
      const document = await (prisma as any).document?.findFirst?.({
        where: {
          fileId,
          userId,
          domain,
        },
      });

      if (!document) {
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        );
      }

      // Delete from database
      await (prisma as any).document?.delete?.({
        where: { id: document.id },
      });
    } catch (dbError) {
      console.warn('Database operation failed:', dbError);
      // Continue with storage deletion if DB fails
    }

    // Delete from storage
    const { deleteFile } = await import('@/lib/services/storage');
    const deleted = await deleteFile(fileId);

    if (!deleted) {
      console.warn(`Failed to delete file from storage: ${fileId}`);
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error(`Delete error for domain=${domain}:`, error);

    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
