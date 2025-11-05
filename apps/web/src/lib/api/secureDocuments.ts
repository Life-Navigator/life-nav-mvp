import { client } from './client';
import { 
  DocumentCategory,
  DocumentAccessLevel,
  SecureDocumentListItem,
  SecureDocumentDetail,
  DocumentShareRequest,
  DocumentShareResponse,
  DocumentSearchParams,
  DocumentListResponse,
  SharedDocumentInfo
} from '@/types/secureDocument';

/**
 * Get a list of secure documents with optional filtering
 */
export const getDocumentsList = async (params: DocumentSearchParams = {}): Promise<DocumentListResponse> => {
  const { category, searchTerm, favorite, page = 1, limit = 20 } = params;
  
  const queryParams = new URLSearchParams();
  if (category) queryParams.append('category', category);
  if (searchTerm) queryParams.append('search', searchTerm);
  if (favorite !== undefined) queryParams.append('favorite', favorite.toString());
  if (page) queryParams.append('offset', ((page - 1) * limit).toString());
  if (limit) queryParams.append('limit', limit.toString());
  
  const response = await client.get(`/api/healthcare/documents?${queryParams.toString()}`);
  return response.data;
};

/**
 * Get a single document by ID
 */
export const getDocumentById = async (id: string): Promise<SecureDocumentDetail> => {
  const response = await client.get(`/api/healthcare/documents/${id}`);
  return response.data.document;
};

/**
 * Update a document (favorite status, tags, category)
 */
export const updateDocument = async (
  id: string, 
  data: { favorite?: boolean; tags?: string[]; category?: DocumentCategory }
): Promise<SecureDocumentDetail> => {
  const response = await client.patch('/api/healthcare/documents', {
    id,
    ...data
  });
  return response.data.document;
};

/**
 * Delete a document
 */
export const deleteDocument = async (id: string): Promise<{ message: string }> => {
  const response = await client.delete(`/api/healthcare/documents?id=${id}`);
  return response.data;
};

/**
 * Get a download URL for a document
 */
export const getDocumentDownloadUrl = (id: string): string => {
  return `/api/healthcare/documents/download?id=${id}`;
};

/**
 * Share a document with someone
 */
export const shareDocument = async (
  request: DocumentShareRequest
): Promise<DocumentShareResponse> => {
  const response = await client.post('/api/healthcare/documents/share', request);
  return response.data;
};

/**
 * Revoke a document share
 */
export const revokeShare = async (shareId: string): Promise<{ message: string }> => {
  const response = await client.delete(`/api/healthcare/documents/share?id=${shareId}`);
  return response.data;
};

/**
 * Get information about a shared document (without downloading it)
 */
export const getSharedDocumentInfo = async (accessCode: string): Promise<SharedDocumentInfo> => {
  const response = await client.get(`/api/healthcare/documents/shared?code=${accessCode}&info=true`);
  return response.data;
};

/**
 * Get the URL to view a shared document
 */
export const getSharedDocumentViewUrl = (accessCode: string): string => {
  return `/api/healthcare/documents/shared?code=${accessCode}`;
};

/**
 * Upload a document
 */
export const uploadDocument = async (
  file: File,
  category: DocumentCategory,
  tags: string[] = []
): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  
  if (tags.length > 0) {
    formData.append('tags', tags.join(','));
  }
  
  const response = await client.post('/api/healthcare/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data.documentId;
};