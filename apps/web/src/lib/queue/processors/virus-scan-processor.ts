/**
 * Virus Scan Queue Processor
 *
 * Processes async virus scan jobs from the queue.
 * Handles scan results and triggers appropriate actions.
 */

import { Job } from 'bull';
import { virusScanQueue, VirusScanJobData } from '../queue-service';
import { scanFromUrl, scanBuffer, ScanResult } from '../../services/virus-scan';
import { db as prisma } from '../../db';

/**
 * Process virus scan job
 */
async function processVirusScan(job: Job<VirusScanJobData>): Promise<ScanResult> {
  const { fileId, fileUrl, userId, domain, originalFilename } = job.data;

  console.log(`[VirusScan] Processing job ${job.id} for file ${fileId}`);

  let result: ScanResult;

  if (job.data.buffer) {
    // Scan from buffer (for sync mode with small files)
    result = await scanBuffer(fileId, Buffer.from(job.data.buffer));
  } else {
    // Scan from URL (for async mode)
    result = await scanFromUrl(fileId, fileUrl);
  }

  // Save scan result to database
  await saveScanResult(fileId, userId, result);

  // Handle infected files
  if (result.status === 'infected') {
    await handleInfectedFile(fileId, userId, domain, originalFilename, result);
  }

  // Update document status
  await updateDocumentScanStatus(fileId, result);

  return result;
}

/**
 * Save scan result to database
 */
async function saveScanResult(
  fileId: string,
  userId: string,
  result: ScanResult
): Promise<void> {
  try {
    // Check if the model exists before using it
    const prismaAny = prisma as any;
    if (prismaAny.virusScanResult?.create) {
      await prismaAny.virusScanResult.create({
        data: {
          id: crypto.randomUUID(),
          fileId,
          userId,
          status: result.status,
          virusName: result.virusName,
          scanDurationMs: result.scanDurationMs,
          scannedAt: result.scannedAt,
          clamavVersion: result.clamavVersion,
          errorMessage: result.errorMessage,
        },
      });
    }
  } catch (error) {
    console.error('[VirusScan] Failed to save scan result:', error);
  }
}

/**
 * Handle infected file - quarantine and notify
 */
async function handleInfectedFile(
  fileId: string,
  userId: string,
  domain: string,
  originalFilename: string,
  result: ScanResult
): Promise<void> {
  console.warn(
    `[VirusScan] INFECTED FILE DETECTED: ${fileId}, virus: ${result.virusName}`
  );

  try {
    // Log to structured logging for SIEM
    console.error(
      JSON.stringify({
        severity: 'CRITICAL',
        category: 'security',
        event: 'malware_detected',
        fileId,
        userId,
        virusName: result.virusName,
        domain,
        originalFilename,
        scannedAt: result.scannedAt,
      })
    );

    // Send security webhook if configured
    const webhookUrl = process.env.SECURITY_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'malware_detected',
            fileId,
            userId,
            virusName: result.virusName,
            domain,
            originalFilename,
            scannedAt: result.scannedAt,
          }),
        });
      } catch (error) {
        console.error('[VirusScan] Failed to send security webhook:', error);
      }
    }
  } catch (error) {
    console.error('[VirusScan] Failed to handle infected file:', error);
    throw error;
  }
}

/**
 * Update document scan status in database
 */
async function updateDocumentScanStatus(
  fileId: string,
  result: ScanResult
): Promise<void> {
  try {
    const prismaAny = prisma as any;
    if (prismaAny.document?.updateMany) {
      await prismaAny.document.updateMany({
        where: { fileId },
        data: {
          virusScanStatus: result.status,
          virusScanAt: result.scannedAt,
          virusName: result.virusName,
          isQuarantined: result.status === 'infected',
        },
      });
    }
  } catch (error) {
    console.error('[VirusScan] Failed to update document status:', error);
  }
}

/**
 * Start the virus scan processor
 */
export function startVirusScanProcessor(concurrency: number = 3): void {
  virusScanQueue.process(concurrency, processVirusScan);

  console.log(`[VirusScan] Processor started with concurrency ${concurrency}`);
}

export { processVirusScan };
