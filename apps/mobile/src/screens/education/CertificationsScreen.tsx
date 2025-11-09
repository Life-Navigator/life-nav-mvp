/**
 * Life Navigator - Certifications Screen
 *
 * Certification tracking with expiration reminders
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useCertifications, useUpdateCertification } from '../../hooks/useEducation';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatDate } from '../../utils/formatters';
import { Certification } from '../../types';

export function CertificationsScreen() {
  const { data: certifications, isLoading, error } = useCertifications();
  const updateCertification = useUpdateCertification();

  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const statuses = ['All', 'Earned', 'In Progress', 'Expired', 'Renewing'];

  const filteredCertifications = certifications?.filter((cert) => {
    if (selectedStatus === 'All') return true;
    return cert.status === selectedStatus.toLowerCase().replace(' ', '_');
  });

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      in_progress: colors.charts.blue,
      earned: colors.semantic.success,
      expired: colors.semantic.error,
      renewing: colors.semantic.warning,
    };
    return colorMap[status] || colors.gray[400];
  };

  const isExpiringSoon = (expirationDate?: string) => {
    if (!expirationDate) return false;
    const daysUntilExpiration = Math.floor(
      (new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiration >= 0 && daysUntilExpiration <= 90;
  };

  const isExpired = (expirationDate?: string) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load certifications</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Certifications</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Certification</Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusFilter}
      >
        {statuses.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.statusChip,
              selectedStatus === status && styles.statusChipActive,
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text
              style={[
                styles.statusChipText,
                selectedStatus === status && styles.statusChipTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.semantic.success }]}>
            {certifications?.filter((c) => c.status === 'earned').length || 0}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.charts.blue }]}>
            {certifications?.filter((c) => c.status === 'in_progress').length || 0}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.semantic.warning }]}>
            {certifications?.filter((c) => c.expirationDate && isExpiringSoon(c.expirationDate))
              .length || 0}
          </Text>
          <Text style={styles.statLabel}>Expiring Soon</Text>
        </View>
      </View>

      {/* Certifications List */}
      <ScrollView style={styles.certificationsList}>
        {filteredCertifications?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No certifications found</Text>
            <Text style={styles.emptySubtext}>
              Add certifications to track your credentials
            </Text>
          </View>
        ) : (
          filteredCertifications?.map((cert) => (
            <TouchableOpacity key={cert.id} style={styles.certificationCard}>
              {/* Certification Header */}
              <View style={styles.certHeader}>
                <View style={styles.certInfo}>
                  <Text style={styles.certName}>{cert.name}</Text>
                  <Text style={styles.organizationText}>
                    {cert.issuingOrganization}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(cert.status) },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {cert.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Dates */}
              <View style={styles.datesContainer}>
                {cert.issueDate && (
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>Issued:</Text>
                    <Text style={styles.dateValue}>
                      {formatDate(cert.issueDate)}
                    </Text>
                  </View>
                )}
                {cert.expirationDate && (
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>
                      {isExpired(cert.expirationDate) ? 'Expired:' : 'Expires:'}
                    </Text>
                    <Text
                      style={[
                        styles.dateValue,
                        isExpired(cert.expirationDate) && {
                          color: colors.semantic.error,
                        },
                        isExpiringSoon(cert.expirationDate) &&
                          !isExpired(cert.expirationDate) && {
                            color: colors.semantic.warning,
                          },
                      ]}
                    >
                      {formatDate(cert.expirationDate)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Expiration Warning */}
              {cert.expirationDate &&
                isExpiringSoon(cert.expirationDate) &&
                !isExpired(cert.expirationDate) && (
                  <View style={styles.warningContainer}>
                    <Text style={styles.warningText}>
                      Expires in{' '}
                      {Math.floor(
                        (new Date(cert.expirationDate).getTime() - new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      days
                    </Text>
                  </View>
                )}

              {/* Credential ID */}
              {cert.credentialId && (
                <View style={styles.credentialContainer}>
                  <Text style={styles.credentialLabel}>Credential ID:</Text>
                  <Text style={styles.credentialValue}>{cert.credentialId}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionsContainer}>
                {cert.credentialUrl && (
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>View Certificate</Text>
                  </TouchableOpacity>
                )}
                {cert.verificationUrl && (
                  <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
                    <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                      Verify
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Renewal Reminder */}
              {cert.renewalReminder && (
                <View style={styles.reminderContainer}>
                  <Text style={styles.reminderText}>
                    Renewal reminder enabled
                  </Text>
                </View>
              )}

              {/* Notes */}
              {cert.notes && (
                <Text style={styles.notesText} numberOfLines={2}>
                  Note: {cert.notes}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    padding: spacing[6],
  },
  errorText: {
    ...textStyles.body,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  addButton: {
    backgroundColor: colors.primary.blue,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  statusFilter: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  statusChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  statusChipActive: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  statusChipText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  statusChipTextActive: {
    color: colors.text.light.inverse,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.primary,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...textStyles.h2,
    color: colors.primary.blue,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  certificationsList: {
    flex: 1,
    padding: spacing[4],
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyText: {
    ...textStyles.h4,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  emptySubtext: {
    ...textStyles.body,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  certificationCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  certInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  certName: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  organizationText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
    textTransform: 'capitalize',
  },
  datesContainer: {
    marginBottom: spacing[3],
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  dateLabel: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
  },
  dateValue: {
    ...textStyles.bodySmall,
    color: colors.text.light.primary,
  },
  warningContainer: {
    backgroundColor: colors.semantic.warning,
    padding: spacing[2],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  warningText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
    textAlign: 'center',
  },
  credentialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: borderRadius.md,
    marginBottom: spacing[3],
  },
  credentialLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  credentialValue: {
    ...textStyles.label,
    color: colors.text.light.primary,
    fontFamily: 'monospace',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary.blue,
    padding: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary.blue,
  },
  secondaryButtonText: {
    color: colors.primary.blue,
  },
  reminderContainer: {
    padding: spacing[2],
    backgroundColor: colors.charts.teal,
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  reminderText: {
    ...textStyles.labelSmall,
    color: colors.text.light.inverse,
    textAlign: 'center',
  },
  notesText: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    fontStyle: 'italic',
    marginTop: spacing[2],
  },
});

export default CertificationsScreen;
