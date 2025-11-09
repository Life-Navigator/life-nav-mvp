/**
 * Life Navigator - Education API
 *
 * Elite-level education API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import {
  Course,
  Certification,
  LearningProgress,
  ApiResponse,
} from '../types';

/**
 * Get all courses
 * GET /education/courses
 */
export const getCourses = async (): Promise<Course[]> => {
  return api.get('/education/courses');
};

/**
 * Get single course
 * GET /education/courses/:id
 */
export const getCourse = async (courseId: string): Promise<Course> => {
  return api.get(`/education/courses/${courseId}`);
};

/**
 * Create course
 * POST /education/courses
 */
export const createCourse = async (course: Omit<Course, 'id'>): Promise<Course> => {
  return api.post('/education/courses', course);
};

/**
 * Update course
 * PATCH /education/courses/:id
 */
export const updateCourse = async (
  courseId: string,
  updates: Partial<Course>
): Promise<Course> => {
  return api.patch(`/education/courses/${courseId}`, updates);
};

/**
 * Delete course
 * DELETE /education/courses/:id
 */
export const deleteCourse = async (courseId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/education/courses/${courseId}`);
};

/**
 * Get all certifications
 * GET /education/certifications
 */
export const getCertifications = async (): Promise<Certification[]> => {
  return api.get('/education/certifications');
};

/**
 * Get single certification
 * GET /education/certifications/:id
 */
export const getCertification = async (certificationId: string): Promise<Certification> => {
  return api.get(`/education/certifications/${certificationId}`);
};

/**
 * Create certification
 * POST /education/certifications
 */
export const createCertification = async (
  certification: Omit<Certification, 'id'>
): Promise<Certification> => {
  return api.post('/education/certifications', certification);
};

/**
 * Update certification
 * PATCH /education/certifications/:id
 */
export const updateCertification = async (
  certificationId: string,
  updates: Partial<Certification>
): Promise<Certification> => {
  return api.patch(`/education/certifications/${certificationId}`, updates);
};

/**
 * Delete certification
 * DELETE /education/certifications/:id
 */
export const deleteCertification = async (
  certificationId: string
): Promise<ApiResponse<null>> => {
  return api.delete(`/education/certifications/${certificationId}`);
};

/**
 * Get learning progress
 * GET /education/progress
 */
export const getLearningProgress = async (): Promise<LearningProgress> => {
  return api.get('/education/progress');
};

/**
 * Log study time
 * POST /education/progress/log-time
 */
export const logStudyTime = async (data: {
  courseId?: string;
  hours: number;
  date: string;
}): Promise<ApiResponse<{ logged: boolean }>> => {
  return api.post('/education/progress/log-time', data);
};

export default {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getCertifications,
  getCertification,
  createCertification,
  updateCertification,
  deleteCertification,
  getLearningProgress,
  logStudyTime,
};
