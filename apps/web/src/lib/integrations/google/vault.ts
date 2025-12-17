/**
 * Google Vault API Client
 * For eDiscovery and data governance (requires Workspace admin)
 */

import type { VaultMatter, VaultHold } from './types';

const VAULT_API_BASE = 'https://vault.googleapis.com/v1';

export class GoogleVaultClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${VAULT_API_BASE}${endpoint}`, {
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
        `Vault API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  // =====================
  // Matters
  // =====================

  /**
   * List matters
   */
  async listMatters(options?: {
    pageSize?: number;
    pageToken?: string;
    state?: 'OPEN' | 'CLOSED' | 'DELETED';
    view?: 'BASIC' | 'FULL';
  }): Promise<{
    matters: VaultMatter[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.state) params.append('state', options.state);
    if (options?.view) params.append('view', options.view);

    const queryString = params.toString();
    return this.request(`/matters${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a matter
   */
  async getMatter(matterId: string, view?: 'BASIC' | 'FULL'): Promise<VaultMatter> {
    const params = view ? `?view=${view}` : '';
    return this.request<VaultMatter>(`/matters/${matterId}${params}`);
  }

  /**
   * Create a matter
   */
  async createMatter(
    name: string,
    description?: string
  ): Promise<VaultMatter> {
    return this.request<VaultMatter>('/matters', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  /**
   * Update a matter
   */
  async updateMatter(
    matterId: string,
    updates: {
      name?: string;
      description?: string;
    }
  ): Promise<VaultMatter> {
    return this.request<VaultMatter>(`/matters/${matterId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Close a matter
   */
  async closeMatter(matterId: string): Promise<VaultMatter> {
    return this.request<VaultMatter>(`/matters/${matterId}:close`, {
      method: 'POST',
    });
  }

  /**
   * Reopen a matter
   */
  async reopenMatter(matterId: string): Promise<VaultMatter> {
    return this.request<VaultMatter>(`/matters/${matterId}:reopen`, {
      method: 'POST',
    });
  }

  /**
   * Delete a matter
   */
  async deleteMatter(matterId: string): Promise<VaultMatter> {
    return this.request<VaultMatter>(`/matters/${matterId}:delete`, {
      method: 'POST',
    });
  }

  /**
   * Undelete a matter
   */
  async undeleteMatter(matterId: string): Promise<VaultMatter> {
    return this.request<VaultMatter>(`/matters/${matterId}:undelete`, {
      method: 'POST',
    });
  }

  // =====================
  // Holds
  // =====================

  /**
   * List holds for a matter
   */
  async listHolds(
    matterId: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      view?: 'BASIC' | 'FULL';
    }
  ): Promise<{
    holds: VaultHold[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.view) params.append('view', options.view);

    const queryString = params.toString();
    return this.request(
      `/matters/${matterId}/holds${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get a hold
   */
  async getHold(
    matterId: string,
    holdId: string,
    view?: 'BASIC' | 'FULL'
  ): Promise<VaultHold> {
    const params = view ? `?view=${view}` : '';
    return this.request<VaultHold>(`/matters/${matterId}/holds/${holdId}${params}`);
  }

  /**
   * Create a hold
   */
  async createHold(
    matterId: string,
    hold: {
      name: string;
      corpus: 'DRIVE' | 'MAIL' | 'GROUPS' | 'HANGOUTS_CHAT' | 'VOICE';
      accounts?: Array<{ accountId: string }>;
      orgUnit?: { orgUnitId: string };
      query?: {
        driveQuery?: { includeTeamDriveFiles?: boolean };
        mailQuery?: { terms?: string; startTime?: string; endTime?: string };
        groupsQuery?: { terms?: string; startTime?: string; endTime?: string };
        hangoutsChatQuery?: { includeRooms?: boolean };
        voiceQuery?: { coveredData?: string[] };
      };
    }
  ): Promise<VaultHold> {
    return this.request<VaultHold>(`/matters/${matterId}/holds`, {
      method: 'POST',
      body: JSON.stringify(hold),
    });
  }

  /**
   * Update a hold
   */
  async updateHold(
    matterId: string,
    holdId: string,
    updates: Partial<{
      name: string;
      query: object;
    }>
  ): Promise<VaultHold> {
    return this.request<VaultHold>(`/matters/${matterId}/holds/${holdId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a hold
   */
  async deleteHold(matterId: string, holdId: string): Promise<void> {
    await fetch(`${VAULT_API_BASE}/matters/${matterId}/holds/${holdId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Add accounts to a hold
   */
  async addHeldAccounts(
    matterId: string,
    holdId: string,
    accountIds: string[]
  ): Promise<{
    responses: Array<{
      status?: { code: number; message: string };
      heldAccount?: { accountId: string };
    }>;
  }> {
    return this.request(`/matters/${matterId}/holds/${holdId}:addHeldAccounts`, {
      method: 'POST',
      body: JSON.stringify({
        accountIds,
      }),
    });
  }

  /**
   * Remove accounts from a hold
   */
  async removeHeldAccounts(
    matterId: string,
    holdId: string,
    accountIds: string[]
  ): Promise<{
    statuses: Array<{ code: number; message: string }>;
  }> {
    return this.request(`/matters/${matterId}/holds/${holdId}:removeHeldAccounts`, {
      method: 'POST',
      body: JSON.stringify({
        accountIds,
      }),
    });
  }

  // =====================
  // Exports
  // =====================

  /**
   * List exports for a matter
   */
  async listExports(
    matterId: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<{
    exports: Array<{
      id: string;
      matterId: string;
      name: string;
      requester: { email: string };
      query: object;
      exportOptions: object;
      createTime: string;
      status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
      stats?: {
        exportedArtifactCount: string;
        totalArtifactCount: string;
        sizeInBytes: string;
      };
      cloudStorageSink?: {
        files: Array<{
          bucketName: string;
          objectName: string;
          size: string;
          md5Hash: string;
        }>;
      };
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    return this.request(
      `/matters/${matterId}/exports${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get an export
   */
  async getExport(matterId: string, exportId: string): Promise<{
    id: string;
    matterId: string;
    name: string;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
    cloudStorageSink?: object;
  }> {
    return this.request(`/matters/${matterId}/exports/${exportId}`);
  }

  /**
   * Create an export
   */
  async createExport(
    matterId: string,
    exportConfig: {
      name: string;
      query: {
        corpus: 'DRIVE' | 'MAIL' | 'GROUPS' | 'HANGOUTS_CHAT' | 'VOICE';
        dataScope: 'ALL_DATA' | 'HELD_DATA' | 'UNPROCESSED_DATA';
        searchMethod: 'ACCOUNT' | 'ORG_UNIT' | 'TEAM_DRIVE' | 'ENTIRE_ORG' | 'ROOM' | 'SHARED_DRIVE';
        accountInfo?: { emails: string[] };
        orgUnitInfo?: { orgUnitId: string };
        driveOptions?: { includeTeamDrives?: boolean };
        mailOptions?: { excludeDrafts?: boolean };
        startTime?: string;
        endTime?: string;
        timeZone?: string;
        terms?: string;
      };
      exportOptions: {
        driveOptions?: {
          includeAccessInfo: boolean;
        };
        mailOptions?: {
          exportFormat: 'MBOX' | 'PST';
          showConfidentialModeContent: boolean;
        };
        groupsOptions?: {
          exportFormat: 'MBOX' | 'PST';
        };
        hangoutsChatOptions?: {
          exportFormat: 'MBOX' | 'PST';
        };
        voiceOptions?: {
          exportFormat: 'MBOX' | 'PST';
        };
        region: 'ANY' | 'US' | 'EUROPE';
      };
    }
  ): Promise<{
    id: string;
    matterId: string;
    name: string;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  }> {
    return this.request(`/matters/${matterId}/exports`, {
      method: 'POST',
      body: JSON.stringify(exportConfig),
    });
  }

  /**
   * Delete an export
   */
  async deleteExport(matterId: string, exportId: string): Promise<void> {
    await fetch(`${VAULT_API_BASE}/matters/${matterId}/exports/${exportId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Saved Queries
  // =====================

  /**
   * List saved queries for a matter
   */
  async listSavedQueries(
    matterId: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<{
    savedQueries: Array<{
      savedQueryId: string;
      matterId: string;
      displayName: string;
      query: object;
      createTime: string;
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    return this.request(
      `/matters/${matterId}/savedQueries${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Create a saved query
   */
  async createSavedQuery(
    matterId: string,
    displayName: string,
    query: object
  ): Promise<{
    savedQueryId: string;
    matterId: string;
    displayName: string;
    query: object;
  }> {
    return this.request(`/matters/${matterId}/savedQueries`, {
      method: 'POST',
      body: JSON.stringify({ displayName, query }),
    });
  }

  /**
   * Delete a saved query
   */
  async deleteSavedQuery(matterId: string, savedQueryId: string): Promise<void> {
    await fetch(
      `${VAULT_API_BASE}/matters/${matterId}/savedQueries/${savedQueryId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
  }

  // =====================
  // Operations
  // =====================

  /**
   * List operations
   */
  async listOperations(
    matterId: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
    }
  ): Promise<{
    operations: Array<{
      name: string;
      done: boolean;
      metadata?: object;
      result?: { error?: object; response?: object };
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);

    const queryString = params.toString();
    return this.request(`/operations${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get operation status
   */
  async getOperation(operationName: string): Promise<{
    name: string;
    done: boolean;
    metadata?: object;
    result?: { error?: object; response?: object };
  }> {
    return this.request(`/${operationName}`);
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationName: string): Promise<void> {
    await this.request(`/${operationName}:cancel`, { method: 'POST' });
  }
}

// Factory function
export function createGoogleVaultClient(accessToken: string): GoogleVaultClient {
  return new GoogleVaultClient(accessToken);
}
