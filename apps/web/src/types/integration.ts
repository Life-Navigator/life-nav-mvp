// types/integration.ts
export interface Provider {
    id: string;
    name: string;
    description: string;
    category: 'finance' | 'education' | 'career' | 'healthcare' | 'automotive' | 'smarthome';
    logo: string;
    connected: boolean;
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