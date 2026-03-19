// types/integration.ts
export interface Provider {
  id: string;
  name: string;
  description: string;
  category: 'finance' | 'education' | 'career' | 'healthcare' | 'automotive' | 'smarthome';
  logo: string;
  connected: boolean;
  comingSoon?: boolean;
  permissions: string[];
  modalDescription?: string;
}

export interface ConnectedService {
  id: string;
  providerId: string;
  name: string;
  logoUrl: string;
  status: 'active' | 'needs_attention' | 'expired';
  connectedDate: string;
  lastSyncDate: string;
  domain: 'finance' | 'education' | 'career' | 'healthcare' | 'automotive' | 'smarthome';
  category?: string;
}

export interface IntegrationToken {
  id: string;
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
}

export interface SyncStatus {
  status: 'success' | 'in_progress' | 'failed';
  lastSync: string | null;
  domains: {
    finance: 'success' | 'in_progress' | 'failed';
    education: 'success' | 'in_progress' | 'failed';
    career: 'success' | 'in_progress' | 'failed';
    healthcare: 'success' | 'in_progress' | 'failed';
    automotive?: 'success' | 'in_progress' | 'failed';
    smarthome?: 'success' | 'in_progress' | 'failed';
  };
}

export interface SyncSource {
  provider: string;
  type: 'email' | 'calendar';
  status: string;
  lastSyncAt: string | null;
  recordCount: number;
}

export interface GraphRAGQueueStatus {
  pendingJobs: number;
  failedJobs: number;
  lastProcessedAt: string | null;
}

export interface SyncStatusResponse {
  sources: SyncSource[];
  graphrag: GraphRAGQueueStatus;
}

export interface SyncNowResponse {
  success: boolean;
  error?: string;
  retryAfterSeconds?: number;
  [key: string]: unknown;
}
