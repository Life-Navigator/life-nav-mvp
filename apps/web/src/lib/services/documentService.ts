import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { db as prisma } from '@/lib/db';
import { UserType } from '@/types/auth';

// Types
export type DocumentCategory = 'insurance' | 'medical' | 'identification' | 'financial' | 'legal';

export interface DocumentUploadParams {
  file: Buffer;
  fileName: string;
  fileType: string;
  mimeType: string;
  category: DocumentCategory;
  tags?: string[];
  healthRecordId: string;
  userId: string;
}

export interface DocumentDownloadResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

// S3 Client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// Encryption constants
const ALGORITHM = 'aes-256-gcm'; // GCM mode provides authentication
const ENCRYPTION_KEY = process.env.DOCUMENT_ENCRYPTION_KEY || 'replace-with-a-secure-key-minimum-32-chars';

// Ensure encryption key is appropriate length (32 bytes for AES-256)
const getEncryptionKey = () => {
  // Hash the key to ensure it's exactly 32 bytes (256 bits)
  return createHash('sha256').update(ENCRYPTION_KEY).digest();
};

/**
 * Encrypts a file buffer
 * @param buffer - The file buffer to encrypt
 * @returns Object containing encrypted data, IV, and auth tag
 */
export const encryptBuffer = (buffer: Buffer): { 
  encryptedData: Buffer; 
  iv: Buffer; 
  authTag: Buffer;
} => {
  const iv = randomBytes(16); // Initialization vector
  const key = getEncryptionKey();
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encryptedBuffers: Buffer[] = [];
  encryptedBuffers.push(cipher.update(buffer));
  encryptedBuffers.push(cipher.final());
  
  // In GCM mode, getAuthTag() returns the authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: Buffer.concat(encryptedBuffers),
    iv,
    authTag
  };
};

/**
 * Decrypts an encrypted buffer
 * @param encryptedData - The encrypted data
 * @param iv - The initialization vector used for encryption
 * @param authTag - The authentication tag from GCM encryption
 * @returns The decrypted buffer
 */
export const decryptBuffer = (
  encryptedData: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer => {
  const key = getEncryptionKey();
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decryptedBuffers: Buffer[] = [];
  decryptedBuffers.push(decipher.update(encryptedData));
  decryptedBuffers.push(decipher.final());
  
  return Buffer.concat(decryptedBuffers);
};

/**
 * Upload a document to S3 with client-side encryption
 */
export const uploadDocument = async (params: DocumentUploadParams): Promise<string> => {
  const { file, fileName, fileType, mimeType, category, healthRecordId, userId, tags = [] } = params;
  
  // Encrypt the file
  const { encryptedData, iv, authTag } = encryptBuffer(file);
  
  // Generate a unique key for S3
  const uniqueId = randomBytes(8).toString('hex');
  const s3Key = `documents/${userId}/${uniqueId}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  // Store in S3
  const s3Bucket = process.env.S3_BUCKET_NAME || 'lifenavigator-documents';
  
  // Combined encrypted data with IV and authTag for storage
  // Format: [16 bytes IV][16 bytes AuthTag][Encrypted Data]
  const combinedBuffer = Buffer.concat([iv, authTag, encryptedData]);
  
  await s3Client.send(new PutObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
    Body: combinedBuffer,
    ContentType: 'application/octet-stream', // Encrypted data
    ServerSideEncryption: 'AES256', // Additional server-side encryption
    Metadata: {
      'original-content-type': mimeType,
      'encrypted': 'true',
      'encryption-algorithm': ALGORITHM
    }
  }));
  
  // Store metadata in database
  const document = await prisma.secureDocument.create({
    data: {
      healthRecordId,
      filename: fileName,
      originalFilename: fileName,
      fileType,
      mimeType,
      category,
      s3Key,
      s3Bucket,
      size: file.length,
      encryptionMethod: ALGORITHM,
      encryptionIV: iv.toString('base64'),
      uploadDate: new Date(),
      documentTags: {
        create: tags.map(tag => ({
          name: tag
        }))
      }
    }
  });
  
  // Log the access for audit trail
  await prisma.documentAccessLog.create({
    data: {
      documentId: document.id,
      accessType: 'upload',
      // Additional fields can be added for request IP, user agent, etc.
    }
  });
  
  return document.id;
};

/**
 * Download and decrypt a document
 */
export const downloadDocument = async (
  documentId: string, 
  user: UserType
): Promise<DocumentDownloadResult> => {
  // Retrieve document metadata
  const document = await prisma.secureDocument.findUnique({
    where: { id: documentId },
    include: {
      healthRecord: true,
    }
  });
  
  if (!document) {
    throw new Error('Document not found');
  }
  
  // Check access permissions
  if (document.healthRecord.userId !== user.id) {
    // Check if document is shared with this user
    const share = await prisma.documentShare.findFirst({
      where: {
        documentId,
        recipientEmail: user.email,
        expiresAt: { gt: new Date() },
        accessLevel: { in: ['view', 'download', 'edit'] }
      }
    });
    
    if (!share) {
      throw new Error('Access denied');
    }
    
    // Update share access logs
    await prisma.documentShare.update({
      where: { id: share.id },
      data: {
        accessed: true,
        accessedAt: new Date()
      }
    });
  }
  
  // Update last accessed time
  await prisma.secureDocument.update({
    where: { id: documentId },
    data: { lastAccessed: new Date() }
  });
  
  // Log the access for audit trail
  await prisma.documentAccessLog.create({
    data: {
      documentId,
      accessType: 'download',
      // Additional fields for IP, user agent, etc.
    }
  });
  
  // Get the file from S3
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: document.s3Bucket,
    Key: document.s3Key
  }));
  
  // Convert stream to buffer
  const chunks: Buffer[] = [];
  // @ts-ignore - response.Body is a readable stream
  for await (const chunk of response.Body) {
    chunks.push(Buffer.from(chunk));
  }
  
  const encryptedBuffer = Buffer.concat(chunks);
  
  // Extract IV, AuthTag, and encrypted data
  // Format: [16 bytes IV][16 bytes AuthTag][Encrypted Data]
  const iv = encryptedBuffer.subarray(0, 16);
  const authTag = encryptedBuffer.subarray(16, 32);
  const encryptedData = encryptedBuffer.subarray(32);
  
  // Decrypt the data
  const decryptedBuffer = decryptBuffer(encryptedData, iv, authTag);
  
  return {
    buffer: decryptedBuffer,
    fileName: document.originalFilename,
    mimeType: document.mimeType
  };
};

/**
 * Create a temporary signed URL for viewing a document (for shared access)
 */
export const createSignedUrlForDocument = async (
  documentId: string,
  expirationMinutes: number = 15
): Promise<string> => {
  const document = await prisma.secureDocument.findUnique({
    where: { id: documentId }
  });
  
  if (!document) {
    throw new Error('Document not found');
  }
  
  // Create a pre-signed URL that expires
  const expiresIn = expirationMinutes * 60; // Convert to seconds
  
  const command = new GetObjectCommand({
    Bucket: document.s3Bucket,
    Key: document.s3Key
  });
  
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  
  // Update document with expiration
  await prisma.secureDocument.update({
    where: { id: documentId },
    data: {
      expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000)
    }
  });
  
  // This URL will need to be handled by a server route that validates the token,
  // retrieves the file, decrypts it, and streams it back to the user
  return signedUrl;
};

/**
 * Create a shareable link with secure access code
 */
export const shareDocument = async (
  documentId: string,
  recipientEmail: string,
  accessLevel: 'view' | 'download' | 'edit' = 'view',
  expirationDays: number = 7
): Promise<string> => {
  const document = await prisma.secureDocument.findUnique({
    where: { id: documentId }
  });
  
  if (!document) {
    throw new Error('Document not found');
  }
  
  // Generate secure access code
  const accessCode = randomBytes(20).toString('hex');
  
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);
  
  // Create share record
  const share = await prisma.documentShare.create({
    data: {
      documentId,
      recipientEmail,
      accessCode,
      accessLevel,
      expiresAt
    }
  });
  
  // Mark document as shared
  await prisma.secureDocument.update({
    where: { id: documentId },
    data: { shared: true }
  });
  
  // Return shareable link (to be implemented in frontend)
  return `/dashboard/healthcare/documents/shared/${accessCode}`;
};

/**
 * Delete a document (from S3 and database)
 */
export const deleteDocument = async (documentId: string, userId: string): Promise<boolean> => {
  // Find the document and verify ownership
  const document = await prisma.secureDocument.findFirst({
    where: { 
      id: documentId,
      healthRecord: {
        userId
      }
    }
  });
  
  if (!document) {
    throw new Error('Document not found or access denied');
  }
  
  // Delete from S3
  await s3Client.send(new DeleteObjectCommand({
    Bucket: document.s3Bucket,
    Key: document.s3Key
  }));
  
  // Delete from database (will cascade to tags, shares, logs due to relations)
  await prisma.secureDocument.delete({
    where: { id: documentId }
  });
  
  return true;
};

/**
 * Get secure document by ID
 */
export const getDocument = async (documentId: string, userId: string) => {
  const document = await prisma.secureDocument.findFirst({
    where: { 
      id: documentId,
      healthRecord: {
        userId
      }
    },
    include: {
      documentTags: true
    }
  });
  
  if (!document) {
    throw new Error('Document not found or access denied');
  }
  
  // Log access
  await prisma.documentAccessLog.create({
    data: {
      documentId,
      accessType: 'view'
    }
  });
  
  // Update last accessed
  await prisma.secureDocument.update({
    where: { id: documentId },
    data: { lastAccessed: new Date() }
  });
  
  return document;
};

/**
 * List documents for a user
 */
export const listDocuments = async (
  userId: string, 
  options: {
    category?: DocumentCategory;
    searchTerm?: string;
    favorite?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) => {
  const { category, searchTerm, favorite, limit = 20, offset = 0 } = options;

  // Find health record for user
  const healthRecord = await prisma.healthRecord.findFirst({
    where: { userId }
  });

  if (!healthRecord) {
    throw new Error('Health record not found');
  }
  
  // Build the query
  const where: any = {
    healthRecordId: healthRecord.id
  };
  
  if (category) {
    where.category = category;
  }
  
  if (favorite !== undefined) {
    where.favorite = favorite;
  }
  
  if (searchTerm) {
    where.OR = [
      { filename: { contains: searchTerm, mode: 'insensitive' } },
      { originalFilename: { contains: searchTerm, mode: 'insensitive' } },
      { 
        documentTags: { 
          some: { 
            name: { contains: searchTerm, mode: 'insensitive' } 
          }
        }
      }
    ];
  }

  // Get documents
  const documents = await prisma.secureDocument.findMany({
    where,
    include: {
      documentTags: true,
      documentShares: {
        select: {
          id: true,
          recipientEmail: true,
          accessLevel: true,
          expiresAt: true,
          accessed: true
        }
      },
      _count: {
        select: { accessLogs: true }
      }
    },
    orderBy: { uploadDate: 'desc' },
    take: limit,
    skip: offset
  });
  
  // Get total count for pagination
  const totalCount = await prisma.secureDocument.count({ where });
  
  return { documents, totalCount };
};