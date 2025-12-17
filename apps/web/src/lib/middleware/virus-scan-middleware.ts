/**
 * Virus Scan Middleware
 *
 * Integrates virus scanning into the upload flow.
 * Supports both sync (blocking) and async (queue-based) modes.
 */

import { scanBuffer, isClamAVAvailable, ScanResult } from '../services/virus-scan';
import { addVirusScanJob } from '../queue/queue-service';
import { generateFileId } from '../services/storage';

export interface VirusScanConfig {
  mode: 'sync' | 'async' | 'hybrid';
  syncThresholdBytes: number;
  blockOnInfection: boolean;
  skipOnUnavailable: boolean;
}

const DEFAULT_CONFIG: VirusScanConfig = {
  mode: 'hybrid',
  syncThresholdBytes: 5 * 1024 * 1024, // 5MB
  blockOnInfection: true,
  skipOnUnavailable: true,
};

export interface ScanPreResult {
  proceed: boolean;
  scanResult?: ScanResult;
  asyncJobId?: string;
  error?: string;
  fileId: string;
}

/**
 * Scan file before storage
 * Call this after file validation but before storing
 */
export async function scanFileBeforeStorage(
  file: File,
  userId: string,
  domain: string,
  config: Partial<VirusScanConfig> = {}
): Promise<ScanPreResult> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const fileId = generateFileId(`${domain}/${userId}`);

  // Check if ClamAV is available
  const available = await isClamAVAvailable();
  if (!available) {
    if (opts.skipOnUnavailable) {
      console.warn('[VirusScan] ClamAV unavailable, skipping scan');
      return { proceed: true, fileId };
    }
    return {
      proceed: false,
      error: 'Virus scanning service unavailable',
      fileId,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Determine scan mode
  const useSync =
    opts.mode === 'sync' ||
    (opts.mode === 'hybrid' && buffer.length <= opts.syncThresholdBytes);

  if (useSync) {
    // Synchronous scan
    const result = await scanBuffer(fileId, buffer);

    if (result.status === 'infected') {
      if (opts.blockOnInfection) {
        return {
          proceed: false,
          scanResult: result,
          error: `File contains malware: ${result.virusName}`,
          fileId,
        };
      }
    }

    return { proceed: true, scanResult: result, fileId };
  } else {
    // Asynchronous scan - queue for later
    const job = await addVirusScanJob({
      fileId,
      fileUrl: '', // Will be set after upload
      userId,
      domain,
      originalFilename: file.name,
      scanMode: 'async',
      priority: 'normal',
    });

    return {
      proceed: true,
      asyncJobId: job.id?.toString(),
      fileId,
    };
  }
}

/**
 * Queue async scan after file is stored
 * Call this after file is uploaded to storage
 */
export async function queueAsyncScan(
  fileId: string,
  fileUrl: string,
  userId: string,
  domain: string,
  originalFilename: string,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<string> {
  const job = await addVirusScanJob({
    fileId,
    fileUrl,
    userId,
    domain,
    originalFilename,
    scanMode: 'async',
    priority,
  });

  return job.id?.toString() || '';
}

/**
 * Get scan configuration for a specific domain
 */
export function getDomainScanConfig(domain: string): Partial<VirusScanConfig> {
  const configs: Record<string, Partial<VirusScanConfig>> = {
    financial: {
      mode: 'sync',
      blockOnInfection: true,
      skipOnUnavailable: false,
    },
    health: {
      mode: 'hybrid',
      syncThresholdBytes: 10 * 1024 * 1024,
      blockOnInfection: true,
      skipOnUnavailable: false,
    },
    career: {
      mode: 'hybrid',
      blockOnInfection: true,
      skipOnUnavailable: true,
    },
    education: {
      mode: 'hybrid',
      blockOnInfection: true,
      skipOnUnavailable: true,
    },
  };

  return configs[domain] || DEFAULT_CONFIG;
}
