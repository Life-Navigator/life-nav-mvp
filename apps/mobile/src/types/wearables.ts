/**
 * Life Navigator - Wearable Integration Types
 *
 * Comprehensive TypeScript types for health wearable devices and data
 */

// ============================================================================
// Device Types
// ============================================================================

export enum DeviceType {
  APPLE_WATCH = 'APPLE_WATCH',
  FITBIT = 'FITBIT',
  GARMIN = 'GARMIN',
  WHOOP = 'WHOOP',
  OURA_RING = 'OURA_RING',
  SAMSUNG_GALAXY_WATCH = 'SAMSUNG_GALAXY_WATCH',
  GENERIC_HEART_RATE = 'GENERIC_HEART_RATE',
  UNKNOWN = 'UNKNOWN',
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  ERROR = 'ERROR',
}

export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  NEVER_SYNCED = 'NEVER_SYNCED',
}

export interface WearableDevice {
  id: string;
  name: string;
  type: DeviceType;
  connectionStatus: ConnectionStatus;
  connectionMethod: 'BLUETOOTH' | 'PLATFORM_API' | 'OAUTH';
  batteryLevel?: number;
  signalStrength?: number; // RSSI for Bluetooth devices
  lastSyncTime?: Date;
  syncStatus: SyncStatus;
  firmwareVersion?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  supportedDataTypes: HealthDataType[];
}

// ============================================================================
// Health Data Types
// ============================================================================

export enum HealthDataType {
  STEPS = 'STEPS',
  HEART_RATE = 'HEART_RATE',
  HEART_RATE_VARIABILITY = 'HEART_RATE_VARIABILITY',
  RESTING_HEART_RATE = 'RESTING_HEART_RATE',
  SLEEP = 'SLEEP',
  SLEEP_ANALYSIS = 'SLEEP_ANALYSIS',
  WORKOUT = 'WORKOUT',
  ACTIVE_ENERGY = 'ACTIVE_ENERGY',
  RESTING_ENERGY = 'RESTING_ENERGY',
  DISTANCE = 'DISTANCE',
  FLOORS_CLIMBED = 'FLOORS_CLIMBED',
  BLOOD_OXYGEN = 'BLOOD_OXYGEN',
  BLOOD_PRESSURE = 'BLOOD_PRESSURE',
  BLOOD_GLUCOSE = 'BLOOD_GLUCOSE',
  BODY_TEMPERATURE = 'BODY_TEMPERATURE',
  RESPIRATORY_RATE = 'RESPIRATORY_RATE',
  VO2_MAX = 'VO2_MAX',
  WEIGHT = 'WEIGHT',
  BODY_MASS_INDEX = 'BODY_MASS_INDEX',
  BODY_FAT_PERCENTAGE = 'BODY_FAT_PERCENTAGE',
  NUTRITION = 'NUTRITION',
  HYDRATION = 'HYDRATION',
  MINDFULNESS = 'MINDFULNESS',
  STAND_TIME = 'STAND_TIME',
  EXERCISE_TIME = 'EXERCISE_TIME',
}

export interface HealthDataPoint {
  type: HealthDataType;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  source: string; // Device ID or platform name
  metadata?: Record<string, any>;
}

export interface SleepData {
  startDate: Date;
  endDate: Date;
  duration: number; // minutes
  stages: SleepStage[];
  quality?: number; // 0-100
  source: string;
}

export interface SleepStage {
  stage: 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM';
  startDate: Date;
  endDate: Date;
  duration: number; // minutes
}

export interface WorkoutData {
  type: WorkoutType;
  startDate: Date;
  endDate: Date;
  duration: number; // minutes
  distance?: number; // meters
  calories?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  elevation?: number; // meters
  source: string;
  metadata?: Record<string, any>;
}

export enum WorkoutType {
  RUNNING = 'RUNNING',
  WALKING = 'WALKING',
  CYCLING = 'CYCLING',
  SWIMMING = 'SWIMMING',
  YOGA = 'YOGA',
  STRENGTH_TRAINING = 'STRENGTH_TRAINING',
  HIIT = 'HIIT',
  DANCE = 'DANCE',
  TENNIS = 'TENNIS',
  BASKETBALL = 'BASKETBALL',
  SOCCER = 'SOCCER',
  HIKING = 'HIKING',
  ELLIPTICAL = 'ELLIPTICAL',
  ROWING = 'ROWING',
  OTHER = 'OTHER',
}

// ============================================================================
// Platform Integration Types
// ============================================================================

export enum PlatformType {
  APPLE_HEALTH = 'APPLE_HEALTH',
  GOOGLE_FIT = 'GOOGLE_FIT',
}

export interface PlatformIntegration {
  platform: PlatformType;
  isConnected: boolean;
  isAuthorized: boolean;
  lastSyncTime?: Date;
  syncStatus: SyncStatus;
  authorizedDataTypes: HealthDataType[];
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
}

// ============================================================================
// Bluetooth BLE Types
// ============================================================================

export interface BLECharacteristic {
  uuid: string;
  serviceUUID: string;
  isReadable: boolean;
  isWritable: boolean;
  isNotifying: boolean;
  value?: string;
}

export interface BLEService {
  uuid: string;
  isPrimary: boolean;
  characteristics: BLECharacteristic[];
}

// Standard Bluetooth UUIDs for health devices
export const BLE_UUIDS = {
  // Services
  HEART_RATE_SERVICE: '0000180d-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  DEVICE_INFORMATION_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',

  // Characteristics
  HEART_RATE_MEASUREMENT: '00002a37-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL: '00002a19-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME: '00002a29-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER: '00002a24-0000-1000-8000-00805f9b34fb',
  SERIAL_NUMBER: '00002a25-0000-1000-8000-00805f9b34fb',
  FIRMWARE_REVISION: '00002a26-0000-1000-8000-00805f9b34fb',

  // Device-specific UUIDs
  FITBIT: {
    SERVICE: '0000adab-0000-1000-8000-00805f9b34fb',
  },
  GARMIN: {
    SERVICE: '0000fe26-0000-1000-8000-00805f9b34fb',
  },
  WHOOP: {
    SERVICE: '0000fe26-0000-1000-8000-00805f9b34fb',
  },
  OURA: {
    SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  },
} as const;

// ============================================================================
// Sync and Settings Types
// ============================================================================

export interface SyncSettings {
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number; // 15, 30, 60, 120, 240
  backgroundSyncEnabled: boolean;
  wifiOnlySync: boolean;
  dataSources: {
    appleHealth: boolean;
    googleFit: boolean;
    bluetoothDevices: boolean;
  };
}

export interface DataSyncResult {
  success: boolean;
  dataType: HealthDataType;
  source: string;
  recordCount: number;
  startDate: Date;
  endDate: Date;
  error?: string;
}

export interface SyncSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  status: SyncStatus;
  results: DataSyncResult[];
  totalRecordsSynced: number;
  errors: string[];
}

// ============================================================================
// Device Configuration Types
// ============================================================================

export interface SupportedDevice {
  type: DeviceType;
  name: string;
  manufacturer: string;
  models: string[];
  connectionMethod: 'BLUETOOTH' | 'PLATFORM_API' | 'OAUTH';
  supportedDataTypes: HealthDataType[];
  iconName: string;
  description: string;
  requiresApp?: boolean;
  officialAppName?: string;
}

export const SUPPORTED_DEVICES: SupportedDevice[] = [
  {
    type: DeviceType.APPLE_WATCH,
    name: 'Apple Watch',
    manufacturer: 'Apple',
    models: ['Series 3', 'Series 4', 'Series 5', 'Series 6', 'Series 7', 'Series 8', 'Series 9', 'Ultra', 'Ultra 2', 'SE'],
    connectionMethod: 'PLATFORM_API',
    supportedDataTypes: [
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
      HealthDataType.MINDFULNESS,
      HealthDataType.STAND_TIME,
      HealthDataType.EXERCISE_TIME,
    ],
    iconName: 'watch',
    description: 'Sync via Apple Health (iOS only)',
  },
  {
    type: DeviceType.FITBIT,
    name: 'Fitbit',
    manufacturer: 'Fitbit (Google)',
    models: ['Charge 5', 'Charge 6', 'Versa 4', 'Sense 2', 'Inspire 3', 'Luxe'],
    connectionMethod: 'BLUETOOTH',
    supportedDataTypes: [
      HealthDataType.STEPS,
      HealthDataType.HEART_RATE,
      HealthDataType.HEART_RATE_VARIABILITY,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.WORKOUT,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.DISTANCE,
      HealthDataType.FLOORS_CLIMBED,
      HealthDataType.BLOOD_OXYGEN,
      HealthDataType.VO2_MAX,
    ],
    iconName: 'fitness',
    description: 'Direct Bluetooth connection',
    requiresApp: true,
    officialAppName: 'Fitbit',
  },
  {
    type: DeviceType.GARMIN,
    name: 'Garmin',
    manufacturer: 'Garmin',
    models: ['Forerunner', 'Fenix 7', 'Fenix 8', 'Venu 3', 'Vivoactive 5', 'Epix'],
    connectionMethod: 'BLUETOOTH',
    supportedDataTypes: [
      HealthDataType.STEPS,
      HealthDataType.HEART_RATE,
      HealthDataType.HEART_RATE_VARIABILITY,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.WORKOUT,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.DISTANCE,
      HealthDataType.FLOORS_CLIMBED,
      HealthDataType.BLOOD_OXYGEN,
      HealthDataType.RESPIRATORY_RATE,
      HealthDataType.VO2_MAX,
    ],
    iconName: 'fitness',
    description: 'Direct Bluetooth connection',
    requiresApp: true,
    officialAppName: 'Garmin Connect',
  },
  {
    type: DeviceType.WHOOP,
    name: 'Whoop 4.0',
    manufacturer: 'Whoop',
    models: ['4.0'],
    connectionMethod: 'BLUETOOTH',
    supportedDataTypes: [
      HealthDataType.HEART_RATE,
      HealthDataType.HEART_RATE_VARIABILITY,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.WORKOUT,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.RESPIRATORY_RATE,
      HealthDataType.BLOOD_OXYGEN,
    ],
    iconName: 'fitness',
    description: 'Direct Bluetooth connection',
    requiresApp: true,
    officialAppName: 'Whoop',
  },
  {
    type: DeviceType.OURA_RING,
    name: 'Oura Ring',
    manufacturer: 'Oura',
    models: ['Generation 3', 'Generation 4'],
    connectionMethod: 'BLUETOOTH',
    supportedDataTypes: [
      HealthDataType.HEART_RATE,
      HealthDataType.HEART_RATE_VARIABILITY,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.SLEEP_ANALYSIS,
      HealthDataType.STEPS,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.BODY_TEMPERATURE,
      HealthDataType.RESPIRATORY_RATE,
    ],
    iconName: 'fitness',
    description: 'Direct Bluetooth connection',
    requiresApp: true,
    officialAppName: 'Oura',
  },
  {
    type: DeviceType.SAMSUNG_GALAXY_WATCH,
    name: 'Samsung Galaxy Watch',
    manufacturer: 'Samsung',
    models: ['Galaxy Watch 6', 'Galaxy Watch 6 Classic', 'Galaxy Watch 5', 'Galaxy Watch 4'],
    connectionMethod: 'BLUETOOTH',
    supportedDataTypes: [
      HealthDataType.STEPS,
      HealthDataType.HEART_RATE,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.SLEEP,
      HealthDataType.WORKOUT,
      HealthDataType.ACTIVE_ENERGY,
      HealthDataType.DISTANCE,
      HealthDataType.FLOORS_CLIMBED,
      HealthDataType.BLOOD_OXYGEN,
      HealthDataType.BODY_TEMPERATURE,
    ],
    iconName: 'watch',
    description: 'Direct Bluetooth connection',
  },
  {
    type: DeviceType.GENERIC_HEART_RATE,
    name: 'Heart Rate Monitor',
    manufacturer: 'Generic',
    models: ['BLE Heart Rate Monitors'],
    connectionMethod: 'BLUETOOTH',
    supportedDataTypes: [HealthDataType.HEART_RATE],
    iconName: 'heart',
    description: 'Any Bluetooth heart rate monitor',
  },
];

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface WearableSyncRequest {
  userId: string;
  deviceId: string;
  deviceType: DeviceType;
  data: HealthDataPoint[];
  syncTimestamp: Date;
}

export interface WearableSyncResponse {
  success: boolean;
  recordsProcessed: number;
  message?: string;
  errors?: string[];
}
