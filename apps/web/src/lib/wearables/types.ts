// Wearable Integration Types

export type WearableProvider =
  | 'apple_health'
  | 'google_fit'
  | 'fitbit'
  | 'garmin'
  | 'samsung_health'
  | 'oura'
  | 'whoop';

export type MetricType =
  | 'steps'
  | 'heart_rate'
  | 'heart_rate_variability'
  | 'resting_heart_rate'
  | 'calories'
  | 'active_calories'
  | 'distance'
  | 'floors'
  | 'sleep'
  | 'sleep_deep'
  | 'sleep_rem'
  | 'sleep_light'
  | 'sleep_awake'
  | 'workout'
  | 'weight'
  | 'body_fat'
  | 'blood_pressure'
  | 'blood_oxygen'
  | 'respiratory_rate'
  | 'temperature'
  | 'vo2_max'
  | 'stress'
  | 'energy'
  | 'readiness';

export interface WearableMetricData {
  metricType: MetricType;
  value: number;
  unit: string;
  timestamp: Date;
  startTime?: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
  sourceRecordId?: string;
  confidence?: number;
}

export interface WearableConnectionConfig {
  provider: WearableProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  recordsFailed: number;
  errors?: string[];
}

export interface WearableProviderAdapter {
  // OAuth flow
  getAuthUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    userId?: string;
  }>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }>;

  // Data sync
  syncData(
    accessToken: string,
    dataTypes: MetricType[],
    startDate: Date,
    endDate: Date
  ): Promise<WearableMetricData[]>;

  // Device info
  getDeviceInfo(accessToken: string): Promise<{
    deviceType?: string;
    deviceModel?: string;
    deviceName?: string;
  }>;
}
