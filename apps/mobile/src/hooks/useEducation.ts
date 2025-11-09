/**
 * Life Navigator - Education Data Hooks
 *
 * Elite-level React Query hooks for education data fetching
 * NO MOCK DATA - All data from real API endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as educationApi from '../api/education';
import {
  Course,
  Certification,
} from '../types';

/**
 * Query Keys for cache management
 */
export const educationKeys = {
  all: ['education'] as const,
  courses: () => [...educationKeys.all, 'courses'] as const,
  course: (id: string) => [...educationKeys.courses(), id] as const,
  certifications: () => [...educationKeys.all, 'certifications'] as const,
  certification: (id: string) => [...educationKeys.certifications(), id] as const,
  progress: () => [...educationKeys.all, 'progress'] as const,
};

/**
 * Fetch all courses
 */
export const useCourses = () => {
  return useQuery({
    queryKey: educationKeys.courses(),
    queryFn: educationApi.getCourses,
  });
};

/**
 * Fetch single course
 */
export const useCourse = (courseId: string) => {
  return useQuery({
    queryKey: educationKeys.course(courseId),
    queryFn: () => educationApi.getCourse(courseId),
    enabled: !!courseId,
  });
};

/**
 * Create course
 */
export const useCreateCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: educationApi.createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.courses() });
    },
  });
};

/**
 * Update course
 */
export const useUpdateCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Course> }) =>
      educationApi.updateCourse(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.courses() });
      queryClient.invalidateQueries({ queryKey: educationKeys.progress() });
    },
  });
};

/**
 * Delete course
 */
export const useDeleteCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: educationApi.deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.courses() });
      queryClient.invalidateQueries({ queryKey: educationKeys.progress() });
    },
  });
};

/**
 * Fetch all certifications
 */
export const useCertifications = () => {
  return useQuery({
    queryKey: educationKeys.certifications(),
    queryFn: educationApi.getCertifications,
  });
};

/**
 * Fetch single certification
 */
export const useCertification = (certificationId: string) => {
  return useQuery({
    queryKey: educationKeys.certification(certificationId),
    queryFn: () => educationApi.getCertification(certificationId),
    enabled: !!certificationId,
  });
};

/**
 * Create certification
 */
export const useCreateCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: educationApi.createCertification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.certifications() });
      queryClient.invalidateQueries({ queryKey: educationKeys.progress() });
    },
  });
};

/**
 * Update certification
 */
export const useUpdateCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Certification> }) =>
      educationApi.updateCertification(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.certifications() });
      queryClient.invalidateQueries({ queryKey: educationKeys.progress() });
    },
  });
};

/**
 * Delete certification
 */
export const useDeleteCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: educationApi.deleteCertification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.certifications() });
      queryClient.invalidateQueries({ queryKey: educationKeys.progress() });
    },
  });
};

/**
 * Fetch learning progress
 */
export const useLearningProgress = () => {
  return useQuery({
    queryKey: educationKeys.progress(),
    queryFn: educationApi.getLearningProgress,
  });
};

/**
 * Log study time
 */
export const useLogStudyTime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: educationApi.logStudyTime,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.progress() });
    },
  });
};

export default {
  useCourses,
  useCourse,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useCertifications,
  useCertification,
  useCreateCertification,
  useUpdateCertification,
  useDeleteCertification,
  useLearningProgress,
  useLogStudyTime,
};
