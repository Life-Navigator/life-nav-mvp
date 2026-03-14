/**
 * Cloud Storage Service
 *
 * Production-grade file storage abstraction supporting:
 * - Local filesystem (development)
 * - Google Cloud Storage (production)
 * - AWS S3 (alternative)
 *
 * Features:
 * - Signed URL generation for secure uploads/downloads
 * - Automatic content type detection
 * - File lifecycle management
 * - Virus scanning integration point
 */

import { Storage } from '@google-cloud/storage';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type StorageProvider = 'local' | 'gcs' | 's3';

export interface StorageConfig {
  provider: StorageProvider;
  bucket?: string;
  region?: string;
  projectId?: string;
  localPath?: string;
}

export interface UploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
  public?: boolean;
  maxAge?: number;
}

export interface StorageResult {
  success: boolean;
  fileId: string;
  fileUrl: string;
  provider: StorageProvider;
  size: number;
  error?: string;
}

/**
 * Get storage configuration from environment
 */
function getConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER || 'local') as StorageProvider;

  return {
    provider,
    bucket: process.env.STORAGE_BUCKET || process.env.GCS_BUCKET || process.env.S3_BUCKET,
    region: process.env.AWS_REGION || process.env.STORAGE_REGION || 'us-central1',
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    localPath: process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'public', 'uploads'),
  };
}

/**
 * Generate a unique file ID with optional prefix
 */
export function generateFileId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}/${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  const mapping: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/zip': 'zip',
    'text/csv': 'csv',
    'application/json': 'json',
  };
  return mapping[contentType] || 'bin';
}

/**
 * Local filesystem storage implementation
 */
class LocalStorage {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.baseUrl = '/uploads';
  }

  async upload(fileId: string, buffer: Buffer, options: UploadOptions): Promise<StorageResult> {
    try {
      const ext = getExtensionFromContentType(options.contentType);
      const filename = `${fileId}.${ext}`;
      const filepath = path.join(this.basePath, filename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(filepath, buffer);

      return {
        success: true,
        fileId,
        fileUrl: `${this.baseUrl}/${filename}`,
        provider: 'local',
        size: buffer.length,
      };
    } catch (error) {
      return {
        success: false,
        fileId,
        fileUrl: '',
        provider: 'local',
        size: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      const files = await this.findFiles(fileId);
      for (const file of files) {
        await unlink(file);
      }
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(fileId: string): Promise<string | null> {
    const files = await this.findFiles(fileId);
    if (files.length > 0) {
      const filename = path.basename(files[0]);
      return `${this.baseUrl}/${filename}`;
    }
    return null;
  }

  private async findFiles(fileId: string): Promise<string[]> {
    const { readdir } = await import('fs/promises');
    try {
      const files = await readdir(this.basePath);
      return files.filter((f) => f.startsWith(fileId)).map((f) => path.join(this.basePath, f));
    } catch {
      return [];
    }
  }
}

/**
 * Google Cloud Storage implementation
 */
class GCSStorage {
  private storage: Storage;
  private bucket: string;

  constructor(projectId: string | undefined, bucket: string) {
    this.storage = new Storage({ projectId });
    this.bucket = bucket;
  }

  async upload(fileId: string, buffer: Buffer, options: UploadOptions): Promise<StorageResult> {
    try {
      const ext = getExtensionFromContentType(options.contentType);
      const filename = `${fileId}.${ext}`;

      const bucket = this.storage.bucket(this.bucket);
      const file = bucket.file(filename);

      await file.save(buffer, {
        contentType: options.contentType,
        metadata: {
          ...options.metadata,
          cacheControl: `public, max-age=${options.maxAge || 3600}`,
        },
        public: options.public,
      });

      const publicUrl = options.public
        ? `https://storage.googleapis.com/${this.bucket}/${filename}`
        : await this.getSignedUrl(filename);

      return {
        success: true,
        fileId,
        fileUrl: publicUrl,
        provider: 'gcs',
        size: buffer.length,
      };
    } catch (error) {
      return {
        success: false,
        fileId,
        fileUrl: '',
        provider: 'gcs',
        size: 0,
        error: error instanceof Error ? error.message : 'GCS upload failed',
      };
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const [files] = await bucket.getFiles({ prefix: fileId });

      await Promise.all(files.map((file) => file.delete()));
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(fileId: string): Promise<string | null> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const [files] = await bucket.getFiles({ prefix: fileId });

      if (files.length > 0) {
        return this.getSignedUrl(files[0].name);
      }
      return null;
    } catch {
      return null;
    }
  }

  private async getSignedUrl(filename: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucket);
    const file = bucket.file(filename);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000, // 1 hour
    });

    return url;
  }
}

/**
 * AWS S3 storage implementation
 */
class S3Storage {
  private client: S3Client;
  private bucket: string;
  private region: string;

  constructor(region: string, bucket: string) {
    this.client = new S3Client({ region });
    this.bucket = bucket;
    this.region = region;
  }

  async upload(fileId: string, buffer: Buffer, options: UploadOptions): Promise<StorageResult> {
    try {
      const ext = getExtensionFromContentType(options.contentType);
      const key = `${fileId}.${ext}`;

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: options.contentType,
          Metadata: options.metadata,
          CacheControl: `public, max-age=${options.maxAge || 3600}`,
        })
      );

      const fileUrl = options.public
        ? `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
        : await this.getSignedUrl(key);

      return {
        success: true,
        fileId,
        fileUrl,
        provider: 's3',
        size: buffer.length,
      };
    } catch (error) {
      return {
        success: false,
        fileId,
        fileUrl: '',
        provider: 's3',
        size: 0,
        error: error instanceof Error ? error.message : 'S3 upload failed',
      };
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fileId,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(fileId: string): Promise<string | null> {
    try {
      return this.getSignedUrl(fileId);
    } catch {
      return null;
    }
  }

  private async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}

/**
 * Storage service factory
 */
export interface IStorageService {
  upload(fileId: string, buffer: Buffer, options: UploadOptions): Promise<StorageResult>;
  delete(fileId: string): Promise<boolean>;
  getUrl(fileId: string): Promise<string | null>;
}

let storageInstance: IStorageService | null = null;

/**
 * Get storage service singleton
 */
export function getStorageService(): IStorageService {
  if (storageInstance) {
    return storageInstance;
  }

  const config = getConfig();

  switch (config.provider) {
    case 'gcs':
      if (!config.bucket) {
        throw new Error('GCS_BUCKET environment variable is required for GCS storage');
      }
      storageInstance = new GCSStorage(config.projectId, config.bucket);
      break;

    case 's3':
      if (!config.bucket) {
        throw new Error('S3_BUCKET environment variable is required for S3 storage');
      }
      storageInstance = new S3Storage(config.region!, config.bucket);
      break;

    case 'local':
    default:
      storageInstance = new LocalStorage(config.localPath!);
      break;
  }

  return storageInstance;
}

/**
 * High-level upload function for API routes
 */
export async function uploadFile(
  file: File,
  domain: string,
  userId: string,
  additionalMetadata?: Record<string, string>
): Promise<StorageResult> {
  const storage = getStorageService();
  const fileId = generateFileId(`${domain}/${userId}`);

  const buffer = Buffer.from(await file.arrayBuffer());

  return storage.upload(fileId, buffer, {
    contentType: file.type,
    metadata: {
      originalName: file.name,
      userId,
      domain,
      uploadedAt: new Date().toISOString(),
      ...additionalMetadata,
    },
  });
}

/**
 * Delete file by ID
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  const storage = getStorageService();
  return storage.delete(fileId);
}

/**
 * Get file URL by ID
 */
export async function getFileUrl(fileId: string): Promise<string | null> {
  const storage = getStorageService();
  return storage.getUrl(fileId);
}

//=====================
// QUARANTINE FUNCTIONS
//=====================

const QUARANTINE_BUCKET =
  process.env.QUARANTINE_BUCKET || process.env.STORAGE_BUCKET + '-quarantine';

/**
 * Move file to quarantine storage
 * Used when virus is detected in a file
 */
export async function quarantineFile(
  fileId: string,
  originalPath: string,
  virusName: string,
  metadata?: Record<string, string>
): Promise<{ success: boolean; quarantinePath: string; error?: string }> {
  const config = getConfig();

  if (config.provider === 'local') {
    // For local storage, move to quarantine directory
    const quarantinePath = path.join(config.localPath!, 'quarantine', fileId);
    try {
      const quarantineDir = path.dirname(quarantinePath);
      if (!existsSync(quarantineDir)) {
        await mkdir(quarantineDir, { recursive: true });
      }

      // Read original file
      const originalFilePath = path.join(config.localPath!, originalPath);
      const buffer = await readFile(originalFilePath);

      // Write to quarantine
      await writeFile(quarantinePath, buffer);

      // Delete original
      await unlink(originalFilePath);

      return { success: true, quarantinePath: `/quarantine/${fileId}` };
    } catch (error) {
      return {
        success: false,
        quarantinePath: '',
        error: error instanceof Error ? error.message : 'Quarantine failed',
      };
    }
  }

  if (config.provider === 'gcs') {
    try {
      const storage = new Storage({ projectId: config.projectId });
      const sourceBucket = storage.bucket(config.bucket!);
      const quarantineBucket = storage.bucket(QUARANTINE_BUCKET);

      // Copy to quarantine with metadata
      const [files] = await sourceBucket.getFiles({ prefix: fileId });
      if (files.length === 0) {
        return { success: false, quarantinePath: '', error: 'File not found' };
      }

      const sourceFile = files[0];
      const quarantinePath = `quarantine/${fileId}`;

      const destinationFile = quarantineBucket.file(quarantinePath);
      await sourceFile.copy(destinationFile);
      await destinationFile.setMetadata({
        metadata: {
          virusName,
          quarantinedAt: new Date().toISOString(),
          originalPath,
          ...metadata,
        },
      });

      // Delete original
      await sourceFile.delete();

      return { success: true, quarantinePath: `gs://${QUARANTINE_BUCKET}/${quarantinePath}` };
    } catch (error) {
      return {
        success: false,
        quarantinePath: '',
        error: error instanceof Error ? error.message : 'GCS quarantine failed',
      };
    }
  }

  if (config.provider === 's3') {
    // S3 quarantine implementation
    try {
      const { CopyObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: config.region });

      const quarantinePath = `quarantine/${fileId}`;

      // Copy to quarantine bucket
      await client.send(
        new CopyObjectCommand({
          Bucket: QUARANTINE_BUCKET,
          Key: quarantinePath,
          CopySource: `${config.bucket}/${fileId}`,
          Metadata: {
            virusName,
            quarantinedAt: new Date().toISOString(),
            originalPath,
            ...metadata,
          },
          MetadataDirective: 'REPLACE',
        })
      );

      // Delete original
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket!,
          Key: fileId,
        })
      );

      return { success: true, quarantinePath: `s3://${QUARANTINE_BUCKET}/${quarantinePath}` };
    } catch (error) {
      return {
        success: false,
        quarantinePath: '',
        error: error instanceof Error ? error.message : 'S3 quarantine failed',
      };
    }
  }

  return { success: false, quarantinePath: '', error: 'Unknown storage provider' };
}

/**
 * Permanently delete a quarantined file
 */
export async function deleteQuarantinedFile(quarantinePath: string): Promise<boolean> {
  const config = getConfig();

  if (config.provider === 'local') {
    try {
      const fullPath = path.join(config.localPath!, quarantinePath);
      await unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  if (config.provider === 'gcs') {
    try {
      const storage = new Storage({ projectId: config.projectId });
      const quarantineBucket = storage.bucket(QUARANTINE_BUCKET);
      const file = quarantineBucket.file(quarantinePath.replace(`gs://${QUARANTINE_BUCKET}/`, ''));
      await file.delete();
      return true;
    } catch {
      return false;
    }
  }

  if (config.provider === 's3') {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: config.region });
      await client.send(
        new DeleteObjectCommand({
          Bucket: QUARANTINE_BUCKET,
          Key: quarantinePath.replace(`s3://${QUARANTINE_BUCKET}/`, ''),
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Restore a quarantined file (admin function)
 * Only use after manual review confirms false positive
 */
export async function restoreQuarantinedFile(
  quarantinePath: string,
  originalPath: string
): Promise<{ success: boolean; restoredPath: string; error?: string }> {
  const config = getConfig();

  if (config.provider === 'gcs') {
    try {
      const storage = new Storage({ projectId: config.projectId });
      const quarantineBucket = storage.bucket(QUARANTINE_BUCKET);
      const mainBucket = storage.bucket(config.bucket!);

      const quarantineFile = quarantineBucket.file(
        quarantinePath.replace(`gs://${QUARANTINE_BUCKET}/`, '')
      );

      // Copy back to main bucket
      await quarantineFile.copy(mainBucket.file(originalPath));

      // Delete from quarantine
      await quarantineFile.delete();

      return {
        success: true,
        restoredPath: `gs://${config.bucket}/${originalPath}`,
      };
    } catch (error) {
      return {
        success: false,
        restoredPath: '',
        error: error instanceof Error ? error.message : 'Restore failed',
      };
    }
  }

  // Add S3 and local implementations as needed
  return { success: false, restoredPath: '', error: 'Provider not supported for restore' };
}

/**
 * Check if a file is an image based on content type
 */
export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/**
 * Get storage path for a file (GCS/S3 path without signed params)
 */
export function getStoragePath(fileId: string): string {
  const config = getConfig();

  if (config.provider === 'gcs') {
    return `gs://${config.bucket}/${fileId}`;
  } else if (config.provider === 's3') {
    return `s3://${config.bucket}/${fileId}`;
  }

  return fileId;
}
