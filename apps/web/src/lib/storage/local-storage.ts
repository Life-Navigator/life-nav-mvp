/**
 * Local Blob Storage Service
 * Stores files on the local DGX Spark filesystem for secure data vault
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Base storage path - configurable via environment
const STORAGE_BASE = process.env.BLOB_STORAGE_PATH ||
  path.join(process.cwd(), '..', '..', 'data', 'blob-storage');

export type StorageBucket = 'documents' | 'avatars' | 'exports' | 'temp';

export interface StoredFile {
  id: string;
  bucket: StorageBucket;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  createdAt: Date;
}

export interface UploadOptions {
  bucket: StorageBucket;
  filename?: string;
  userId?: string;
  encrypt?: boolean;
}

/**
 * Generate a unique file ID
 */
function generateFileId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Get the full path for a bucket
 */
function getBucketPath(bucket: StorageBucket): string {
  return path.join(STORAGE_BASE, bucket);
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Upload a file to local storage
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  options: UploadOptions
): Promise<StoredFile> {
  const { bucket, filename, userId } = options;

  const fileId = generateFileId();
  const ext = path.extname(originalName);
  const storedFilename = filename || `${fileId}${ext}`;

  // Create user-specific subdirectory if userId provided
  const subDir = userId ? path.join(bucket, userId) : bucket;
  const bucketPath = path.join(STORAGE_BASE, subDir);

  await ensureDirectory(bucketPath);

  const filePath = path.join(bucketPath, storedFilename);

  // Write file to disk
  await fs.writeFile(filePath, buffer);

  const stats = await fs.stat(filePath);

  return {
    id: fileId,
    bucket,
    filename: storedFilename,
    originalName,
    mimeType,
    size: stats.size,
    path: filePath,
    url: `/api/storage/${subDir}/${storedFilename}`,
    createdAt: new Date(),
  };
}

/**
 * Download a file from local storage
 */
export async function downloadFile(
  bucket: StorageBucket,
  filename: string,
  userId?: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const subDir = userId ? path.join(bucket, userId) : bucket;
  const filePath = path.join(STORAGE_BASE, subDir, filename);

  try {
    const buffer = await fs.readFile(filePath);
    const mimeType = getMimeType(filename);
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

/**
 * Delete a file from local storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  filename: string,
  userId?: string
): Promise<boolean> {
  const subDir = userId ? path.join(bucket, userId) : bucket;
  const filePath = path.join(STORAGE_BASE, subDir, filename);

  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in a bucket
 */
export async function listFiles(
  bucket: StorageBucket,
  userId?: string
): Promise<string[]> {
  const subDir = userId ? path.join(bucket, userId) : bucket;
  const bucketPath = path.join(STORAGE_BASE, subDir);

  try {
    const files = await fs.readdir(bucketPath);
    return files;
  } catch {
    return [];
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  bucket: StorageBucket,
  filename: string,
  userId?: string
): Promise<{ size: number; createdAt: Date; modifiedAt: Date } | null> {
  const subDir = userId ? path.join(bucket, userId) : bucket;
  const filePath = path.join(STORAGE_BASE, subDir, filename);

  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Clean up old temporary files (older than 24 hours)
 */
export async function cleanupTempFiles(): Promise<number> {
  const tempPath = getBucketPath('temp');
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let deletedCount = 0;

  try {
    const files = await fs.readdir(tempPath);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(tempPath, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
  } catch {
    // Temp directory may not exist yet
  }

  return deletedCount;
}
