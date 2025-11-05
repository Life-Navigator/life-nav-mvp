/**
 * Life Navigator - Healthcare Data Hooks
 *
 * Elite-level React Query hooks for healthcare data fetching
 * NO MOCK DATA - All data from real API endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as healthcareApi from '../api/healthcare';
import {
  Medication,
  Appointment,
  HealthScreening,
  MedicalCondition,
  HealthMetric,
} from '../types';

/**
 * Query Keys for cache management
 */
export const healthcareKeys = {
  all: ['healthcare'] as const,
  medications: () => [...healthcareKeys.all, 'medications'] as const,
  medication: (id: string) => [...healthcareKeys.medications(), id] as const,
  appointments: (filters?: any) => [...healthcareKeys.all, 'appointments', filters] as const,
  appointment: (id: string) => [...healthcareKeys.all, 'appointment', id] as const,
  screenings: () => [...healthcareKeys.all, 'screenings'] as const,
  conditions: () => [...healthcareKeys.all, 'conditions'] as const,
  metrics: (filters?: any) => [...healthcareKeys.all, 'metrics', filters] as const,
};

/**
 * Fetch all medications
 */
export const useMedications = () => {
  return useQuery({
    queryKey: healthcareKeys.medications(),
    queryFn: healthcareApi.getMedications,
  });
};

/**
 * Fetch single medication
 */
export const useMedication = (medicationId: string) => {
  return useQuery({
    queryKey: healthcareKeys.medication(medicationId),
    queryFn: () => healthcareApi.getMedication(medicationId),
    enabled: !!medicationId,
  });
};

/**
 * Create medication
 */
export const useCreateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.createMedication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.medications() });
    },
  });
};

/**
 * Update medication
 */
export const useUpdateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Medication> }) =>
      healthcareApi.updateMedication(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.medication(variables.id) });
      queryClient.invalidateQueries({ queryKey: healthcareKeys.medications() });
    },
  });
};

/**
 * Delete medication
 */
export const useDeleteMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.deleteMedication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.medications() });
    },
  });
};

/**
 * Log medication taken
 */
export const useLogMedicationTaken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { takenAt: string; notes?: string } }) =>
      healthcareApi.logMedicationTaken(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.medications() });
    },
  });
};

/**
 * Fetch appointments
 */
export const useAppointments = (params?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}) => {
  return useQuery({
    queryKey: healthcareKeys.appointments(params),
    queryFn: () => healthcareApi.getAppointments(params),
  });
};

/**
 * Fetch single appointment
 */
export const useAppointment = (appointmentId: string) => {
  return useQuery({
    queryKey: healthcareKeys.appointment(appointmentId),
    queryFn: () => healthcareApi.getAppointment(appointmentId),
    enabled: !!appointmentId,
  });
};

/**
 * Create appointment
 */
export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.appointments() });
    },
  });
};

/**
 * Update appointment
 */
export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Appointment> }) =>
      healthcareApi.updateAppointment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.appointments() });
    },
  });
};

/**
 * Cancel appointment
 */
export const useCancelAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.cancelAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.appointments() });
    },
  });
};

/**
 * Fetch health screenings
 */
export const useHealthScreenings = () => {
  return useQuery({
    queryKey: healthcareKeys.screenings(),
    queryFn: healthcareApi.getHealthScreenings,
  });
};

/**
 * Update screening
 */
export const useUpdateScreening = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { lastDate: string } }) =>
      healthcareApi.updateScreening(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.screenings() });
    },
  });
};

/**
 * Fetch medical conditions
 */
export const useMedicalConditions = () => {
  return useQuery({
    queryKey: healthcareKeys.conditions(),
    queryFn: healthcareApi.getMedicalConditions,
  });
};

/**
 * Create medical condition
 */
export const useCreateMedicalCondition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.createMedicalCondition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.conditions() });
    },
  });
};

/**
 * Update medical condition
 */
export const useUpdateMedicalCondition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MedicalCondition> }) =>
      healthcareApi.updateMedicalCondition(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.conditions() });
    },
  });
};

/**
 * Fetch health metrics
 */
export const useHealthMetrics = (params?: {
  type?: string;
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: healthcareKeys.metrics(params),
    queryFn: () => healthcareApi.getHealthMetrics(params),
  });
};

/**
 * Log health metric
 */
export const useLogHealthMetric = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.logHealthMetric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.metrics() });
    },
  });
};

/**
 * Sync HealthKit data
 */
export const useSyncHealthKit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.syncHealthKit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.metrics() });
    },
  });
};

/**
 * Sync Google Fit data
 */
export const useSyncGoogleFit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthcareApi.syncGoogleFit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthcareKeys.metrics() });
    },
  });
};

export default {
  useMedications,
  useMedication,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  useLogMedicationTaken,
  useAppointments,
  useAppointment,
  useCreateAppointment,
  useUpdateAppointment,
  useCancelAppointment,
  useHealthScreenings,
  useUpdateScreening,
  useMedicalConditions,
  useCreateMedicalCondition,
  useUpdateMedicalCondition,
  useHealthMetrics,
  useLogHealthMetric,
  useSyncHealthKit,
  useSyncGoogleFit,
};
