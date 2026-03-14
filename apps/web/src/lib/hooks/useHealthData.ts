/**
 * Health Data Hooks
 *
 * React Query hooks for fetching and mutating health data.
 * Connects to backend API endpoints for conditions, medications, and lab results.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/client';

// Types
export interface HealthCondition {
  id: string;
  condition_name: string;
  condition_type?: 'chronic' | 'acute' | 'genetic' | 'mental_health' | 'other';
  severity?: 'mild' | 'moderate' | 'severe' | 'critical';
  icd_10_code?: string;
  diagnosis_date?: string;
  resolved_date?: string;
  status: 'active' | 'resolved' | 'in_remission' | 'chronic_managed';
  diagnosed_by?: string;
  symptoms?: string[];
  treatment_plan?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  condition_id?: string;
  medication_name: string;
  generic_name?: string;
  dosage?: string;
  dosage_unit?: string;
  form?: string;
  frequency?: string;
  route?: 'oral' | 'topical' | 'injection' | 'inhalation' | 'other';
  start_date: string;
  end_date?: string;
  status: 'active' | 'discontinued' | 'completed' | 'on_hold';
  is_as_needed: boolean;
  prescribed_by?: string;
  pharmacy_name?: string;
  reminder_enabled: boolean;
  reminder_times?: (string | Date)[];
  next_refill_date?: string | Date;
  side_effects?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LabResult {
  id: string;
  test_name: string;
  test_code?: string;
  result_value: string;
  result_unit?: string;
  reference_range_low?: string;
  reference_range_high?: string;
  reference_range?: string;
  status: 'pending' | 'normal' | 'abnormal_low' | 'abnormal_high' | 'critical';
  test_date: string;
  result_date?: string;
  ordering_provider?: string;
  performing_lab?: string;
  condition_id?: string;
  source?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface HealthSummary {
  active_conditions: number;
  active_medications: number;
  recent_lab_results: number;
  upcoming_appointments: number;
  medication_adherence: number;
  conditions: HealthCondition[];
  medications: Medication[];
  recent_labs: LabResult[];
}

// Query Keys
export const healthQueryKeys = {
  all: ['health'] as const,
  conditions: () => [...healthQueryKeys.all, 'conditions'] as const,
  condition: (id: string) => [...healthQueryKeys.conditions(), id] as const,
  medications: (filters?: Record<string, any>) =>
    [...healthQueryKeys.all, 'medications', filters] as const,
  medication: (id: string) => [...healthQueryKeys.all, 'medications', id] as const,
  labResults: (filters?: Record<string, any>) =>
    [...healthQueryKeys.all, 'lab-results', filters] as const,
  labResult: (id: string) => [...healthQueryKeys.all, 'lab-results', id] as const,
  summary: () => [...healthQueryKeys.all, 'summary'] as const,
};

// Hooks

/**
 * Fetch health summary/overview
 */
export function useHealthSummary() {
  const api = useApiClient();

  return useQuery({
    queryKey: healthQueryKeys.summary(),
    queryFn: async () => {
      const response = await api.get<HealthSummary>('/data/health/summary');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch all health conditions
 */
export function useHealthConditions() {
  const api = useApiClient();

  return useQuery({
    queryKey: healthQueryKeys.conditions(),
    queryFn: async () => {
      const response = await api.get<HealthCondition[]>('/data/health/conditions');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single health condition
 */
export function useHealthCondition(id: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: healthQueryKeys.condition(id),
    queryFn: async () => {
      const response = await api.get<HealthCondition>(`/data/health/conditions/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create health condition mutation
 */
export function useCreateCondition() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<HealthCondition, 'id' | 'created_at' | 'updated_at'>) => {
      return api.post<HealthCondition>('/data/health/conditions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.conditions() });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.summary() });
    },
  });
}

/**
 * Update health condition mutation
 */
export function useUpdateCondition() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HealthCondition> }) => {
      return api.patch<HealthCondition>(`/data/health/conditions/${id}`, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.condition(id) });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.conditions() });
    },
  });
}

/**
 * Delete health condition mutation
 */
export function useDeleteCondition() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/data/health/conditions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.conditions() });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.summary() });
    },
  });
}

/**
 * Fetch medications with optional filters
 */
export function useMedications(filters?: {
  condition_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}) {
  const api = useApiClient();

  return useQuery({
    queryKey: healthQueryKeys.medications(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) params.append(key, String(value));
        });
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<Medication[]>(`/data/health/medications${query}`);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Create medication mutation
 */
export function useCreateMedication() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Medication, 'id' | 'created_at' | 'updated_at'>) => {
      return api.post<Medication>('/data/health/medications', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.medications() });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.summary() });
    },
  });
}

/**
 * Update medication mutation
 */
export function useUpdateMedication() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Medication> }) => {
      return api.patch<Medication>(`/data/health/medications/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.medications() });
    },
  });
}

/**
 * Delete medication mutation
 */
export function useDeleteMedication() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/data/health/medications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.medications() });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.summary() });
    },
  });
}

/**
 * Fetch lab results with optional filters
 */
export function useLabResults(filters?: {
  condition_id?: string;
  test_name?: string;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}) {
  const api = useApiClient();

  return useQuery({
    queryKey: healthQueryKeys.labResults(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) params.append(key, String(value));
        });
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<LabResult[]>(`/data/health/lab-results${query}`);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single lab result
 */
export function useLabResult(id: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: healthQueryKeys.labResult(id),
    queryFn: async () => {
      const response = await api.get<LabResult>(`/data/health/lab-results/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create lab result mutation
 */
export function useCreateLabResult() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<LabResult, 'id' | 'created_at' | 'updated_at'>) => {
      return api.post<LabResult>('/data/health/lab-results', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.labResults() });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.summary() });
    },
  });
}

/**
 * Update lab result mutation
 */
export function useUpdateLabResult() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LabResult> }) => {
      return api.patch<LabResult>(`/data/health/lab-results/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.labResults() });
    },
  });
}

/**
 * Delete lab result mutation
 */
export function useDeleteLabResult() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/data/health/lab-results/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.labResults() });
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.summary() });
    },
  });
}
