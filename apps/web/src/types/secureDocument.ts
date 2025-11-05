// Document category type
export type DocumentCategory = 'insurance' | 'medical' | 'identification' | 'financial' | 'legal';

// Document access level for sharing
export type DocumentAccessLevel = 'view' | 'download' | 'edit';

// Base document interface
export interface SecureDocumentBase {
  id: string;
  filename: string;
  fileType: string;
  category: DocumentCategory;
  size: number;
  uploadDate: string;
  lastAccessed?: string;
  favorite: boolean;
  shared: boolean;
}

// Interface for document list items (less detailed)
export interface SecureDocumentListItem extends SecureDocumentBase {
  tags: string[];
  shareCount: number;
  accessCount: number;
}

// Full document interface with all details
export interface SecureDocumentDetail extends SecureDocumentBase {
  originalFilename: string;
  mimeType: string;
  encryptionMethod: string;
  thumbnailUrl?: string;
  tags: DocumentTag[];
  shares: DocumentShare[];
  createdAt: string;
  updatedAt: string;
}

// Document tag
export interface DocumentTag {
  id: string;
  name: string;
}

// Document share
export interface DocumentShare {
  id: string;
  recipientEmail: string;
  accessLevel: DocumentAccessLevel;
  expiresAt: string;
  accessed: boolean;
  accessedAt?: string;
}

// Document access log
export interface DocumentAccessLog {
  id: string;
  accessType: string;
  accessedAt: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

// Document upload request
export interface DocumentUploadRequest {
  file: File;
  category: DocumentCategory;
  tags?: string[];
}

// Document upload response
export interface DocumentUploadResponse {
  documentId: string;
  message: string;
}

// Document share request
export interface DocumentShareRequest {
  documentId: string;
  recipientEmail: string;
  accessLevel?: DocumentAccessLevel;
  expirationDays?: number;
}

// Document share response
export interface DocumentShareResponse {
  shareLink: string;
  expiresAt: string;
}

// Document search params
export interface DocumentSearchParams {
  category?: DocumentCategory;
  searchTerm?: string;
  favorite?: boolean;
  page?: number;
  limit?: number;
}

// Document list response
export interface DocumentListResponse {
  documents: SecureDocumentListItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

// Shared document info
export interface SharedDocumentInfo {
  document: {
    id: string;
    filename: string;
    fileType: string;
    size: number;
    uploadDate: string;
    accessLevel: DocumentAccessLevel;
  };
  share: {
    recipientEmail: string;
    expiresAt: string;
  };
}