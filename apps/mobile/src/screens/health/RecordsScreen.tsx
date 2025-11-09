/**
 * Life Navigator - Medical Records Screen
 *
 * Medical records management with filtering and search
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles, typography } from '../../utils/typography';

interface MedicalRecord {
  id: string;
  title: string;
  type: 'visit' | 'test' | 'procedure' | 'lab' | 'imaging' | 'prescription' | 'vaccine';
  date: string;
  provider: string;
  facility?: string;
  diagnosis?: string;
  notes?: string;
  results?: string;
  attachments?: string[];
}

type RecordType = MedicalRecord['type'] | 'all';

export function RecordsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<RecordType>('all');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Fetch medical records
  const {
    data: records,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['medical-records'],
    queryFn: async () => {
      const response = await api.get<MedicalRecord[]>('/api/v1/health/records');
      return response;
    },
  });

  const recordTypes = [
    { value: 'all', label: 'All Records', icon: '📋' },
    { value: 'visit', label: 'Visits', icon: '🏥' },
    { value: 'test', label: 'Tests', icon: '🧪' },
    { value: 'lab', label: 'Lab Results', icon: '🔬' },
    { value: 'imaging', label: 'Imaging', icon: '🩻' },
    { value: 'procedure', label: 'Procedures', icon: '⚕️' },
    { value: 'prescription', label: 'Prescriptions', icon: '💊' },
    { value: 'vaccine', label: 'Vaccines', icon: '💉' },
  ];

  const filterRecords = () => {
    if (!records) return [];

    let filtered = records;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(record => record.type === selectedType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        record =>
          record.title.toLowerCase().includes(query) ||
          record.provider.toLowerCase().includes(query) ||
          record.diagnosis?.toLowerCase().includes(query) ||
          record.notes?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getRecordTypeInfo = (type: MedicalRecord['type']) => {
    const typeInfo = recordTypes.find(t => t.value === type);
    return typeInfo || { icon: '📄', label: type };
  };

  const handleRecordPress = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  const handleExportRecord = (record: MedicalRecord) => {
    // TODO: Implement export functionality
    console.log('Export record:', record.id);
  };

  const handleShareRecord = (record: MedicalRecord) => {
    // TODO: Implement share functionality
    console.log('Share record:', record.id);
  };

  const renderRecordCard = (record: MedicalRecord) => {
    const typeInfo = getRecordTypeInfo(record.type);

    return (
      <TouchableOpacity
        key={record.id}
        style={styles.recordCard}
        onPress={() => handleRecordPress(record)}
        activeOpacity={0.7}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordIconContainer}>
            <Text style={styles.recordIcon}>{typeInfo.icon}</Text>
          </View>
          <View style={styles.recordInfo}>
            <Text style={styles.recordTitle}>{record.title}</Text>
            <Text style={styles.recordType}>{typeInfo.label}</Text>
          </View>
          <Text style={styles.recordChevron}>›</Text>
        </View>

        <View style={styles.recordDetails}>
          <View style={styles.recordDetailRow}>
            <Text style={styles.recordDetailLabel}>Date:</Text>
            <Text style={styles.recordDetailValue}>
              {new Date(record.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.recordDetailRow}>
            <Text style={styles.recordDetailLabel}>Provider:</Text>
            <Text style={styles.recordDetailValue}>{record.provider}</Text>
          </View>
          {record.facility && (
            <View style={styles.recordDetailRow}>
              <Text style={styles.recordDetailLabel}>Facility:</Text>
              <Text style={styles.recordDetailValue}>{record.facility}</Text>
            </View>
          )}
          {record.diagnosis && (
            <View style={styles.recordDetailRow}>
              <Text style={styles.recordDetailLabel}>Diagnosis:</Text>
              <Text style={styles.recordDetailValue}>{record.diagnosis}</Text>
            </View>
          )}
        </View>

        {record.attachments && record.attachments.length > 0 && (
          <View style={styles.attachmentsBadge}>
            <Text style={styles.attachmentsText}>
              📎 {record.attachments.length} attachment{record.attachments.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📋</Text>
      <Text style={styles.emptyStateTitle}>No records found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery || selectedType !== 'all'
          ? 'Try adjusting your filters or search query'
          : 'Your medical records will appear here'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.healthcare} />
        <Text style={styles.loadingText}>Loading records...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load records</Text>
        <Text style={styles.errorText}>{(error as any).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredRecords = filterRecords();

  return (
    <View style={styles.container}>
      {/* Header with Search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medical Records</Text>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search records..."
            placeholderTextColor={colors.gray[400]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {recordTypes.map(type => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.filterPill,
              selectedType === type.value && styles.filterPillActive,
            ]}
            onPress={() => setSelectedType(type.value as RecordType)}
          >
            <Text style={styles.filterPillIcon}>{type.icon}</Text>
            <Text
              style={[
                styles.filterPillText,
                selectedType === type.value && styles.filterPillTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Records List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.domains.healthcare}
          />
        }
      >
        {filteredRecords.length > 0 ? (
          <>
            <Text style={styles.resultCount}>
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            </Text>
            {filteredRecords.map(renderRecordCard)}
          </>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {/* Record Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setDetailModalVisible(false);
          setSelectedRecord(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedRecord && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTypeIcon}>
                      {getRecordTypeInfo(selectedRecord.type).icon}
                    </Text>
                    <View>
                      <Text style={styles.modalTitle}>{selectedRecord.title}</Text>
                      <Text style={styles.modalSubtitle}>
                        {getRecordTypeInfo(selectedRecord.type).label}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      setSelectedRecord(null);
                    }}
                  >
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Details</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedRecord.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Provider</Text>
                      <Text style={styles.detailValue}>{selectedRecord.provider}</Text>
                    </View>
                    {selectedRecord.facility && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Facility</Text>
                        <Text style={styles.detailValue}>{selectedRecord.facility}</Text>
                      </View>
                    )}
                    {selectedRecord.diagnosis && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Diagnosis</Text>
                        <Text style={styles.detailValue}>{selectedRecord.diagnosis}</Text>
                      </View>
                    )}
                  </View>

                  {selectedRecord.results && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Results</Text>
                      <Text style={styles.detailText}>{selectedRecord.results}</Text>
                    </View>
                  )}

                  {selectedRecord.notes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Notes</Text>
                      <Text style={styles.detailText}>{selectedRecord.notes}</Text>
                    </View>
                  )}

                  {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Attachments</Text>
                      {selectedRecord.attachments.map((attachment, index) => (
                        <TouchableOpacity key={index} style={styles.attachmentItem}>
                          <Text style={styles.attachmentIcon}>📎</Text>
                          <Text style={styles.attachmentName}>{attachment}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleShareRecord(selectedRecord)}
                    >
                      <Text style={styles.actionButtonIcon}>↗️</Text>
                      <Text style={styles.actionButtonText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleExportRecord(selectedRecord)}
                    >
                      <Text style={styles.actionButtonIcon}>⬇️</Text>
                      <Text style={styles.actionButtonText}>Export</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginTop: spacing[4],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.light.secondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  errorTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  errorText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  retryButton: {
    backgroundColor: colors.domains.healthcare,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    ...textStyles.button,
    color: '#FFF',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    height: 44,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  searchInput: {
    ...textStyles.body,
    flex: 1,
    color: colors.text.light.primary,
  },
  searchClear: {
    fontSize: 18,
    color: colors.text.light.secondary,
    padding: spacing[1],
  },
  filterScroll: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  filterScrollContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  filterPillActive: {
    backgroundColor: colors.domains.healthcare,
    borderColor: colors.domains.healthcare,
  },
  filterPillIcon: {
    fontSize: 16,
    marginRight: spacing[1],
  },
  filterPillText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  resultCount: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  recordCard: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  recordIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  recordIcon: {
    fontSize: 24,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  recordType: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
  },
  recordChevron: {
    fontSize: 24,
    color: colors.text.light.tertiary,
  },
  recordDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing[3],
  },
  recordDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  recordDetailLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  recordDetailValue: {
    ...textStyles.bodySmall,
    color: colors.text.light.primary,
    flex: 1,
    textAlign: 'right',
  },
  attachmentsBadge: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  attachmentsText: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[12],
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyStateTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.light,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTypeIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  modalSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
  },
  modalClose: {
    fontSize: 24,
    color: colors.text.light.secondary,
    fontWeight: typography.weights.bold,
  },
  modalScroll: {
    padding: spacing[4],
  },
  detailSection: {
    marginBottom: spacing[6],
  },
  detailSectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  detailLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  detailValue: {
    ...textStyles.body,
    color: colors.text.light.primary,
    flex: 1,
    textAlign: 'right',
  },
  detailText: {
    ...textStyles.body,
    color: colors.text.light.primary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  attachmentIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  attachmentName: {
    ...textStyles.body,
    color: colors.text.light.primary,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    paddingBottom: spacing[4],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  actionButtonText: {
    ...textStyles.button,
    color: colors.text.light.primary,
  },
});
