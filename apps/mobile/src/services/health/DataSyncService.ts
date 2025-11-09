/**
 * Life Navigator - Data Sync Service
 *
 * Coordinates health data from all sources and syncs to backend
 */

import { Platform } from 'react-native';
import axios from 'axios';
import AppleHealthService from './AppleHealthService';
import GoogleFitService from './GoogleFitService';
import BluetoothService from '../bluetooth/BluetoothService';
import {
  HealthDataType,
  HealthDataPoint,
  SleepData,
  WorkoutData,
  SyncStatus,
  SyncSettings,
  DataSyncResult,
  SyncSession,
  WearableSyncRequest,
  WearableSyncResponse,
  DeviceType,
} from '../../types/wearables';

// ============================================================================
// Type Definitions
// ============================================================================

interface SyncConfig {
  apiBaseUrl?: string;
  userId?: string;
  autoSync?: boolean;
  syncIntervalMinutes?: number;
}

interface DataSource {
  name: string;
  enabled: boolean;
  lastSync?: Date;
}

// ============================================================================
// Data Sync Service Class
// ============================================================================

class DataSyncService {
  private config: SyncConfig;
  private syncInProgress: boolean = false;
  private syncInterval?: NodeJS.Timeout;
  private lastSyncTime?: Date;

  // Event listeners
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  // Data sources
  private dataSources: Map<string, DataSource> = new Map([
    ['appleHealth', { name: 'Apple Health', enabled: Platform.OS === 'ios' }],
    ['googleFit', { name: 'Google Fit', enabled: Platform.OS === 'android' }],
    ['bluetooth', { name: 'Bluetooth Devices', enabled: true }],
  ]);

  constructor(config: SyncConfig = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:8000/api/v1',
      userId: config.userId,
      autoSync: config.autoSync ?? true,
      syncIntervalMinutes: config.syncIntervalMinutes || 60,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  setApiBaseUrl(url: string): void {
    this.config.apiBaseUrl = url;
  }

  updateSettings(settings: Partial<SyncSettings>): void {
    if (settings.autoSyncEnabled !== undefined) {
      this.config.autoSync = settings.autoSyncEnabled;
      if (settings.autoSyncEnabled) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
    }

    if (settings.syncIntervalMinutes !== undefined) {
      this.config.syncIntervalMinutes = settings.syncIntervalMinutes;
      if (this.config.autoSync) {
        this.startAutoSync(); // Restart with new interval
      }
    }

    if (settings.dataSources) {
      if (settings.dataSources.appleHealth !== undefined) {
        const source = this.dataSources.get('appleHealth');
        if (source) source.enabled = settings.dataSources.appleHealth;
      }
      if (settings.dataSources.googleFit !== undefined) {
        const source = this.dataSources.get('googleFit');
        if (source) source.enabled = settings.dataSources.googleFit;
      }
      if (settings.dataSources.bluetoothDevices !== undefined) {
        const source = this.dataSources.get('bluetooth');
        if (source) source.enabled = settings.dataSources.bluetoothDevices;
      }
    }
  }

  // ============================================================================
  // Main Sync Methods
  // ============================================================================

  async syncAll(): Promise<SyncSession> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!this.config.userId) {
      throw new Error('User ID not set. Call setUserId() first.');
    }

    this.syncInProgress = true;
    const session: SyncSession = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      status: SyncStatus.SYNCING,
      results: [],
      totalRecordsSynced: 0,
      errors: [],
    };

    this.emit('syncStarted', session);

    try {
      // Sync from all enabled data sources
      const syncPromises: Promise<DataSyncResult[]>[] = [];

      // Apple Health (iOS only)
      if (Platform.OS === 'ios' && this.isSourceEnabled('appleHealth')) {
        syncPromises.push(this.syncAppleHealth());
      }

      // Google Fit (Android only)
      if (Platform.OS === 'android' && this.isSourceEnabled('googleFit')) {
        syncPromises.push(this.syncGoogleFit());
      }

      // Bluetooth devices
      if (this.isSourceEnabled('bluetooth')) {
        syncPromises.push(this.syncBluetoothDevices());
      }

      // Execute all syncs in parallel
      const allResults = await Promise.all(syncPromises);
      session.results = allResults.flat();

      // Calculate totals
      session.totalRecordsSynced = session.results.reduce(
        (sum, result) => sum + result.recordCount,
        0
      );

      // Collect errors
      session.errors = session.results
        .filter((result) => !result.success && result.error)
        .map((result) => result.error!);

      session.endTime = new Date();
      session.status = session.errors.length > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;

      this.lastSyncTime = new Date();
      this.emit('syncCompleted', session);

      return session;
    } catch (error) {
      session.endTime = new Date();
      session.status = SyncStatus.ERROR;
      session.errors.push(error instanceof Error ? error.message : 'Unknown error');

      this.emit('syncError', { session, error });

      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // ============================================================================
  // Platform-Specific Sync Methods
  // ============================================================================

  private async syncAppleHealth(): Promise<DataSyncResult[]> {
    const results: DataSyncResult[] = [];
    const source = 'Apple Health';
    const startDate = this.getLastSyncDate('appleHealth');
    const endDate = new Date();

    try {
      // Sync Steps
      const steps = await AppleHealthService.getSteps({ startDate, endDate });
      if (steps.length > 0) {
        const result = await this.sendDataToBackend(steps, DeviceType.APPLE_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.STEPS,
          source,
          recordCount: steps.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Heart Rate
      const heartRate = await AppleHealthService.getHeartRate({ startDate, endDate });
      if (heartRate.length > 0) {
        const result = await this.sendDataToBackend(heartRate, DeviceType.APPLE_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.HEART_RATE,
          source,
          recordCount: heartRate.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Sleep
      const sleep = await AppleHealthService.getSleep({ startDate, endDate });
      if (sleep.length > 0) {
        const sleepDataPoints = this.convertSleepToDataPoints(sleep);
        const result = await this.sendDataToBackend(sleepDataPoints, DeviceType.APPLE_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.SLEEP,
          source,
          recordCount: sleep.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Workouts
      const workouts = await AppleHealthService.getWorkouts({ startDate, endDate });
      if (workouts.length > 0) {
        const workoutDataPoints = this.convertWorkoutsToDataPoints(workouts);
        const result = await this.sendDataToBackend(workoutDataPoints, DeviceType.APPLE_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.WORKOUT,
          source,
          recordCount: workouts.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Active Energy
      const energy = await AppleHealthService.getActiveEnergy({ startDate, endDate });
      if (energy.length > 0) {
        const result = await this.sendDataToBackend(energy, DeviceType.APPLE_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.ACTIVE_ENERGY,
          source,
          recordCount: energy.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Update last sync time
      this.updateLastSyncDate('appleHealth');
    } catch (error) {
      console.error('Error syncing Apple Health data:', error);
      results.push({
        success: false,
        dataType: HealthDataType.STEPS,
        source,
        recordCount: 0,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  private async syncGoogleFit(): Promise<DataSyncResult[]> {
    const results: DataSyncResult[] = [];
    const source = 'Google Fit';
    const startDate = this.getLastSyncDate('googleFit');
    const endDate = new Date();

    try {
      // Sync Steps
      const steps = await GoogleFitService.getSteps({ startDate, endDate });
      if (steps.length > 0) {
        const result = await this.sendDataToBackend(steps, DeviceType.SAMSUNG_GALAXY_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.STEPS,
          source,
          recordCount: steps.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Heart Rate
      const heartRate = await GoogleFitService.getHeartRate({ startDate, endDate });
      if (heartRate.length > 0) {
        const result = await this.sendDataToBackend(heartRate, DeviceType.SAMSUNG_GALAXY_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.HEART_RATE,
          source,
          recordCount: heartRate.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Sleep
      const sleep = await GoogleFitService.getSleep({ startDate, endDate });
      if (sleep.length > 0) {
        const sleepDataPoints = this.convertSleepToDataPoints(sleep);
        const result = await this.sendDataToBackend(sleepDataPoints, DeviceType.SAMSUNG_GALAXY_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.SLEEP,
          source,
          recordCount: sleep.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Workouts
      const workouts = await GoogleFitService.getWorkouts({ startDate, endDate });
      if (workouts.length > 0) {
        const workoutDataPoints = this.convertWorkoutsToDataPoints(workouts);
        const result = await this.sendDataToBackend(workoutDataPoints, DeviceType.SAMSUNG_GALAXY_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.WORKOUT,
          source,
          recordCount: workouts.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Sync Calories
      const calories = await GoogleFitService.getCalories({ startDate, endDate });
      if (calories.length > 0) {
        const result = await this.sendDataToBackend(calories, DeviceType.SAMSUNG_GALAXY_WATCH);
        results.push({
          success: result.success,
          dataType: HealthDataType.ACTIVE_ENERGY,
          source,
          recordCount: calories.length,
          startDate,
          endDate,
          error: result.success ? undefined : result.message,
        });
      }

      // Update last sync time
      this.updateLastSyncDate('googleFit');
    } catch (error) {
      console.error('Error syncing Google Fit data:', error);
      results.push({
        success: false,
        dataType: HealthDataType.STEPS,
        source,
        recordCount: 0,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  private async syncBluetoothDevices(): Promise<DataSyncResult[]> {
    const results: DataSyncResult[] = [];
    // Placeholder for Bluetooth device sync
    // In a real implementation, you would iterate through connected devices
    // and sync their cached data
    return results;
  }

  // ============================================================================
  // Backend Communication
  // ============================================================================

  private async sendDataToBackend(
    data: HealthDataPoint[],
    deviceType: DeviceType
  ): Promise<WearableSyncResponse> {
    try {
      const request: WearableSyncRequest = {
        userId: this.config.userId!,
        deviceId: this.getDeviceId(deviceType),
        deviceType,
        data,
        syncTimestamp: new Date(),
      };

      const response = await axios.post<WearableSyncResponse>(
        `${this.config.apiBaseUrl}/health/wearable-sync`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending data to backend:', error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          recordsProcessed: 0,
          message: error.message,
          errors: [error.response?.data?.detail || error.message],
        };
      }

      return {
        success: false,
        recordsProcessed: 0,
        message: 'Unknown error',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================================
  // Data Transformation
  // ============================================================================

  private convertSleepToDataPoints(sleepData: SleepData[]): HealthDataPoint[] {
    return sleepData.map((sleep) => ({
      type: HealthDataType.SLEEP,
      value: sleep.duration,
      unit: 'minutes',
      startDate: sleep.startDate,
      endDate: sleep.endDate,
      source: sleep.source,
      metadata: {
        stages: sleep.stages,
        quality: sleep.quality,
      },
    }));
  }

  private convertWorkoutsToDataPoints(workouts: WorkoutData[]): HealthDataPoint[] {
    return workouts.map((workout) => ({
      type: HealthDataType.WORKOUT,
      value: workout.duration,
      unit: 'minutes',
      startDate: workout.startDate,
      endDate: workout.endDate,
      source: workout.source,
      metadata: {
        workoutType: workout.type,
        distance: workout.distance,
        calories: workout.calories,
        averageHeartRate: workout.averageHeartRate,
        maxHeartRate: workout.maxHeartRate,
        elevation: workout.elevation,
      },
    }));
  }

  // ============================================================================
  // Auto Sync
  // ============================================================================

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    const intervalMs = this.config.syncIntervalMinutes! * 60 * 1000;

    this.syncInterval = setInterval(() => {
      if (!this.syncInProgress) {
        this.syncAll().catch((error) => {
          console.error('Auto-sync failed:', error);
        });
      }
    }, intervalMs);

    console.log(`Auto-sync started with interval: ${this.config.syncIntervalMinutes} minutes`);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      console.log('Auto-sync stopped');
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private isSourceEnabled(source: string): boolean {
    return this.dataSources.get(source)?.enabled ?? false;
  }

  private getLastSyncDate(source: string): Date {
    const lastSync = this.dataSources.get(source)?.lastSync;
    return lastSync || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
  }

  private updateLastSyncDate(source: string): void {
    const dataSource = this.dataSources.get(source);
    if (dataSource) {
      dataSource.lastSync = new Date();
    }
  }

  private getDeviceId(deviceType: DeviceType): string {
    // Generate a consistent device ID based on type and platform
    return `${Platform.OS}-${deviceType}-${this.config.userId}`;
  }

  private generateSessionId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getLastSyncTime(): Date | undefined {
    return this.lastSyncTime;
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  getDataSources(): Map<string, DataSource> {
    return new Map(this.dataSources);
  }

  // ============================================================================
  // Event Emitter Pattern
  // ============================================================================

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export default new DataSyncService();
