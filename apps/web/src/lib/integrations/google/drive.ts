/**
 * Google Drive API Client
 * Includes Drive API and Drive Activity API
 */

import type {
  DriveFile,
  DrivePermission,
  DriveActivity,
  GoogleApiResponse,
} from './types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_ACTIVITY_API_BASE = 'https://driveactivity.googleapis.com/v2';

export class GoogleDriveClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    baseUrl: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Drive API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * List files
   */
  async listFiles(options?: {
    q?: string;
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
    fields?: string;
    spaces?: 'drive' | 'appDataFolder' | 'photos';
    corpora?: 'user' | 'drive' | 'domain' | 'allDrives';
    includeItemsFromAllDrives?: boolean;
    supportsAllDrives?: boolean;
  }): Promise<GoogleApiResponse<DriveFile[]>> {
    const params = new URLSearchParams();

    if (options?.q) params.append('q', options.q);
    if (options?.pageSize) {
      params.append('pageSize', options.pageSize.toString());
    }
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.orderBy) params.append('orderBy', options.orderBy);
    if (options?.fields) params.append('fields', options.fields);
    if (options?.spaces) params.append('spaces', options.spaces);
    if (options?.corpora) params.append('corpora', options.corpora);
    if (options?.includeItemsFromAllDrives !== undefined) {
      params.append(
        'includeItemsFromAllDrives',
        options.includeItemsFromAllDrives.toString()
      );
    }
    if (options?.supportsAllDrives !== undefined) {
      params.append('supportsAllDrives', options.supportsAllDrives.toString());
    }

    // Default fields if not specified
    if (!options?.fields) {
      params.append(
        'fields',
        'nextPageToken,files(id,name,mimeType,description,starred,trashed,parents,webViewLink,webContentLink,iconLink,thumbnailLink,createdTime,modifiedTime,size,owners)'
      );
    }

    const queryString = params.toString();
    const data = await this.request<{
      files: DriveFile[];
      nextPageToken?: string;
    }>(DRIVE_API_BASE, `/files${queryString ? `?${queryString}` : ''}`);

    return {
      data: data.files || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get a specific file
   */
  async getFile(
    fileId: string,
    fields?: string
  ): Promise<DriveFile> {
    const params = new URLSearchParams();
    params.append(
      'fields',
      fields ||
        'id,name,mimeType,description,starred,trashed,parents,webViewLink,webContentLink,iconLink,thumbnailLink,createdTime,modifiedTime,size,owners,permissions'
    );

    return this.request<DriveFile>(
      DRIVE_API_BASE,
      `/files/${fileId}?${params.toString()}`
    );
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Blob> {
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Export Google Docs/Sheets/Slides to different format
   */
  async exportFile(
    fileId: string,
    mimeType: string
  ): Promise<Blob> {
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(
        mimeType
      )}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to export file: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Create a file
   */
  async createFile(
    metadata: {
      name: string;
      mimeType?: string;
      parents?: string[];
      description?: string;
    },
    content?: Blob | string
  ): Promise<DriveFile> {
    if (!content) {
      // Metadata-only upload (for folders, etc.)
      return this.request<DriveFile>(DRIVE_API_BASE, '/files', {
        method: 'POST',
        body: JSON.stringify(metadata),
      });
    }

    // Multipart upload for files with content
    const boundary = 'boundary_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataStr = JSON.stringify(metadata);
    const contentStr =
      typeof content === 'string' ? content : await content.text();

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadataStr +
      delimiter +
      `Content-Type: ${metadata.mimeType || 'application/octet-stream'}\r\n\r\n` +
      contentStr +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create file: ${error.error?.message}`);
    }

    return response.json();
  }

  /**
   * Create a folder
   */
  async createFolder(
    name: string,
    parentId?: string
  ): Promise<DriveFile> {
    return this.createFile({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    });
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    metadata: Partial<{
      name: string;
      description: string;
      starred: boolean;
      trashed: boolean;
    }>
  ): Promise<DriveFile> {
    return this.request<DriveFile>(DRIVE_API_BASE, `/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(metadata),
    });
  }

  /**
   * Move file to different folder
   */
  async moveFile(
    fileId: string,
    newParentId: string,
    oldParentId?: string
  ): Promise<DriveFile> {
    const params = new URLSearchParams();
    params.append('addParents', newParentId);
    if (oldParentId) {
      params.append('removeParents', oldParentId);
    }

    return this.request<DriveFile>(
      DRIVE_API_BASE,
      `/files/${fileId}?${params.toString()}`,
      { method: 'PATCH' }
    );
  }

  /**
   * Copy a file
   */
  async copyFile(
    fileId: string,
    metadata?: {
      name?: string;
      parents?: string[];
    }
  ): Promise<DriveFile> {
    return this.request<DriveFile>(DRIVE_API_BASE, `/files/${fileId}/copy`, {
      method: 'POST',
      body: JSON.stringify(metadata || {}),
    });
  }

  /**
   * Delete a file permanently
   */
  async deleteFile(fileId: string): Promise<void> {
    await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Trash a file
   */
  async trashFile(fileId: string): Promise<DriveFile> {
    return this.updateFile(fileId, { trashed: true });
  }

  /**
   * Restore a file from trash
   */
  async untrashFile(fileId: string): Promise<DriveFile> {
    return this.updateFile(fileId, { trashed: false });
  }

  /**
   * Empty trash
   */
  async emptyTrash(): Promise<void> {
    await fetch(`${DRIVE_API_BASE}/files/trash`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * List file permissions
   */
  async listPermissions(fileId: string): Promise<DrivePermission[]> {
    const data = await this.request<{ permissions: DrivePermission[] }>(
      DRIVE_API_BASE,
      `/files/${fileId}/permissions?fields=permissions(id,type,role,emailAddress,domain)`
    );
    return data.permissions || [];
  }

  /**
   * Create a permission (share file)
   */
  async createPermission(
    fileId: string,
    permission: {
      type: 'user' | 'group' | 'domain' | 'anyone';
      role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
      emailAddress?: string;
      domain?: string;
    },
    sendNotificationEmail: boolean = true
  ): Promise<DrivePermission> {
    const params = new URLSearchParams();
    params.append('sendNotificationEmail', sendNotificationEmail.toString());

    return this.request<DrivePermission>(
      DRIVE_API_BASE,
      `/files/${fileId}/permissions?${params.toString()}`,
      {
        method: 'POST',
        body: JSON.stringify(permission),
      }
    );
  }

  /**
   * Delete a permission
   */
  async deletePermission(fileId: string, permissionId: string): Promise<void> {
    await fetch(`${DRIVE_API_BASE}/files/${fileId}/permissions/${permissionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Search files
   */
  async searchFiles(
    query: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<GoogleApiResponse<DriveFile[]>> {
    return this.listFiles({
      q: query,
      ...options,
    });
  }

  /**
   * Get storage quota
   */
  async getStorageQuota(): Promise<{
    limit: string;
    usage: string;
    usageInDrive: string;
    usageInDriveTrash: string;
  }> {
    const data = await this.request<{
      storageQuota: {
        limit: string;
        usage: string;
        usageInDrive: string;
        usageInDriveTrash: string;
      };
    }>(DRIVE_API_BASE, '/about?fields=storageQuota');
    return data.storageQuota;
  }

  // =====================
  // Drive Activity API
  // =====================

  /**
   * Query drive activity
   */
  async queryActivity(options?: {
    itemName?: string;
    ancestorName?: string;
    filter?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<GoogleApiResponse<DriveActivity[]>> {
    const body: Record<string, unknown> = {};

    if (options?.itemName) body.itemName = options.itemName;
    if (options?.ancestorName) body.ancestorName = options.ancestorName;
    if (options?.filter) body.filter = options.filter;
    if (options?.pageSize) body.pageSize = options.pageSize;
    if (options?.pageToken) body.pageToken = options.pageToken;

    const data = await this.request<{
      activities: DriveActivity[];
      nextPageToken?: string;
    }>(DRIVE_ACTIVITY_API_BASE, '/activity:query', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      data: data.activities || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get recent activity for a file
   */
  async getFileActivity(
    fileId: string,
    pageSize: number = 50
  ): Promise<DriveActivity[]> {
    const result = await this.queryActivity({
      itemName: `items/${fileId}`,
      pageSize,
    });
    return result.data;
  }

  /**
   * Get recent activity in a folder
   */
  async getFolderActivity(
    folderId: string,
    pageSize: number = 50
  ): Promise<DriveActivity[]> {
    const result = await this.queryActivity({
      ancestorName: `items/${folderId}`,
      pageSize,
    });
    return result.data;
  }
}

// Factory function
export function createGoogleDriveClient(accessToken: string): GoogleDriveClient {
  return new GoogleDriveClient(accessToken);
}

// Common MIME type constants
export const DRIVE_MIME_TYPES = {
  folder: 'application/vnd.google-apps.folder',
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
  form: 'application/vnd.google-apps.form',
  drawing: 'application/vnd.google-apps.drawing',
  script: 'application/vnd.google-apps.script',
  site: 'application/vnd.google-apps.site',
  shortcut: 'application/vnd.google-apps.shortcut',
  pdf: 'application/pdf',
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// Common query builders
export const DRIVE_QUERIES = {
  folders: `mimeType = '${DRIVE_MIME_TYPES.folder}'`,
  documents: `mimeType = '${DRIVE_MIME_TYPES.document}'`,
  spreadsheets: `mimeType = '${DRIVE_MIME_TYPES.spreadsheet}'`,
  presentations: `mimeType = '${DRIVE_MIME_TYPES.presentation}'`,
  notTrashed: 'trashed = false',
  starred: 'starred = true',
  ownedByMe: "'me' in owners",
  sharedWithMe: 'sharedWithMe = true',
  inFolder: (folderId: string) => `'${folderId}' in parents`,
  nameContains: (name: string) => `name contains '${name}'`,
  modifiedAfter: (date: Date) => `modifiedTime > '${date.toISOString()}'`,
  createdAfter: (date: Date) => `createdTime > '${date.toISOString()}'`,
};
