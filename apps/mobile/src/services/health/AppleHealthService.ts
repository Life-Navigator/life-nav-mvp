/**
 * Life Navigator - Apple Health Service
 *
 * iOS HealthKit integration for comprehensive health data synchronization
 */

import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
  HealthInputOptions,
  HealthObserver,
} from 'react-native-health';
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

interface AppleHealthConfig {
  autoSync?: boolean;
  syncIntervalMinutes?: number;
  backgroundSync?: boolean;
}

interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// ============================================================================
// Apple Health Service Class
// ============================================================================

class AppleHealthService {
  private isInitialized: boolean = false;
  private isAuthorized: boolean = false;
  private config: AppleHealthConfig;
  private syncInterval?: NodeJS.Timeout;
  private observers: Map<string, HealthObserver> = new Map();

  // Event listeners
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: AppleHealthConfig = {}) {
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
    if (Platform.OS !== 'ios') {
      console.log('Apple Health is only available on iOS');
      return false;
    }

    try {
      const isAvailable = await AppleHealthKit.isAvailable();
      this.isInitialized = isAvailable;
      return isAvailable;
    } catch (error) {
      console.error('Failed to initialize Apple Health:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Apple Health is not available on this device');
      }
    }

    try {
      // Define all permissions we want to request
      const permissions: HealthKitPermissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.RestingHeartRate,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
            AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
            AppleHealthKit.Constants.Permissions.FlightsClimbed,
            AppleHealthKit.Constants.Permissions.OxygenSaturation,
            AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
            AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
            AppleHealthKit.Constants.Permissions.BloodGlucose,
            AppleHealthKit.Constants.Permissions.BodyTemperature,
            AppleHealthKit.Constants.Permissions.RespiratoryRate,
            AppleHealthKit.Constants.Permissions.Vo2Max,
            AppleHealthKit.Constants.Permissions.Weight,
            AppleHealthKit.Constants.Permissions.BodyMassIndex,
            AppleHealthKit.Constants.Permissions.BodyFatPercentage,
            AppleHealthKit.Constants.Permissions.DietaryEnergy,
            AppleHealthKit.Constants.Permissions.DietaryWater,
            AppleHealthKit.Constants.Permissions.MindfulSession,
            AppleHealthKit.Constants.Permissions.StandTime,
            AppleHealthKit.Constants.Permissions.ExerciseTime,
          ],
          write: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.Weight,
            AppleHealthKit.Constants.Permissions.DietaryWater,
            AppleHealthKit.Constants.Permissions.Workout,
          ],
        },
      };

      await new Promise<void>((resolve, reject) => {
        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.error('Error requesting Apple Health permissions:', error);
            reject(new Error(error));
          } else {
            this.isAuthorized = true;
            this.emit('authorized', true);
            resolve();
          }
        });
      });

      // Start auto-sync if enabled
      if (this.config.autoSync) {
        this.startAutoSync();
      }

      return true;
    } catch (error) {
      console.error('Failed to authorize Apple Health:', error);
      return false;
    }
  }

  // ============================================================================
  // Data Reading Methods
  // ============================================================================

  async getSteps(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getDailyStepCountSamples(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const dataPoints: HealthDataPoint[] = results.map((result) => ({
          type: HealthDataType.STEPS,
          value: result.value,
          unit: 'count',
          startDate: new Date(result.startDate),
          endDate: new Date(result.endDate),
          source: 'Apple Health',
        }));

        resolve(dataPoints);
      });
    });
  }

  async getHeartRate(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getHeartRateSamples(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const dataPoints: HealthDataPoint[] = results.map((result) => ({
          type: HealthDataType.HEART_RATE,
          value: result.value,
          unit: 'bpm',
          startDate: new Date(result.startDate),
          endDate: new Date(result.endDate),
          source: 'Apple Health',
        }));

        resolve(dataPoints);
      });
    });
  }

  async getRestingHeartRate(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getRestingHeartRateSamples(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const dataPoints: HealthDataPoint[] = results.map((result) => ({
          type: HealthDataType.RESTING_HEART_RATE,
          value: result.value,
          unit: 'bpm',
          startDate: new Date(result.startDate),
          endDate: new Date(result.endDate),
          source: 'Apple Health',
        }));

        resolve(dataPoints);
      });
    });
  }

  async getHeartRateVariability(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getHeartRateVariabilitySamples(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const dataPoints: HealthDataPoint[] = results.map((result) => ({
          type: HealthDataType.HEART_RATE_VARIABILITY,
          value: result.value,
          unit: 'ms',
          startDate: new Date(result.startDate),
          endDate: new Date(result.endDate),
          source: 'Apple Health',
        }));

        resolve(dataPoints);
      });
    });
  }

  async getSleep(options: SyncOptions = {}): Promise<SleepData[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getSleepSamples(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const sleepData: SleepData[] = results.map((result) => {
          const startDate = new Date(result.startDate);
          const endDate = new Date(result.endDate);
          const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

          const stageMap: Record<string, 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM'> = {
            AWAKE: 'AWAKE',
            ASLEEP: 'LIGHT',
            INBED: 'LIGHT',
            CORE: 'LIGHT',
            DEEP: 'DEEP',
            REM: 'REM',
          };

          return {
            startDate,
            endDate,
            duration,
            stages: [
              {
                stage: stageMap[result.value] || 'LIGHT',
                startDate,
                endDate,
                duration,
              },
            ],
            source: 'Apple Health',
          };
        });

        resolve(sleepData);
      });
    });
  }

  async getWorkouts(options: SyncOptions = {}): Promise<WorkoutData[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getSamples(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const workouts: WorkoutData[] = results.map((result) => {
          const startDate = new Date(result.start);
          const endDate = new Date(result.end);
          const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

          return {
            type: this.mapWorkoutType(result.activityName),
            startDate,
            endDate,
            duration,
            distance: result.distance,
            calories: result.calories,
            source: 'Apple Health',
          };
        });

        resolve(workouts);
      });
    });
  }

  async getActiveEnergy(options: SyncOptions = {}): Promise<HealthDataPoint[]> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const opts: HealthInputOptions = {
        startDate: options.startDate?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.endDate?.toISOString() || new Date().toISOString(),
        limit: options.limit,
      };

      AppleHealthKit.getActiveEnergyBurned(opts, (err: string, results: any[]) => {
        if (err) {
          reject(new Error(err));
          return;
        }

        const dataPoints: HealthDataPoint[] = results.map((result) => ({
          type: HealthDataType.ACTIVE_ENERGY,
          value: result.value,
          unit: 'kcal',
          startDate: new Date(result.startDate),
          endDate: new Date(result.endDate),
          source: 'Apple Health',
        }));

        resolve(dataPoints);
      });
    });
  }

  // ============================================================================
  // Data Writing Methods
  // ============================================================================

  async saveSteps(value: number, startDate: Date, endDate: Date): Promise<boolean> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const options = {
        value,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.saveSteps(options, (err: string, result: any) => {
        if (err) {
          reject(new Error(err));
          return;
        }
        resolve(true);
      });
    });
  }

  async saveWorkout(workout: WorkoutData): Promise<boolean> {
    this.ensureAuthorized();

    return new Promise((resolve, reject) => {
      const options = {
        type: this.mapWorkoutTypeToHealthKit(workout.type),
        startDate: workout.startDate.toISOString(),
        endDate: workout.endDate.toISOString(),
        energyBurned: workout.calories,
        distance: workout.distance,
      };

      AppleHealthKit.saveWorkout(options, (err: string, result: any) => {
        if (err) {
          reject(new Error(err));
          return;
        }
        resolve(true);
      });
    });
  }

  // ============================================================================
  // Background Sync
  // ============================================================================

  async setupBackgroundSync(): Promise<void> {
    if (Platform.OS !== 'ios' || !this.config.backgroundSync) {
      return;
    }

    try {
      // Setup observers for real-time updates
      this.setupObserver('Steps', AppleHealthKit.Constants.Permissions.Steps);
      this.setupObserver('HeartRate', AppleHealthKit.Constants.Permissions.HeartRate);
      this.setupObserver('Sleep', AppleHealthKit.Constants.Permissions.SleepAnalysis);
    } catch (error) {
      console.error('Failed to setup background sync:', error);
    }
  }

  private setupObserver(name: string, permission: any): void {
    const observer = AppleHealthKit.setObserver({ type: permission });

    observer.on('change', () => {
      console.log(`${name} data changed`);
      this.emit('dataChanged', { type: name });
    });

    this.observers.set(name, observer);
  }

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
      platform: PlatformType.APPLE_HEALTH,
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
      HealthDataType.HEART_RATE_VARIABILITY,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.WORKOUT,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.RESTING_ENERGY,
      HealthDataType.DISTANCE,
      HealthDataType.FLOORS_CLIMBED,
      HealthDataType.BLOOD_OXYGEN,
      HealthDataType.VO2_MAX,
      HealthDataType.WEIGHT,
      HealthDataType.BODY_MASS_INDEX,
      HealthDataType.BODY_FAT_PERCENTAGE,
      HealthDataType.NUTRITION,
      HealthDataType.HYDRATION,
      HealthDataType.MINDFULNESS,
      HealthDataType.STAND_TIME,
      HealthDataType.EXERCISE_TIME,
    ];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private ensureAuthorized(): void {
    if (!this.isAuthorized) {
      throw new Error('Apple Health is not authorized. Call requestAuthorization() first.');
    }
  }

  private mapWorkoutType(activityName: string): WorkoutType {
    const typeMap: Record<string, WorkoutType> = {
      Running: WorkoutType.RUNNING,
      Walking: WorkoutType.WALKING,
      Cycling: WorkoutType.CYCLING,
      Swimming: WorkoutType.SWIMMING,
      Yoga: WorkoutType.YOGA,
      'Strength Training': WorkoutType.STRENGTH_TRAINING,
      HIIT: WorkoutType.HIIT,
      Dance: WorkoutType.DANCE,
      Tennis: WorkoutType.TENNIS,
      Basketball: WorkoutType.BASKETBALL,
      Soccer: WorkoutType.SOCCER,
      Hiking: WorkoutType.HIKING,
      Elliptical: WorkoutType.ELLIPTICAL,
      Rowing: WorkoutType.ROWING,
    };

    return typeMap[activityName] || WorkoutType.OTHER;
  }

  private mapWorkoutTypeToHealthKit(type: WorkoutType): string {
    const typeMap: Record<WorkoutType, string> = {
      [WorkoutType.RUNNING]: 'Running',
      [WorkoutType.WALKING]: 'Walking',
      [WorkoutType.CYCLING]: 'Cycling',
      [WorkoutType.SWIMMING]: 'Swimming',
      [WorkoutType.YOGA]: 'Yoga',
      [WorkoutType.STRENGTH_TRAINING]: 'TraditionalStrengthTraining',
      [WorkoutType.HIIT]: 'HighIntensityIntervalTraining',
      [WorkoutType.DANCE]: 'Dance',
      [WorkoutType.TENNIS]: 'Tennis',
      [WorkoutType.BASKETBALL]: 'Basketball',
      [WorkoutType.SOCCER]: 'Soccer',
      [WorkoutType.HIKING]: 'Hiking',
      [WorkoutType.ELLIPTICAL]: 'Elliptical',
      [WorkoutType.ROWING]: 'Rowing',
      [WorkoutType.OTHER]: 'Other',
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
    this.observers.forEach((observer) => observer.removeAllListeners());
    this.observers.clear();
    this.listeners.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export default new AppleHealthService();
