/**
 * Life Navigator - Bluetooth Low Energy Service
 *
 * Comprehensive BLE service for scanning, connecting, and managing health wearable devices
 */

import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import {
  WearableDevice,
  DeviceType,
  ConnectionStatus,
  SyncStatus,
  HealthDataType,
  BLE_UUIDS,
  BLEService,
  BLECharacteristic,
} from '../../types/wearables';

// ============================================================================
// Type Definitions
// ============================================================================

interface BluetoothServiceConfig {
  scanDurationMs?: number;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
}

interface ScanResult {
  device: Device;
  rssi: number;
  deviceType: DeviceType;
}

// ============================================================================
// Bluetooth Service Class
// ============================================================================

class BluetoothService {
  private manager: BleManager;
  private connectedDevices: Map<string, Device>;
  private deviceSubscriptions: Map<string, Subscription[]>;
  private scanSubscription?: Subscription;
  private isScanning: boolean;
  private config: BluetoothServiceConfig;

  // Event listeners
  private listeners: Map<string, Set<(data: any) => void>>;

  constructor(config: BluetoothServiceConfig = {}) {
    this.manager = new BleManager();
    this.connectedDevices = new Map();
    this.deviceSubscriptions = new Map();
    this.isScanning = false;
    this.listeners = new Map();

    this.config = {
      scanDurationMs: config.scanDurationMs || 10000,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelayMs: config.reconnectDelayMs || 3000,
    };

    this.initialize();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private async initialize(): Promise<void> {
    try {
      // Monitor Bluetooth state changes
      this.manager.onStateChange((state) => {
        console.log('Bluetooth state changed:', state);
        this.emit('stateChange', state);

        if (state === State.PoweredOn) {
          this.emit('ready', true);
        }
      }, true);
    } catch (error) {
      console.error('Failed to initialize Bluetooth service:', error);
    }
  }

  // ============================================================================
  // Permission Handling
  // ============================================================================

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          // Android 12+
          const bluetoothScan = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          const bluetoothConnect = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          const fineLocation = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

          return (
            bluetoothScan === RESULTS.GRANTED &&
            bluetoothConnect === RESULTS.GRANTED &&
            fineLocation === RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const fineLocation = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
        }
      } else if (Platform.OS === 'ios') {
        const bluetooth = await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
        return bluetooth === RESULTS.GRANTED;
      }

      return false;
    } catch (error) {
      console.error('Error requesting Bluetooth permissions:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          const bluetoothScan = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          const bluetoothConnect = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          const fineLocation = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

          return (
            bluetoothScan === RESULTS.GRANTED &&
            bluetoothConnect === RESULTS.GRANTED &&
            fineLocation === RESULTS.GRANTED
          );
        } else {
          const result = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return result;
        }
      } else if (Platform.OS === 'ios') {
        const bluetooth = await check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
        return bluetooth === RESULTS.GRANTED;
      }

      return false;
    } catch (error) {
      console.error('Error checking Bluetooth permissions:', error);
      return false;
    }
  }

  // ============================================================================
  // Device Scanning
  // ============================================================================

  async startScan(onDeviceFound: (device: WearableDevice) => void): Promise<void> {
    try {
      // Check Bluetooth state
      const state = await this.manager.state();
      if (state !== State.PoweredOn) {
        throw new Error('Bluetooth is not powered on');
      }

      // Check permissions
      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Bluetooth permissions not granted');
        }
      }

      // Stop any existing scan
      if (this.isScanning) {
        await this.stopScan();
      }

      this.isScanning = true;
      const discoveredDevices = new Set<string>();

      // Start scanning for devices with health-related services
      this.manager.startDeviceScan(
        [
          BLE_UUIDS.HEART_RATE_SERVICE,
          BLE_UUIDS.BATTERY_SERVICE,
          BLE_UUIDS.DEVICE_INFORMATION_SERVICE,
        ],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            this.isScanning = false;
            this.emit('scanError', error);
            return;
          }

          if (device && device.name && !discoveredDevices.has(device.id)) {
            discoveredDevices.add(device.id);

            const wearableDevice = this.deviceToWearable(device);
            onDeviceFound(wearableDevice);
            this.emit('deviceFound', wearableDevice);
          }
        }
      );

      // Auto-stop scan after configured duration
      setTimeout(() => {
        if (this.isScanning) {
          this.stopScan();
        }
      }, this.config.scanDurationMs);
    } catch (error) {
      console.error('Failed to start scan:', error);
      this.isScanning = false;
      throw error;
    }
  }

  async stopScan(): Promise<void> {
    try {
      if (this.isScanning) {
        await this.manager.stopDeviceScan();
        this.isScanning = false;
        this.emit('scanStopped', true);
      }
    } catch (error) {
      console.error('Failed to stop scan:', error);
    }
  }

  // ============================================================================
  // Device Connection
  // ============================================================================

  async connectToDevice(deviceId: string): Promise<WearableDevice> {
    try {
      // Connect to device
      const device = await this.manager.connectToDevice(deviceId, {
        autoConnect: this.config.autoReconnect,
        requestMTU: 512,
      });

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      // Store connected device
      this.connectedDevices.set(deviceId, device);

      // Setup monitoring for disconnection
      this.setupDisconnectionMonitoring(device);

      // Read device information
      const deviceInfo = await this.readDeviceInformation(device);

      // Create wearable device object
      const wearableDevice = this.deviceToWearable(device, deviceInfo);
      wearableDevice.connectionStatus = ConnectionStatus.CONNECTED;

      this.emit('deviceConnected', wearableDevice);

      // Start monitoring for data updates
      await this.startDataMonitoring(device);

      return wearableDevice;
    } catch (error) {
      console.error('Failed to connect to device:', error);
      throw error;
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      const device = this.connectedDevices.get(deviceId);

      if (device) {
        // Cancel all subscriptions for this device
        const subscriptions = this.deviceSubscriptions.get(deviceId) || [];
        subscriptions.forEach((sub) => sub.remove());
        this.deviceSubscriptions.delete(deviceId);

        // Disconnect device
        await this.manager.cancelDeviceConnection(deviceId);
        this.connectedDevices.delete(deviceId);

        this.emit('deviceDisconnected', deviceId);
      }
    } catch (error) {
      console.error('Failed to disconnect device:', error);
      throw error;
    }
  }

  // ============================================================================
  // Data Monitoring
  // ============================================================================

  private async startDataMonitoring(device: Device): Promise<void> {
    try {
      const subscriptions: Subscription[] = [];

      // Monitor heart rate if available
      const heartRateSub = device.monitorCharacteristicForService(
        BLE_UUIDS.HEART_RATE_SERVICE,
        BLE_UUIDS.HEART_RATE_MEASUREMENT,
        (error, characteristic) => {
          if (error) {
            console.error('Heart rate monitoring error:', error);
            return;
          }

          if (characteristic?.value) {
            const heartRate = this.parseHeartRate(characteristic.value);
            this.emit('heartRateUpdate', {
              deviceId: device.id,
              value: heartRate,
              timestamp: new Date(),
            });
          }
        }
      );

      subscriptions.push(heartRateSub);

      // Monitor battery level
      const batterySub = device.monitorCharacteristicForService(
        BLE_UUIDS.BATTERY_SERVICE,
        BLE_UUIDS.BATTERY_LEVEL,
        (error, characteristic) => {
          if (error) {
            console.error('Battery monitoring error:', error);
            return;
          }

          if (characteristic?.value) {
            const batteryLevel = this.parseBatteryLevel(characteristic.value);
            this.emit('batteryUpdate', {
              deviceId: device.id,
              value: batteryLevel,
            });
          }
        }
      );

      subscriptions.push(batterySub);

      this.deviceSubscriptions.set(device.id, subscriptions);
    } catch (error) {
      console.error('Failed to start data monitoring:', error);
    }
  }

  private setupDisconnectionMonitoring(device: Device): void {
    device.onDisconnected((error, disconnectedDevice) => {
      console.log('Device disconnected:', disconnectedDevice?.id);

      if (disconnectedDevice) {
        this.connectedDevices.delete(disconnectedDevice.id);
        this.emit('deviceDisconnected', disconnectedDevice.id);

        // Auto-reconnect if enabled
        if (this.config.autoReconnect) {
          setTimeout(() => {
            this.reconnectDevice(disconnectedDevice.id);
          }, this.config.reconnectDelayMs);
        }
      }
    });
  }

  private async reconnectDevice(deviceId: string): Promise<void> {
    try {
      console.log('Attempting to reconnect to device:', deviceId);
      await this.connectToDevice(deviceId);
    } catch (error) {
      console.error('Failed to reconnect to device:', error);
      this.emit('reconnectFailed', { deviceId, error });
    }
  }

  // ============================================================================
  // Device Information
  // ============================================================================

  private async readDeviceInformation(device: Device): Promise<Partial<WearableDevice>> {
    const info: Partial<WearableDevice> = {};

    try {
      // Read manufacturer name
      try {
        const manufacturerChar = await device.readCharacteristicForService(
          BLE_UUIDS.DEVICE_INFORMATION_SERVICE,
          BLE_UUIDS.MANUFACTURER_NAME
        );
        if (manufacturerChar.value) {
          info.manufacturer = this.base64ToString(manufacturerChar.value);
        }
      } catch (e) {
        console.log('Could not read manufacturer');
      }

      // Read model number
      try {
        const modelChar = await device.readCharacteristicForService(
          BLE_UUIDS.DEVICE_INFORMATION_SERVICE,
          BLE_UUIDS.MODEL_NUMBER
        );
        if (modelChar.value) {
          info.model = this.base64ToString(modelChar.value);
        }
      } catch (e) {
        console.log('Could not read model number');
      }

      // Read serial number
      try {
        const serialChar = await device.readCharacteristicForService(
          BLE_UUIDS.DEVICE_INFORMATION_SERVICE,
          BLE_UUIDS.SERIAL_NUMBER
        );
        if (serialChar.value) {
          info.serialNumber = this.base64ToString(serialChar.value);
        }
      } catch (e) {
        console.log('Could not read serial number');
      }

      // Read firmware version
      try {
        const firmwareChar = await device.readCharacteristicForService(
          BLE_UUIDS.DEVICE_INFORMATION_SERVICE,
          BLE_UUIDS.FIRMWARE_REVISION
        );
        if (firmwareChar.value) {
          info.firmwareVersion = this.base64ToString(firmwareChar.value);
        }
      } catch (e) {
        console.log('Could not read firmware version');
      }

      // Read battery level
      try {
        const batteryChar = await device.readCharacteristicForService(
          BLE_UUIDS.BATTERY_SERVICE,
          BLE_UUIDS.BATTERY_LEVEL
        );
        if (batteryChar.value) {
          info.batteryLevel = this.parseBatteryLevel(batteryChar.value);
        }
      } catch (e) {
        console.log('Could not read battery level');
      }
    } catch (error) {
      console.error('Error reading device information:', error);
    }

    return info;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private deviceToWearable(device: Device, additionalInfo?: Partial<WearableDevice>): WearableDevice {
    const deviceType = this.identifyDeviceType(device);
    const supportedDataTypes = this.getSupportedDataTypes(deviceType);

    return {
      id: device.id,
      name: device.name || 'Unknown Device',
      type: deviceType,
      connectionStatus: device.isConnected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED,
      connectionMethod: 'BLUETOOTH',
      signalStrength: device.rssi || undefined,
      syncStatus: SyncStatus.IDLE,
      supportedDataTypes,
      ...additionalInfo,
    };
  }

  private identifyDeviceType(device: Device): DeviceType {
    const name = device.name?.toLowerCase() || '';

    if (name.includes('fitbit')) return DeviceType.FITBIT;
    if (name.includes('garmin')) return DeviceType.GARMIN;
    if (name.includes('whoop')) return DeviceType.WHOOP;
    if (name.includes('oura')) return DeviceType.OURA_RING;
    if (name.includes('galaxy') || name.includes('samsung')) return DeviceType.SAMSUNG_GALAXY_WATCH;
    if (name.includes('watch')) return DeviceType.APPLE_WATCH;

    return DeviceType.GENERIC_HEART_RATE;
  }

  private getSupportedDataTypes(deviceType: DeviceType): HealthDataType[] {
    // Default supported data types for generic BLE devices
    const baseTypes = [HealthDataType.HEART_RATE];

    switch (deviceType) {
      case DeviceType.FITBIT:
      case DeviceType.GARMIN:
      case DeviceType.SAMSUNG_GALAXY_WATCH:
        return [
          ...baseTypes,
          HealthDataType.STEPS,
          HealthDataType.SLEEP,
          HealthDataType.WORKOUT,
          HealthDataType.ACTIVE_ENERGY,
        ];
      case DeviceType.WHOOP:
      case DeviceType.OURA_RING:
        return [
          ...baseTypes,
          HealthDataType.HEART_RATE_VARIABILITY,
          HealthDataType.SLEEP,
          HealthDataType.RESPIRATORY_RATE,
        ];
      default:
        return baseTypes;
    }
  }

  // Data parsing utilities
  private parseHeartRate(base64Value: string): number {
    const buffer = Buffer.from(base64Value, 'base64');
    const flags = buffer[0];
    const is16Bit = (flags & 0x01) === 1;

    if (is16Bit) {
      return buffer.readUInt16LE(1);
    } else {
      return buffer[1];
    }
  }

  private parseBatteryLevel(base64Value: string): number {
    const buffer = Buffer.from(base64Value, 'base64');
    return buffer[0];
  }

  private base64ToString(base64: string): string {
    return Buffer.from(base64, 'base64').toString('utf-8');
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

  async destroy(): Promise<void> {
    try {
      // Stop scanning
      await this.stopScan();

      // Disconnect all devices
      const disconnectPromises = Array.from(this.connectedDevices.keys()).map((deviceId) =>
        this.disconnectDevice(deviceId)
      );
      await Promise.all(disconnectPromises);

      // Clear all listeners
      this.listeners.clear();

      // Destroy BLE manager
      await this.manager.destroy();
    } catch (error) {
      console.error('Error destroying Bluetooth service:', error);
    }
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  getIsScanning(): boolean {
    return this.isScanning;
  }

  async getBluetoothState(): Promise<State> {
    return this.manager.state();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export default new BluetoothService();
