/**
 * Life Navigator - Health Documents Screen
 *
 * Document management with camera scanner integration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles, typography } from '../../utils/typography';

interface HealthDocument {
  id: string;
  title: string;
  category: 'insurance' | 'prescription' | 'test-result' | 'vaccine' | 'medical-report' | 'other';
  type: 'pdf' | 'image';
  url: string;
  uploadDate: string;
  size?: number;
  notes?: string;
  thumbnail?: string;
}

type DocumentCategory = HealthDocument['category'] | 'all';

export function DocumentsScreen() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('all');
  const [selectedDocument, setSelectedDocument] = useState<HealthDocument | null>(null);
  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch documents
  const {
    data: documents,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['health-documents'],
    queryFn: async () => {
      const response = await api.get<HealthDocument[]>('/api/v1/health/documents');
      return response;
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/api/v1/health/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-documents'] });
      setViewerModalVisible(false);
      setSelectedDocument(null);
      Alert.alert('Success', 'Document deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete document');
    },
  });

  const categories = [
    { value: 'all', label: 'All Documents', icon: '📄' },
    { value: 'insurance', label: 'Insurance Cards', icon: '🪪' },
    { value: 'prescription', label: 'Prescriptions', icon: '💊' },
    { value: 'test-result', label: 'Test Results', icon: '🧪' },
    { value: 'vaccine', label: 'Vaccine Records', icon: '💉' },
    { value: 'medical-report', label: 'Medical Reports', icon: '📋' },
    { value: 'other', label: 'Other', icon: '📁' },
  ];

  const filterDocuments = () => {
    if (!documents) return [];

    let filtered = documents;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    return filtered.sort((a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
  };

  const getCategoryInfo = (category: HealthDocument['category']) => {
    const categoryInfo = categories.find(c => c.value === category);
    return categoryInfo || { icon: '📄', label: category };
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleScanDocument = async () => {
    // Note: expo-camera or expo-image-picker would be used here
    // This is a placeholder implementation
    Alert.alert(
      'Scan Document',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              setUploading(true);
              // TODO: Implement camera integration with expo-camera
              // const { launchCameraAsync } = await import('expo-image-picker');
              // const result = await launchCameraAsync({
              //   mediaTypes: 'Images',
              //   allowsEditing: true,
              //   quality: 0.8,
              // });

              // Simulate upload
              await new Promise(resolve => setTimeout(resolve, 2000));
              Alert.alert('Success', 'Document scanned and uploaded (simulated)');
              refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to scan document');
            } finally {
              setUploading(false);
              setUploadModalVisible(false);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            try {
              setUploading(true);
              // TODO: Implement image picker with expo-image-picker
              // const { launchImageLibraryAsync } = await import('expo-image-picker');
              // const result = await launchImageLibraryAsync({
              //   mediaTypes: 'Images',
              //   allowsEditing: true,
              //   quality: 0.8,
              // });

              // Simulate upload
              await new Promise(resolve => setTimeout(resolve, 2000));
              Alert.alert('Success', 'Document uploaded (simulated)');
              refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to upload document');
            } finally {
              setUploading(false);
              setUploadModalVisible(false);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDocumentPress = (document: HealthDocument) => {
    setSelectedDocument(document);
    setViewerModalVisible(true);
  };

  const handleShareDocument = (document: HealthDocument) => {
    // TODO: Implement share functionality using expo-sharing
    Alert.alert('Share', `Sharing: ${document.title}`);
  };

  const handleDeleteDocument = (id: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]
    );
  };

  const renderDocumentCard = (document: HealthDocument) => {
    const categoryInfo = getCategoryInfo(document.category);

    return (
      <TouchableOpacity
        key={document.id}
        style={styles.documentCard}
        onPress={() => handleDocumentPress(document)}
        activeOpacity={0.7}
      >
        <View style={styles.documentPreview}>
          {document.thumbnail ? (
            <Image source={{ uri: document.thumbnail }} style={styles.thumbnailImage} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Text style={styles.thumbnailIcon}>
                {document.type === 'pdf' ? '📄' : '🖼️'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.documentInfo}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle} numberOfLines={2}>
              {document.title}
            </Text>
            <Text style={styles.categoryBadge}>
              {categoryInfo.icon} {categoryInfo.label}
            </Text>
          </View>

          <View style={styles.documentMeta}>
            <Text style={styles.metaText}>
              {new Date(document.uploadDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>{formatFileSize(document.size)}</Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>{document.type.toUpperCase()}</Text>
          </View>

          {document.notes && (
            <Text style={styles.documentNotes} numberOfLines={2}>
              {document.notes}
            </Text>
          )}
        </View>

        <Text style={styles.documentChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📄</Text>
      <Text style={styles.emptyStateTitle}>No documents yet</Text>
      <Text style={styles.emptyStateText}>
        Scan or upload your health documents to keep them organized and accessible
      </Text>
      <TouchableOpacity style={styles.emptyStateButton} onPress={handleScanDocument}>
        <Text style={styles.emptyStateButtonText}>Scan Document</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.healthcare} />
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load documents</Text>
        <Text style={styles.errorText}>{(error as any).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredDocuments = filterDocuments();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScanDocument}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Text style={styles.scanButtonIcon}>📷</Text>
              <Text style={styles.scanButtonText}>Scan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryScrollContent}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category.value}
            style={[
              styles.categoryPill,
              selectedCategory === category.value && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory(category.value as DocumentCategory)}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.value && styles.categoryTextActive,
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Documents List */}
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
        {filteredDocuments.length > 0 ? (
          <>
            <Text style={styles.resultCount}>
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            </Text>
            {filteredDocuments.map(renderDocumentCard)}
          </>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {/* Document Viewer Modal */}
      <Modal
        visible={viewerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setViewerModalVisible(false);
          setSelectedDocument(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDocument && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {selectedDocument.title}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {getCategoryInfo(selectedDocument.category).label}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setViewerModalVisible(false);
                      setSelectedDocument(null);
                    }}
                  >
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {/* Document Preview */}
                  <View style={styles.previewContainer}>
                    {selectedDocument.type === 'image' ? (
                      <Image
                        source={{ uri: selectedDocument.url }}
                        style={styles.previewImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.pdfPreview}>
                        <Text style={styles.pdfIcon}>📄</Text>
                        <Text style={styles.pdfText}>PDF Document</Text>
                        <Text style={styles.pdfHint}>Tap to open in viewer</Text>
                      </View>
                    )}
                  </View>

                  {/* Document Details */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Upload Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedDocument.uploadDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>File Size</Text>
                      <Text style={styles.detailValue}>
                        {formatFileSize(selectedDocument.size)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Type</Text>
                      <Text style={styles.detailValue}>
                        {selectedDocument.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {selectedDocument.notes && (
                    <View style={styles.notesSection}>
                      <Text style={styles.notesSectionTitle}>Notes</Text>
                      <Text style={styles.notesText}>{selectedDocument.notes}</Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.shareButton]}
                      onPress={() => handleShareDocument(selectedDocument)}
                    >
                      <Text style={styles.actionButtonIcon}>↗️</Text>
                      <Text style={styles.actionButtonText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteDocument(selectedDocument.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Text style={styles.actionButtonIcon}>🗑️</Text>
                          <Text style={styles.actionButtonText}>Delete</Text>
                        </>
                      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text.light.primary,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.domains.healthcare,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    minWidth: 80,
    justifyContent: 'center',
  },
  scanButtonIcon: {
    fontSize: 18,
    marginRight: spacing[1],
  },
  scanButtonText: {
    ...textStyles.button,
    color: '#FFF',
    fontSize: typography.sizes.sm,
  },
  categoryScroll: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  categoryScrollContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  categoryPillActive: {
    backgroundColor: colors.domains.healthcare,
    borderColor: colors.domains.healthcare,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: spacing[1],
  },
  categoryText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  categoryTextActive: {
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
  documentCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  documentPreview: {
    marginRight: spacing[3],
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: {
    fontSize: 32,
  },
  documentInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  documentHeader: {
    marginBottom: spacing[2],
  },
  documentTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  categoryBadge: {
    ...textStyles.labelSmall,
    color: colors.text.light.tertiary,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  metaText: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  metaDivider: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginHorizontal: spacing[1],
  },
  documentNotes: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  documentChevron: {
    fontSize: 24,
    color: colors.text.light.tertiary,
    alignSelf: 'center',
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
    marginBottom: spacing[6],
  },
  emptyStateButton: {
    backgroundColor: colors.domains.healthcare,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  emptyStateButtonText: {
    ...textStyles.button,
    color: '#FFF',
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
    flex: 1,
    marginRight: spacing[3],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
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
  previewContainer: {
    backgroundColor: colors.light.secondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  previewImage: {
    width: '100%',
    height: 300,
  },
  pdfPreview: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfIcon: {
    fontSize: 64,
    marginBottom: spacing[3],
  },
  pdfText: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  pdfHint: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
  },
  detailSection: {
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  detailLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  detailValue: {
    ...textStyles.body,
    color: colors.text.light.primary,
  },
  notesSection: {
    marginBottom: spacing[4],
  },
  notesSectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  notesText: {
    ...textStyles.body,
    color: colors.text.light.primary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    minHeight: 44,
  },
  shareButton: {
    backgroundColor: colors.primary.blue,
  },
  deleteButton: {
    backgroundColor: colors.semantic.error,
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  actionButtonText: {
    ...textStyles.button,
    color: '#FFF',
  },
});
