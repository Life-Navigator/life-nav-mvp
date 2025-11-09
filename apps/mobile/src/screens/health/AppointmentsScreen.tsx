/**
 * Life Navigator - Appointments Screen
 *
 * Full appointment management with calendar integration
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
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles, typography } from '../../utils/typography';

interface Appointment {
  id: string;
  title: string;
  provider: string;
  specialty?: string;
  date: string;
  time: string;
  location: string;
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  reminderSet: boolean;
}

interface AppointmentFormData {
  title: string;
  provider: string;
  specialty?: string;
  date: string;
  time: string;
  location: string;
  notes?: string;
}

export function AppointmentsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<AppointmentFormData>({
    title: '',
    provider: '',
    specialty: '',
    date: '',
    time: '',
    location: '',
    notes: '',
  });

  // Fetch appointments
  const {
    data: appointments,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const response = await api.get<Appointment[]>('/api/v1/health/appointments');
      return response;
    },
  });

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      return await api.post('/api/v1/health/appointments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Appointment created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create appointment');
    },
  });

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AppointmentFormData> }) => {
      return await api.put(`/api/v1/health/appointments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Appointment updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update appointment');
    },
  });

  // Cancel appointment mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.put(`/api/v1/health/appointments/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      Alert.alert('Success', 'Appointment cancelled successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to cancel appointment');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      provider: '',
      specialty: '',
      date: '',
      time: '',
      location: '',
      notes: '',
    });
    setEditingAppointment(null);
  };

  const handleAddAppointment = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      title: appointment.title,
      provider: appointment.provider,
      specialty: appointment.specialty || '',
      date: appointment.date,
      time: appointment.time,
      location: appointment.location,
      notes: appointment.notes || '',
    });
    setModalVisible(true);
  };

  const handleSaveAppointment = () => {
    if (!formData.title || !formData.provider || !formData.date || !formData.time) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleCancelAppointment = (id: string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
      ]
    );
  };

  const filterAppointments = (appts: Appointment[] | undefined) => {
    if (!appts) return [];
    const now = new Date();

    if (activeTab === 'upcoming') {
      return appts.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= now && apt.status !== 'cancelled' && apt.status !== 'completed';
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      return appts.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate < now || apt.status === 'cancelled' || apt.status === 'completed';
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'scheduled':
        return colors.charts.blue;
      case 'confirmed':
        return colors.semantic.success;
      case 'cancelled':
        return colors.semantic.error;
      case 'completed':
        return colors.gray[500];
      default:
        return colors.gray[500];
    }
  };

  const renderAppointmentCard = (appointment: Appointment) => (
    <TouchableOpacity
      key={appointment.id}
      style={styles.appointmentCard}
      onPress={() => handleEditAppointment(appointment)}
      activeOpacity={0.7}
    >
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentTitleRow}>
          <Text style={styles.appointmentTitle}>{appointment.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
            <Text style={styles.statusText}>{appointment.status}</Text>
          </View>
        </View>
        <Text style={styles.appointmentProvider}>{appointment.provider}</Text>
        {appointment.specialty && (
          <Text style={styles.appointmentSpecialty}>{appointment.specialty}</Text>
        )}
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📅</Text>
          <Text style={styles.detailText}>
            {new Date(appointment.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>⏰</Text>
          <Text style={styles.detailText}>{appointment.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📍</Text>
          <Text style={styles.detailText}>{appointment.location}</Text>
        </View>
        {appointment.reminderSet && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🔔</Text>
            <Text style={styles.detailText}>Reminder set</Text>
          </View>
        )}
      </View>

      {appointment.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes:</Text>
          <Text style={styles.notesText}>{appointment.notes}</Text>
        </View>
      )}

      {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
        <View style={styles.appointmentActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleCancelAppointment(appointment.id);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📅</Text>
      <Text style={styles.emptyStateTitle}>No {activeTab} appointments</Text>
      <Text style={styles.emptyStateText}>
        {activeTab === 'upcoming'
          ? 'Schedule your next appointment to get started'
          : 'Your past appointments will appear here'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.healthcare} />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load appointments</Text>
        <Text style={styles.errorText}>{(error as any).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredAppointments = filterAppointments(appointments);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddAppointment}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Appointments List */}
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
        {filteredAppointments.length > 0 ? (
          filteredAppointments.map(renderAppointmentCard)
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {/* Add/Edit Appointment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  placeholder="e.g., Annual Checkup"
                  placeholderTextColor={colors.gray[400]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Provider *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.provider}
                  onChangeText={(text) => setFormData({ ...formData, provider: text })}
                  placeholder="e.g., Dr. Smith"
                  placeholderTextColor={colors.gray[400]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Specialty</Text>
                <TextInput
                  style={styles.input}
                  value={formData.specialty}
                  onChangeText={(text) => setFormData({ ...formData, specialty: text })}
                  placeholder="e.g., Primary Care"
                  placeholderTextColor={colors.gray[400]}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>Date *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.date}
                    onChangeText={(text) => setFormData({ ...formData, date: text })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.gray[400]}
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.formLabel}>Time *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.time}
                    onChangeText={(text) => setFormData({ ...formData, time: text })}
                    placeholder="10:00 AM"
                    placeholderTextColor={colors.gray[400]}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                  placeholder="e.g., 123 Medical Center Dr"
                  placeholderTextColor={colors.gray[400]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholder="Additional notes or instructions..."
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelModalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveAppointment}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingAppointment ? 'Update' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  addButton: {
    backgroundColor: colors.domains.healthcare,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  addButtonText: {
    ...textStyles.button,
    color: '#FFF',
    fontSize: typography.sizes.sm,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[4],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.domains.healthcare,
  },
  tabText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  activeTabText: {
    color: colors.domains.healthcare,
    fontWeight: typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  appointmentCard: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.md,
  },
  appointmentHeader: {
    marginBottom: spacing[3],
  },
  appointmentTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[1],
  },
  appointmentTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    flex: 1,
    marginRight: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...textStyles.labelSmall,
    color: '#FFF',
    textTransform: 'capitalize',
  },
  appointmentProvider: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  appointmentSpecialty: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
  },
  appointmentDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  detailIcon: {
    fontSize: 16,
    marginRight: spacing[2],
    width: 20,
  },
  detailText: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    flex: 1,
  },
  notesSection: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  notesLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  notesText: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
  },
  appointmentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  actionButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.semantic.error,
  },
  cancelButtonText: {
    ...textStyles.buttonSmall,
    color: '#FFF',
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
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  modalClose: {
    fontSize: 24,
    color: colors.text.light.secondary,
    fontWeight: typography.weights.bold,
  },
  modalScroll: {
    padding: spacing[4],
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  formGroupHalf: {
    flex: 1,
    marginBottom: spacing[4],
  },
  formLabel: {
    ...textStyles.label,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  input: {
    ...textStyles.body,
    color: colors.text.light.primary,
    backgroundColor: colors.light.secondary,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing[3],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    paddingBottom: spacing[4],
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelModalButton: {
    backgroundColor: colors.gray[200],
  },
  cancelModalButtonText: {
    ...textStyles.button,
    color: colors.text.light.primary,
  },
  saveButton: {
    backgroundColor: colors.domains.healthcare,
  },
  saveButtonText: {
    ...textStyles.button,
    color: '#FFF',
  },
});
