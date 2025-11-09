/**
 * Life Navigator - Google Fit Service
 *
 * Android Google Fit integration for comprehensive health data synchronization
 */

import { Platform } from 'react-native';
import GoogleFit, { Scopes } from 'react-native-google-fit';
import {
  PlatformIntegration,
  PlatformType,
  SyncStatus,
  HealthDataType,
  HealthDataPoint,
  SleepData,
  WorkoutData,
  WorkoutType,
} from '../../types/wearables';

// ============================================================================
// Type Definitions
// ============================================================================

interface GoogleFitConfig {
  autoSync?: boolean;
  syncIntervalMinutes?: number;
  backgroundSync?: boolean;
}

interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  bucketUnit?: 'DAY' | 'HOUR' | 'MINUTE';
  bucketInterval?: number;
}

// ============================================================================
// Google Fit Service Class
// ============================================================================

class GoogleFitService {
  private isInitialized: boolean = false;
  private isAuthorized: boolean = false;
  private config: GoogleFitConfig;
  private syncInterval?: NodeJS.Timeout;

  // Event listeners
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: GoogleFitConfig = {}) {
    this.config = {
      autoSync: config.autoSync ?? true,
      syncIntervalMinutes: config.syncIntervalMinutes || 60,
      backgroundSync: config.backgroundSync ?? true,
    };
  }

  // ============================================================================
  // Initialization and Authorization
  // ============================================================================

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('Google Fit is only available on Android');
      return false;
    }

    try {
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Fit:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Google Fit is not available on this device');
      }
    }

    try {
      // Define all scopes we want to request
      const options = {
        scopes: [
          Scopes.FITNESS_ACTIVITY_READ,
          Scopes.FITNESS_ACTIVITY_WRITE,
          Scopes.FITNESS_BODY_READ,
          Scopes.FITNESS_BODY_WRITE,
          Scopes.FITNESS_LOCATION_READ,
          Scopes.FITNESS_LOCATION_WRITE,
          Scopes.FITNESS_SLEEP_READ,
          Scopes.FITNESS_HEART_RATE_READ,
          Scopes.FITNESS_BLOOD_PRESSURE_READ,
          Scopes.FITNESS_BLOOD_GLUCOSE_READ,
          Scopes.FITNESS_OXYGEN_SATURATION_READ,
          Scopes.FITNESS_BODY_TEMPERATURE_READ,
          Scopes.FITNESS_NUTRITION_READ,
          Scopes.FITNESS_NUTRITION_WRITE,
        ],
      };

      const authResult = await GoogleFit.authorize(options);

      if (authResult.success) {
        this.isAuthorized = true;
        this.emit('authorized', true);

        // Start auto-sync if enabled
        if (this.config.autoSync) {
          this.startAutoSync();
        }

        return true;
      } else {
        console.error('Google Fit authorization failed:', authResult.message);
        return false;
      }
    } catch (error) {
      console.error('Failed to authorize Google Fit:', error);
      return false;
    }
  }

  async checkAuthorization(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const isAuthorized = await GoogleFit.checkIsAuthorized();
      this.isAuthorized = isAuthorized;
      return isAuthorized;
    } catch (error) {
      console.error('Failed to check Google Fit authorization:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await GoogleFit.disconnect();
      this.isAuthorized = false;
      this.stopAutoSync();
      this.emit('disconnected', true);
    } catch (error) {
      console.error('Failed to disconnect from Google Fit:', error);
    }
  }

  // ============================================================================
  // Data Reading Methods
  // ============================================================================

  async getSteps(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getDailyStepCountSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const dataPoints: HealthDataPoint[] = [];

      if (result && result.length > 0) {
        result.forEach((source: any) => {
          if (source.steps && Array.isArray(source.steps)) {
            source.steps.forEach((step: any) => {
              dataPoints.push({
                type: HealthDataType.STEPS,
                value: step.value,
                unit: 'count',
                startDate: new Date(step.startDate),
                endDate: new Date(step.endDate),
                source: 'Google Fit',
              });
            });
          }
        });
      }

      return dataPoints;
    } catch (error) {
      console.error('Failed to get steps from Google Fit:', error);
      throw error;
    }
  }

  async getHeartRate(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getHeartRateSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bucketUnit: options.bucketUnit || 'MINUTE',
        bucketInterval: options.bucketInterval || 1,
      });

      const dataPoints: HealthDataPoint[] = result.map((sample: any) => ({
        type: HealthDataType.HEART_RATE,
        value: sample.value,
        unit: 'bpm',
        startDate: new Date(sample.startDate),
        endDate: new Date(sample.endDate),
        source: 'Google Fit',
      }));

      return dataPoints;
    } catch (error) {
      console.error('Failed to get heart rate from Google Fit:', error);
      throw error;
    }
  }

  async getCalories(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getDailyCalorieSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bucketUnit: options.bucketUnit || 'DAY',
        bucketInterval: options.bucketInterval || 1,
      });

      const dataPoints: HealthDataPoint[] = result.map((sample: any) => ({
        type: HealthDataType.ACTIVE_ENERGY,
        value: sample.calorie,
        unit: 'kcal',
        startDate: new Date(sample.startDate),
        endDate: new Date(sample.endDate),
        source: 'Google Fit',
      }));

      return dataPoints;
    } catch (error) {
      console.error('Failed to get calories from Google Fit:', error);
      throw error;
    }
  }

  async getDistance(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getDailyDistanceSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const dataPoints: HealthDataPoint[] = result.map((sample: any) => ({
        type: HealthDataType.DISTANCE,
        value: sample.distance,
        unit: 'meters',
        startDate: new Date(sample.startDate),
        endDate: new Date(sample.endDate),
        source: 'Google Fit',
      }));

      return dataPoints;
    } catch (error) {
      console.error('Failed to get distance from Google Fit:', error);
      throw error;
    }
  }

  async getSleep(options: SyncOptions = {}): Promise<SleepData[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getSleepSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const sleepData: SleepData[] = result.map((sample: any) => {
        const start = new Date(sample.startDate);
        const end = new Date(sample.endDate);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);

        const stageMap: Record<number, 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM'> = {
          1: 'AWAKE',
          2: 'LIGHT',
          3: 'DEEP',
          4: 'REM',
        };

        return {
          startDate: start,
          endDate: end,
          duration,
          stages: [
            {
              stage: stageMap[sample.value] || 'LIGHT',
              startDate: start,
              endDate: end,
              duration,
            },
          ],
          source: 'Google Fit',
        };
      });

      return sleepData;
    } catch (error) {
      console.error('Failed to get sleep from Google Fit:', error);
      throw error;
    }
  }

  async getWorkouts(options: SyncOptions = {}): Promise<WorkoutData[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getActivitySamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const workouts: WorkoutData[] = result.map((activity: any) => {
        const start = new Date(activity.start);
        const end = new Date(activity.end);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);

        return {
          type: this.mapActivityType(activity.activityName),
          startDate: start,
          endDate: end,
          duration,
          distance: activity.distance,
          calories: activity.calories,
          source: 'Google Fit',
        };
      });

      return workouts;
    } catch (error) {
      console.error('Failed to get workouts from Google Fit:', error);
      throw error;
    }
  }

  async getWeight(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getWeightSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const dataPoints: HealthDataPoint[] = result.map((sample: any) => ({
        type: HealthDataType.WEIGHT,
        value: sample.value,
        unit: 'kg',
        startDate: new Date(sample.startDate),
        endDate: new Date(sample.endDate),
        source: 'Google Fit',
      }));

      return dataPoints;
    } catch (error) {
      console.error('Failed to get weight from Google Fit:', error);
      throw error;
    }
  }

  async getBloodPressure(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    try {
      const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      const result = await GoogleFit.getBloodPressureSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const dataPoints: HealthDataPoint[] = [];

      result.forEach((sample: any) => {
        dataPoints.push(
          {
            type: HealthDataType.BLOOD_PRESSURE,
            value: sample.systolic,
            unit: 'mmHg',
            startDate: new Date(sample.startDate),
            endDate: new Date(sample.endDate),
            source: 'Google Fit',
            metadata: { type: 'systolic', diastolic: sample.diastolic },
          },
          {
            type: HealthDataType.BLOOD_PRESSURE,
            value: sample.diastolic,
            unit: 'mmHg',
            startDate: new Date(sample.startDate),
            endDate: new Date(sample.endDate),
            source: 'Google Fit',
            metadata: { type: 'diastolic', systolic: sample.systolic },
          }
        );
      });

      return dataPoints;
    } catch (error) {
      console.error('Failed to get blood pressure from Google Fit:', error);
      throw error;
    }
  }

  // ============================================================================
  // Data Writing Methods
  // ============================================================================

  async saveSteps(value: number, startDate: Date, endDate: Date): Promise<boolean> {
    this.ensureAuthorized();

    try {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        steps: value,
      };

      const result = await GoogleFit.saveSteps(options);
      return result;
    } catch (error) {
      console.error('Failed to save steps to Google Fit:', error);
      return false;
    }
  }

  async saveWeight(value: number, date: Date): Promise<boolean> {
    this.ensureAuthorized();

    try {
      const options = {
        value,
        date: date.toISOString(),
        unit: 'kg',
      };

      const result = await GoogleFit.saveWeight(options);
      return result;
    } catch (error) {
      console.error('Failed to save weight to Google Fit:', error);
      return false;
    }
  }

  async saveWorkout(workout: WorkoutData): Promise<boolean> {
    this.ensureAuthorized();

    try {
      const options = {
        startDate: workout.startDate.toISOString(),
        endDate: workout.endDate.toISOString(),
        activityName: this.mapWorkoutTypeToGoogleFit(workout.type),
        calories: workout.calories,
        distance: workout.distance,
      };

      const result = await GoogleFit.saveActivity(options);
      return result;
    } catch (error) {
      console.error('Failed to save workout to Google Fit:', error);
      return false;
    }
  }

  // ============================================================================
  // Background Sync
  // ============================================================================

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    const intervalMs = this.config.syncIntervalMinutes! * 60 * 1000;

    this.syncInterval = setInterval(() => {
      this.emit('autoSync', { timestamp: new Date() });
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  // ============================================================================
  // Status and Info
  // ============================================================================

  async getIntegrationStatus(): Promise<PlatformIntegration> {
    return {
      platform: PlatformType.GOOGLE_FIT,
      isConnected: this.isInitialized,
      isAuthorized: this.isAuthorized,
      lastSyncTime: undefined,
      syncStatus: SyncStatus.IDLE,
      authorizedDataTypes: this.getAuthorizedDataTypes(),
      autoSyncEnabled: this.config.autoSync!,
      syncIntervalMinutes: this.config.syncIntervalMinutes!,
    };
  }

  private getAuthorizedDataTypes(): HealthDataType[] {
    if (!this.isAuthorized) {
      return [];
    }

    return [
      HealthDataType.STEPS,
      HealthDataType.HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.WORKOUT,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.DISTANCE,
      HealthDataType.WEIGHT,
      HealthDataType.BODY_MASS_INDEX,
      HealthDataType.BLOOD_PRESSURE,
      HealthDataType.BLOOD_GLUCOSE,
      HealthDataType.BLOOD_OXYGEN,
      HealthDataType.BODY_TEMPERATURE,
      HealthDataType.NUTRITION,
      HealthDataType.HYDRATION,
    ];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private ensureAuthorized(): void {
    if (!this.isAuthorized) {
      throw new Error('Google Fit is not authorized. Call requestAuthorization() first.');
    }
  }

  private mapActivityType(activityName: string): WorkoutType {
    const typeMap: Record<string, WorkoutType> = {
      running: WorkoutType.RUNNING,
      walking: WorkoutType.WALKING,
      cycling: WorkoutType.CYCLING,
      swimming: WorkoutType.SWIMMING,
      'swimming.pool': WorkoutType.SWIMMING,
      'swimming.open_water': WorkoutType.SWIMMING,
      yoga: WorkoutType.YOGA,
      strength_training: WorkoutType.STRENGTH_TRAINING,
      circuit_training: WorkoutType.HIIT,
      aerobics: WorkoutType.DANCE,
      tennis: WorkoutType.TENNIS,
      basketball: WorkoutType.BASKETBALL,
      football: WorkoutType.SOCCER,
      hiking: WorkoutType.HIKING,
      elliptical: WorkoutType.ELLIPTICAL,
      rowing: WorkoutType.ROWING,
    };

    return typeMap[activityName.toLowerCase()] || WorkoutType.OTHER;
  }

  private mapWorkoutTypeToGoogleFit(type: WorkoutType): string {
    const typeMap: Record<WorkoutType, string> = {
      [WorkoutType.RUNNING]: 'running',
      [WorkoutType.WALKING]: 'walking',
      [WorkoutType.CYCLING]: 'cycling',
      [WorkoutType.SWIMMING]: 'swimming',
      [WorkoutType.YOGA]: 'yoga',
      [WorkoutType.STRENGTH_TRAINING]: 'strength_training',
      [WorkoutType.HIIT]: 'circuit_training',
      [WorkoutType.DANCE]: 'aerobics',
      [WorkoutType.TENNIS]: 'tennis',
      [WorkoutType.BASKETBALL]: 'basketball',
      [WorkoutType.SOCCER]: 'football',
      [WorkoutType.HIKING]: 'hiking',
      [WorkoutType.ELLIPTICAL]: 'elliptical',
      [WorkoutType.ROWING]: 'rowing',
      [WorkoutType.OTHER]: 'other',
    };

    return typeMap[type];
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

export default new GoogleFitService();
