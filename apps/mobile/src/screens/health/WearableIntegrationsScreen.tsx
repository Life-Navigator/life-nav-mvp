/**
 * Life Navigator - Wearable Integrations Screen
 *
 * Comprehensive screen for managing health wearable integrations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppleHealthService from '../../services/health/AppleHealthService';
import GoogleFitService from '../../services/health/GoogleFitService';
import BluetoothService from '../../services/bluetooth/BluetoothService';
import DataSyncService from '../../services/health/DataSyncService';
import {
  WearableDevice,
  DeviceType,
  ConnectionStatus,
  SyncStatus,
  PlatformIntegration,
  SUPPORTED_DEVICES,
  SupportedDevice,
  HealthDataType,
} from '../../types/wearables';
import colors from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';

// ============================================================================
// Types
// ============================================================================

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

// ============================================================================
// Main Component
// ============================================================================

const WearableIntegrationsScreen: React.FC = () => {
  // Platform integrations state
  const [appleHealthStatus, setAppleHealthStatus] = useState<PlatformIntegration | null>(null);
  const [googleFitStatus, setGoogleFitStatus] = useState<PlatformIntegration | null>(null);

  // Bluetooth devices state
  const [discoveredDevices, setDiscoveredDevices] = useState<WearableDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<WearableDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // ============================================================================
  // Initialization
  // ============================================================================

  useEffect(() => {
    loadIntegrationStatus();
    setupEventListeners();

    return () => {
      cleanupEventListeners();
    };
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      // Load Apple Health status (iOS only)
      if (Platform.OS === 'ios') {
        const status = await AppleHealthService.getIntegrationStatus();
        setAppleHealthStatus(status);
      }

      // Load Google Fit status (Android only)
      if (Platform.OS === 'android') {
        const status = await GoogleFitService.getIntegrationStatus();
        setGoogleFitStatus(status);
      }

      // Load last sync time
      const lastSync = DataSyncService.getLastSyncTime();
      setLastSyncTime(lastSync);
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
  };

  const setupEventListeners = () => {
    // Bluetooth events
    BluetoothService.on('deviceFound', handleDeviceFound);
    BluetoothService.on('deviceConnected', handleDeviceConnected);
    BluetoothService.on('deviceDisconnected', handleDeviceDisconnected);
    BluetoothService.on('scanStopped', handleScanStopped);

    // Sync events
    DataSyncService.on('syncCompleted', handleSyncCompleted);
    DataSyncService.on('syncError', handleSyncError);
  };

  const cleanupEventListeners = () => {
    // Remove all listeners
    BluetoothService.off('deviceFound', handleDeviceFound);
    BluetoothService.off('deviceConnected', handleDeviceConnected);
    BluetoothService.off('deviceDisconnected', handleDeviceDisconnected);
    BluetoothService.off('scanStopped', handleScanStopped);
    DataSyncService.off('syncCompleted', handleSyncCompleted);
    DataSyncService.off('syncError', handleSyncError);
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleDeviceFound = (device: WearableDevice) => {
    setDiscoveredDevices((prev) => {
      const exists = prev.find((d) => d.id === device.id);
      if (exists) return prev;
      return [...prev, device];
    });
  };

  const handleDeviceConnected = (device: WearableDevice) => {
    setConnectedDevices((prev) => {
      const exists = prev.find((d) => d.id === device.id);
      if (exists) return prev;
      return [...prev, device];
    });

    // Remove from discovered devices
    setDiscoveredDevices((prev) => prev.filter((d) => d.id !== device.id));

    showToast('success', `Connected to ${device.name}`);
  };

  const handleDeviceDisconnected = (deviceId: string) => {
    setConnectedDevices((prev) => prev.filter((d) => d.id !== deviceId));
    showToast('info', 'Device disconnected');
  };

  const handleScanStopped = () => {
    setIsScanning(false);
  };

  const handleSyncCompleted = (session: any) => {
    setIsSyncing(false);
    setLastSyncTime(new Date());
    showToast('success', `Synced ${session.totalRecordsSynced} records`);
  };

  const handleSyncError = (data: any) => {
    setIsSyncing(false);
    showToast('error', 'Sync failed. Please try again.');
  };

  // ============================================================================
  // Platform Integration Actions
  // ============================================================================

  const connectAppleHealth = async () => {
    try {
      const success = await AppleHealthService.requestAuthorization();
      if (success) {
        await loadIntegrationStatus();
        showToast('success', 'Connected to Apple Health');
      } else {
        showToast('error', 'Failed to connect to Apple Health');
      }
    } catch (error) {
      console.error('Failed to connect to Apple Health:', error);
      showToast('error', 'Failed to connect to Apple Health');
    }
  };

  const connectGoogleFit = async () => {
    try {
      const success = await GoogleFitService.requestAuthorization();
      if (success) {
        await loadIntegrationStatus();
        showToast('success', 'Connected to Google Fit');
      } else {
        showToast('error', 'Failed to connect to Google Fit');
      }
    } catch (error) {
      console.error('Failed to connect to Google Fit:', error);
      showToast('error', 'Failed to connect to Google Fit');
    }
  };

  const disconnectAppleHealth = () => {
    Alert.alert(
      'Disconnect Apple Health',
      'Are you sure you want to disconnect Apple Health? You will need to reconnect to sync data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            AppleHealthService.destroy();
            loadIntegrationStatus();
            showToast('info', 'Disconnected from Apple Health');
          },
        },
      ]
    );
  };

  const disconnectGoogleFit = async () => {
    Alert.alert(
      'Disconnect Google Fit',
      'Are you sure you want to disconnect Google Fit? You will need to reconnect to sync data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await GoogleFitService.disconnect();
            await loadIntegrationStatus();
            showToast('info', 'Disconnected from Google Fit');
          },
        },
      ]
    );
  };

  // ============================================================================
  // Bluetooth Actions
  // ============================================================================

  const startScan = async () => {
    try {
      setIsScanning(true);
      setDiscoveredDevices([]);
      await BluetoothService.startScan((device) => {
        // Devices are handled by the event listener
      });
    } catch (error) {
      console.error('Failed to start scan:', error);
      setIsScanning(false);
      showToast('error', 'Failed to scan for devices');
    }
  };

  const stopScan = async () => {
    try {
      await BluetoothService.stopScan();
      setIsScanning(false);
    } catch (error) {
      console.error('Failed to stop scan:', error);
    }
  };

  const connectToDevice = async (deviceId: string) => {
    try {
      await BluetoothService.connectToDevice(deviceId);
    } catch (error) {
      console.error('Failed to connect to device:', error);
      showToast('error', 'Failed to connect to device');
    }
  };

  const disconnectDevice = async (deviceId: string) => {
    try {
      await BluetoothService.disconnectDevice(deviceId);
    } catch (error) {
      console.error('Failed to disconnect device:', error);
      showToast('error', 'Failed to disconnect device');
    }
  };

  // ============================================================================
  // Sync Actions
  // ============================================================================

  const syncNow = async () => {
    try {
      setIsSyncing(true);
      await DataSyncService.syncAll();
    } catch (error) {
      console.error('Sync failed:', error);
      setIsSyncing(false);
      showToast('error', 'Sync failed');
    }
  };

  // ============================================================================
  // UI Helpers
  // ============================================================================

  const showToast = (type: ToastMessage['type'], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIntegrationStatus();
    setRefreshing(false);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const formatLastSyncTime = (date?: Date): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // ============================================================================
  // Render Methods
  // ============================================================================

  const renderPlatformIntegrations = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Platform Integrations</Text>

      {Platform.OS === 'ios' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: appleHealthStatus?.isAuthorized
                      ? colors.semantic.success
                      : colors.gray[400],
                  },
                ]}
              />
              <Text style={styles.cardTitle}>Apple Health</Text>
            </View>
            {appleHealthStatus?.isAuthorized && (
              <TouchableOpacity onPress={() => toggleSection('appleHealth')}>
                <Text style={styles.expandButton}>
                  {expandedSection === 'appleHealth' ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.cardSubtitle}>
            {appleHealthStatus?.isAuthorized
              ? `Last synced: ${formatLastSyncTime(appleHealthStatus.lastSyncTime)}`
              : 'Connect to sync health data'}
          </Text>

          {expandedSection === 'appleHealth' && appleHealthStatus?.isAuthorized && (
            <View style={styles.expandedContent}>
              <Text style={styles.dataTypesLabel}>Syncing:</Text>
              <Text style={styles.dataTypesList}>
                Steps, Heart Rate, Sleep, Workouts, Active Energy, and more
              </Text>
            </View>
          )}

          <View style={styles.cardActions}>
            {appleHealthStatus?.isAuthorized ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={syncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.primary.blue} />
                  ) : (
                    <Text style={styles.buttonSecondaryText}>Sync Now</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonDanger]}
                  onPress={disconnectAppleHealth}
                >
                  <Text style={styles.buttonDangerText}>Disconnect</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={connectAppleHealth}>
                <Text style={styles.buttonPrimaryText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {Platform.OS === 'android' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: googleFitStatus?.isAuthorized
                      ? colors.semantic.success
                      : colors.gray[400],
                  },
                ]}
              />
              <Text style={styles.cardTitle}>Google Fit</Text>
            </View>
            {googleFitStatus?.isAuthorized && (
              <TouchableOpacity onPress={() => toggleSection('googleFit')}>
                <Text style={styles.expandButton}>
                  {expandedSection === 'googleFit' ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.cardSubtitle}>
            {googleFitStatus?.isAuthorized
              ? `Last synced: ${formatLastSyncTime(googleFitStatus.lastSyncTime)}`
              : 'Connect to sync fitness data'}
          </Text>

          {expandedSection === 'googleFit' && googleFitStatus?.isAuthorized && (
            <View style={styles.expandedContent}>
              <Text style={styles.dataTypesLabel}>Syncing:</Text>
              <Text style={styles.dataTypesList}>
                Steps, Heart Rate, Sleep, Workouts, Calories, Distance, and more
              </Text>
            </View>
          )}

          <View style={styles.cardActions}>
            {googleFitStatus?.isAuthorized ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={syncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.primary.blue} />
                  ) : (
                    <Text style={styles.buttonSecondaryText}>Sync Now</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonDanger]}
                  onPress={disconnectGoogleFit}
                >
                  <Text style={styles.buttonDangerText}>Disconnect</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={connectGoogleFit}>
                <Text style={styles.buttonPrimaryText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );

  const renderBluetoothDevices = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bluetooth Devices</Text>
        {isScanning ? (
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={stopScan}>
            <ActivityIndicator size="small" color={colors.primary.blue} style={{ marginRight: spacing[2] }} />
            <Text style={styles.buttonSecondaryText}>Stop Scan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={startScan}>
            <Text style={styles.buttonPrimaryText}>Scan for Devices</Text>
          </TouchableOpacity>
        )}
      </View>

      {connectedDevices.length > 0 && (
        <>
          <Text style={styles.subsectionTitle}>Connected Devices</Text>
          {connectedDevices.map((device) => (
            <View key={device.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <View style={[styles.statusDot, { backgroundColor: colors.semantic.success }]} />
                  <Text style={styles.cardTitle}>{device.name}</Text>
                </View>
                {device.batteryLevel && (
                  <Text style={styles.batteryLevel}>{device.batteryLevel}%</Text>
                )}
              </View>

              <Text style={styles.cardSubtitle}>
                {device.type} • Last synced: {formatLastSyncTime(device.lastSyncTime)}
              </Text>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={syncNow}
                  disabled={isSyncing}
                >
                  <Text style={styles.buttonSecondaryText}>Sync Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonDanger]}
                  onPress={() => disconnectDevice(device.id)}
                >
                  <Text style={styles.buttonDangerText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {discoveredDevices.length > 0 && (
        <>
          <Text style={styles.subsectionTitle}>Discovered Devices</Text>
          {discoveredDevices.map((device) => (
            <View key={device.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <View style={[styles.statusDot, { backgroundColor: colors.gray[400] }]} />
                  <Text style={styles.cardTitle}>{device.name}</Text>
                </View>
                {device.signalStrength && (
                  <Text style={styles.signalStrength}>
                    {Math.max(0, Math.min(100, (device.signalStrength + 100) * 2))}%
                  </Text>
                )}
              </View>

              <Text style={styles.cardSubtitle}>{device.type}</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() => connectToDevice(device.id)}
                >
                  <Text style={styles.buttonPrimaryText}>Connect</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {!isScanning && discoveredDevices.length === 0 && connectedDevices.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No devices found</Text>
          <Text style={styles.emptyStateSubtext}>Tap "Scan for Devices" to discover nearby wearables</Text>
        </View>
      )}
    </View>
  );

  const renderSupportedDevices = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Supported Devices</Text>
      {SUPPORTED_DEVICES.map((device, index) => (
        <View key={index} style={styles.supportedDeviceCard}>
          <View style={styles.supportedDeviceHeader}>
            <Text style={styles.supportedDeviceName}>{device.name}</Text>
            <Text style={styles.supportedDeviceMethod}>
              {device.connectionMethod === 'PLATFORM_API'
                ? Platform.OS === 'ios'
                  ? 'Apple Health'
                  : 'Platform'
                : device.connectionMethod === 'BLUETOOTH'
                ? 'Bluetooth'
                : 'OAuth'}
            </Text>
          </View>
          <Text style={styles.supportedDeviceDescription}>{device.description}</Text>
          {device.models.length > 0 && (
            <Text style={styles.supportedDeviceModels}>Models: {device.models.slice(0, 3).join(', ')}</Text>
          )}
        </View>
      ))}
    </View>
  );

  const renderToast = () => {
    if (!toast) return null;

    const backgroundColor =
      toast.type === 'success'
        ? colors.semantic.success
        : toast.type === 'error'
        ? colors.semantic.error
        : colors.semantic.info;

    return (
      <View style={[styles.toast, { backgroundColor }]}>
        <Text style={styles.toastText}>{toast.message}</Text>
      </View>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wearable Integrations</Text>
        <Text style={styles.headerSubtitle}>Connect your health devices and platforms</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderPlatformIntegrations()}
        {renderBluetoothDevices()}
        {renderSupportedDevices()}
      </ScrollView>

      {renderToast()}
    </SafeAreaView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  headerSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  subsectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.secondary,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  card: {
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
  },
  cardTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
  },
  cardSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  expandButton: {
    ...textStyles.body,
    color: colors.primary.blue,
  },
  expandedContent: {
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginTop: spacing[2],
  },
  dataTypesLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  dataTypesList: {
    ...textStyles.bodySmall,
    color: colors.text.light.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary.blue,
  },
  buttonPrimaryText: {
    ...textStyles.button,
    color: colors.text.light.inverse,
  },
  buttonSecondary: {
    backgroundColor: colors.light.tertiary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  buttonSecondaryText: {
    ...textStyles.button,
    color: colors.primary.blue,
  },
  buttonDanger: {
    backgroundColor: colors.semantic.error,
  },
  buttonDangerText: {
    ...textStyles.button,
    color: colors.text.light.inverse,
  },
  batteryLevel: {
    ...textStyles.labelSmall,
    color: colors.semantic.success,
  },
  signalStrength: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  supportedDeviceCard: {
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  supportedDeviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  supportedDeviceName: {
    ...textStyles.label,
    color: colors.text.light.primary,
  },
  supportedDeviceMethod: {
    ...textStyles.labelSmall,
    color: colors.primary.blue,
  },
  supportedDeviceDescription: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  supportedDeviceModels: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyStateText: {
    ...textStyles.h4,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  emptyStateSubtext: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  toast: {
    position: 'absolute',
    bottom: spacing[4],
    left: spacing[4],
    right: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    ...shadows.lg,
  },
  toastText: {
    ...textStyles.body,
    color: colors.text.light.inverse,
    textAlign: 'center',
  },
});

export default WearableIntegrationsScreen;
