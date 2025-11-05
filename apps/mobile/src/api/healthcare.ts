/**
 * Life Navigator - Healthcare API
 *
 * Elite-level healthcare API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import {
  Medication,
  MedicationReminder,
  Appointment,
  HealthScreening,
  MedicalCondition,
  HealthMetric,
  ApiResponse,
  PaginatedResponse,
} from '../types';

/**
 * Get all medications
 * GET /healthcare/medications
 */
export const getMedications = async (): Promise<Medication[]> => {
  return api.get('/healthcare/medications');
};

/**
 * Get single medication by ID
 * GET /healthcare/medications/:id
 */
export const getMedication = async (medicationId: string): Promise<Medication> => {
  return api.get(`/healthcare/medications/${medicationId}`);
};

/**
 * Create medication
 * POST /healthcare/medications
 */
export const createMedication = async (
  medication: Omit<Medication, 'id' | 'reminders'>
): Promise<Medication> => {
  return api.post('/healthcare/medications', medication);
};

/**
 * Update medication
 * PATCH /healthcare/medications/:id
 */
export const updateMedication = async (
  medicationId: string,
  updates: Partial<Medication>
): Promise<Medication> => {
  return api.patch(`/healthcare/medications/${medicationId}`, updates);
};

/**
 * Delete medication
 * DELETE /healthcare/medications/:id
 */
export const deleteMedication = async (medicationId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/healthcare/medications/${medicationId}`);
};

/**
 * Log medication taken
 * POST /healthcare/medications/:id/log
 */
export const logMedicationTaken = async (
  medicationId: string,
  data: { takenAt: string; notes?: string }
): Promise<ApiResponse<{ message: string }>> => {
  return api.post(`/healthcare/medications/${medicationId}/log`, data);
};

/**
 * Get appointments
 * GET /healthcare/appointments
 */
export const getAppointments = async (params?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<Appointment[]> => {
  return api.get('/healthcare/appointments', { params });
};

/**
 * Get single appointment by ID
 * GET /healthcare/appointments/:id
 */
export const getAppointment = async (appointmentId: string): Promise<Appointment> => {
  return api.get(`/healthcare/appointments/${appointmentId}`);
};

/**
 * Create appointment
 * POST /healthcare/appointments
 */
export const createAppointment = async (
  appointment: Omit<Appointment, 'id'>
): Promise<Appointment> => {
  return api.post('/healthcare/appointments', appointment);
};

/**
 * Update appointment
 * PATCH /healthcare/appointments/:id
 */
export const updateAppointment = async (
  appointmentId: string,
  updates: Partial<Appointment>
): Promise<Appointment> => {
  return api.patch(`/healthcare/appointments/${appointmentId}`, updates);
};

/**
 * Cancel appointment
 * DELETE /healthcare/appointments/:id
 */
export const cancelAppointment = async (appointmentId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/healthcare/appointments/${appointmentId}`);
};

/**
 * Get health screenings
 * GET /healthcare/screenings
 */
export const getHealthScreenings = async (): Promise<HealthScreening[]> => {
  return api.get('/healthcare/screenings');
};

/**
 * Update screening date
 * PATCH /healthcare/screenings/:id
 */
export const updateScreening = async (
  screeningId: string,
  data: { lastDate: string }
): Promise<HealthScreening> => {
  return api.patch(`/healthcare/screenings/${screeningId}`, data);
};

/**
 * Get medical conditions
 * GET /healthcare/conditions
 */
export const getMedicalConditions = async (): Promise<MedicalCondition[]> => {
  return api.get('/healthcare/conditions');
};

/**
 * Create medical condition
 * POST /healthcare/conditions
 */
export const createMedicalCondition = async (
  condition: Omit<MedicalCondition, 'id'>
): Promise<MedicalCondition> => {
  return api.post('/healthcare/conditions', condition);
};

/**
 * Update medical condition
 * PATCH /healthcare/conditions/:id
 */
export const updateMedicalCondition = async (
  conditionId: string,
  updates: Partial<MedicalCondition>
): Promise<MedicalCondition> => {
  return api.patch(`/healthcare/conditions/${conditionId}`, updates);
};

/**
 * Get health metrics
 * GET /healthcare/metrics
 */
export const getHealthMetrics = async (params?: {
  type?: string;
  startDate?: string;
  endDate?: string;
}): Promise<HealthMetric[]> => {
  return api.get('/healthcare/metrics', { params });
};

/**
 * Log health metric
 * POST /healthcare/metrics
 */
export const logHealthMetric = async (
  metric: Omit<HealthMetric, 'id'>
): Promise<HealthMetric> => {
  return api.post('/healthcare/metrics', metric);
};

/**
 * Sync with HealthKit (iOS)
 * POST /healthcare/healthkit/sync
 */
export const syncHealthKit = async (
  data: HealthMetric[]
): Promise<ApiResponse<{ synced: number }>> => {
  return api.post('/healthcare/healthkit/sync', { metrics: data });
};

/**
 * Sync with Google Fit (Android)
 * POST /healthcare/googlefit/sync
 */
export const syncGoogleFit = async (
  data: HealthMetric[]
): Promise<ApiResponse<{ synced: number }>> => {
  return api.post('/healthcare/googlefit/sync', { metrics: data });
};

export default {
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
  logMedicationTaken,
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getHealthScreenings,
  updateScreening,
  getMedicalConditions,
  createMedicalCondition,
  updateMedicalCondition,
  getHealthMetrics,
  logHealthMetric,
  syncHealthKit,
  syncGoogleFit,
};
