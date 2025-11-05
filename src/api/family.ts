/**
 * Life Navigator - Family API
 *
 * Elite-level family API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import {
  FamilyMember,
  FamilyTask,
  FamilyEvent,
  FamilyDocument,
  ApiResponse,
} from '../types';

/**
 * Get all family members
 * GET /family/members
 */
export const getFamilyMembers = async (): Promise<FamilyMember[]> => {
  return api.get('/family/members');
};

/**
 * Get single family member by ID
 * GET /family/members/:id
 */
export const getFamilyMember = async (memberId: string): Promise<FamilyMember> => {
  return api.get(`/family/members/${memberId}`);
};

/**
 * Add family member
 * POST /family/members
 */
export const addFamilyMember = async (
  member: Omit<FamilyMember, 'id'>
): Promise<FamilyMember> => {
  return api.post('/family/members', member);
};

/**
 * Update family member
 * PATCH /family/members/:id
 */
export const updateFamilyMember = async (
  memberId: string,
  updates: Partial<FamilyMember>
): Promise<FamilyMember> => {
  return api.patch(`/family/members/${memberId}`, updates);
};

/**
 * Delete family member
 * DELETE /family/members/:id
 */
export const deleteFamilyMember = async (memberId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/family/members/${memberId}`);
};

/**
 * Get family tasks
 * GET /family/tasks
 */
export const getFamilyTasks = async (params?: {
  assignedTo?: string;
  completed?: boolean;
}): Promise<FamilyTask[]> => {
  return api.get('/family/tasks', { params });
};

/**
 * Get single task by ID
 * GET /family/tasks/:id
 */
export const getFamilyTask = async (taskId: string): Promise<FamilyTask> => {
  return api.get(`/family/tasks/${taskId}`);
};

/**
 * Create family task
 * POST /family/tasks
 */
export const createFamilyTask = async (task: Omit<FamilyTask, 'id'>): Promise<FamilyTask> => {
  return api.post('/family/tasks', task);
};

/**
 * Update family task
 * PATCH /family/tasks/:id
 */
export const updateFamilyTask = async (
  taskId: string,
  updates: Partial<FamilyTask>
): Promise<FamilyTask> => {
  return api.patch(`/family/tasks/${taskId}`, updates);
};

/**
 * Mark task as completed
 * POST /family/tasks/:id/complete
 */
export const completeFamilyTask = async (taskId: string): Promise<FamilyTask> => {
  return api.post(`/family/tasks/${taskId}/complete`);
};

/**
 * Delete family task
 * DELETE /family/tasks/:id
 */
export const deleteFamilyTask = async (taskId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/family/tasks/${taskId}`);
};

/**
 * Get family events
 * GET /family/events
 */
export const getFamilyEvents = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<FamilyEvent[]> => {
  return api.get('/family/events', { params });
};

/**
 * Get single event by ID
 * GET /family/events/:id
 */
export const getFamilyEvent = async (eventId: string): Promise<FamilyEvent> => {
  return api.get(`/family/events/${eventId}`);
};

/**
 * Create family event
 * POST /family/events
 */
export const createFamilyEvent = async (event: Omit<FamilyEvent, 'id'>): Promise<FamilyEvent> => {
  return api.post('/family/events', event);
};

/**
 * Update family event
 * PATCH /family/events/:id
 */
export const updateFamilyEvent = async (
  eventId: string,
  updates: Partial<FamilyEvent>
): Promise<FamilyEvent> => {
  return api.patch(`/family/events/${eventId}`, updates);
};

/**
 * Delete family event
 * DELETE /family/events/:id
 */
export const deleteFamilyEvent = async (eventId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/family/events/${eventId}`);
};

/**
 * Sync calendar events
 * POST /family/calendar/sync
 */
export const syncCalendar = async (): Promise<ApiResponse<{ synced: number }>> => {
  return api.post('/family/calendar/sync');
};

/**
 * Get family documents
 * GET /family/documents
 */
export const getFamilyDocuments = async (params?: {
  type?: string;
  memberId?: string;
}): Promise<FamilyDocument[]> => {
  return api.get('/family/documents', { params });
};

/**
 * Upload family document
 * POST /family/documents
 */
export const uploadFamilyDocument = async (
  file: FormData
): Promise<FamilyDocument> => {
  return api.post('/family/documents', file, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Delete family document
 * DELETE /family/documents/:id
 */
export const deleteFamilyDocument = async (documentId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/family/documents/${documentId}`);
};

export default {
  getFamilyMembers,
  getFamilyMember,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  getFamilyTasks,
  getFamilyTask,
  createFamilyTask,
  updateFamilyTask,
  completeFamilyTask,
  deleteFamilyTask,
  getFamilyEvents,
  getFamilyEvent,
  createFamilyEvent,
  updateFamilyEvent,
  deleteFamilyEvent,
  syncCalendar,
  getFamilyDocuments,
  uploadFamilyDocument,
  deleteFamilyDocument,
};
