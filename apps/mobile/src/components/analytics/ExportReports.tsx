/**
 * Life Navigator - Export & Reports Component
 *
 * Export analytics and schedule reports
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { exportAnalyticsPDF, exportAnalyticsCSV, scheduleReport } from '../../api/analytics';

interface ExportReportsProps {
  onExportComplete?: () => void;
}

export const ExportReports: React.FC<ExportReportsProps> = ({ onExportComplete }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'csv' | null>(null);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      setExportType('pdf');

      const response = await exportAnalyticsPDF();

      // Save to device
      const fileUri = `${FileSystem.documentDirectory}analytics_report_${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, response as any, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Analytics Report',
        });
      }

      Alert.alert('Success', 'Analytics report exported successfully!');
      onExportComplete?.();
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Failed to export PDF report');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      setExportType('csv');

      const response = await exportAnalyticsCSV();

      // Save to device
      const fileUri = `${FileSystem.documentDirectory}analytics_data_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, response as any, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Analytics Data',
        });
      }

      Alert.alert('Success', 'Analytics data exported successfully!');
      onExportComplete?.();
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Failed to export CSV data');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleScheduleReport = async (frequency: 'daily' | 'weekly' | 'monthly') => {
    try {
      await scheduleReport({
        frequency,
        format: 'pdf',
      });

      Alert.alert(
        'Report Scheduled',
        `You will receive ${frequency} analytics reports via email.`
      );
    } catch (error: any) {
      Alert.alert('Schedule Failed', error.message || 'Failed to schedule report');
    }
  };

  const showScheduleOptions = () => {
    Alert.alert(
      'Schedule Reports',
      'Choose report frequency',
      [
        {
          text: 'Daily',
          onPress: () => handleScheduleReport('daily'),
        },
        {
          text: 'Weekly',
          onPress: () => handleScheduleReport('weekly'),
        },
        {
          text: 'Monthly',
          onPress: () => handleScheduleReport('monthly'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Export & Reports</Text>

      <View style={styles.buttonsContainer}>
        {/* Export PDF Button */}
        <TouchableOpacity
          style={[styles.exportButton, styles.pdfButton]}
          onPress={handleExportPDF}
          disabled={isExporting}
        >
          {isExporting && exportType === 'pdf' ? (
            <ActivityIndicator color={colors.text.light.inverse} />
          ) : (
            <>
              <Text style={styles.exportIcon}>📄</Text>
              <View style={styles.buttonContent}>
                <Text style={styles.exportButtonText}>Export to PDF</Text>
                <Text style={styles.exportButtonSubtext}>
                  Download complete analytics report
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Export CSV Button */}
        <TouchableOpacity
          style={[styles.exportButton, styles.csvButton]}
          onPress={handleExportCSV}
          disabled={isExporting}
        >
          {isExporting && exportType === 'csv' ? (
            <ActivityIndicator color={colors.text.light.inverse} />
          ) : (
            <>
              <Text style={styles.exportIcon}>📊</Text>
              <View style={styles.buttonContent}>
                <Text style={styles.exportButtonText}>Export to CSV</Text>
                <Text style={styles.exportButtonSubtext}>
                  Download raw analytics data
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Schedule Reports Button */}
        <TouchableOpacity
          style={[styles.exportButton, styles.scheduleButton]}
          onPress={showScheduleOptions}
          disabled={isExporting}
        >
          <Text style={styles.exportIcon}>📅</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.exportButtonText}>Schedule Reports</Text>
            <Text style={styles.exportButtonSubtext}>
              Receive automated analytics reports
            </Text>
          </View>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          style={[styles.exportButton, styles.shareButton]}
          onPress={() => {
            Alert.alert(
              'Share Analytics',
              'Choose export format to share',
              [
                {
                  text: 'Share PDF',
                  onPress: handleExportPDF,
                },
                {
                  text: 'Share CSV',
                  onPress: handleExportCSV,
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ]
            );
          }}
          disabled={isExporting}
        >
          <Text style={styles.exportIcon}>📤</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.exportButtonText}>Share Analytics</Text>
            <Text style={styles.exportButtonSubtext}>
              Share reports with others
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Reports include all analytics data, charts, insights, and predictions from your dashboard.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[4],
  },
  buttonsContainer: {
    gap: spacing[3],
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing[3],
  },
  pdfButton: {
    backgroundColor: colors.semantic.error,
    borderColor: colors.semantic.error,
  },
  csvButton: {
    backgroundColor: colors.semantic.success,
    borderColor: colors.semantic.success,
  },
  scheduleButton: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  shareButton: {
    backgroundColor: colors.domains.career,
    borderColor: colors.domains.career,
  },
  exportIcon: {
    fontSize: 32,
  },
  buttonContent: {
    flex: 1,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.inverse,
    marginBottom: spacing[1],
  },
  exportButtonSubtext: {
    fontSize: 12,
    color: colors.text.light.inverse,
    opacity: 0.9,
  },
  infoContainer: {
    marginTop: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.light.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  infoText: {
    fontSize: 12,
    color: colors.text.light.secondary,
    lineHeight: 18,
  },
});
