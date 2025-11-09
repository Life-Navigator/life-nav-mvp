/**
 * Life Navigator - Family Data Hooks
 *
 * React Query hooks for family data management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as familyApi from '../api/family';
import { FamilyMember, FamilyEvent } from '../types';

/**
 * Query Keys for cache management
 */
export const familyKeys = {
  all: ['family'] as const,
  members: () => [...familyKeys.all, 'members'] as const,
  member: (id: string) => [...familyKeys.members(), id] as const,
  events: (filters?: any) => [...familyKeys.all, 'events', filters] as const,
};

/**
 * Fetch all family members
 */
export const useFamilyMembers = () => {
  return useQuery({
    queryKey: familyKeys.members(),
    queryFn: familyApi.getFamilyMembers,
  });
};

/**
 * Fetch single family member
 */
export const useFamilyMember = (memberId: string) => {
  return useQuery({
    queryKey: familyKeys.member(memberId),
    queryFn: () => familyApi.getFamilyMember(memberId),
    enabled: !!memberId,
  });
};

/**
 * Add family member
 */
export const useAddFamilyMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: familyApi.addFamilyMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.members() });
    },
  });
};

/**
 * Update family member
 */
export const useUpdateFamilyMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FamilyMember> }) =>
      familyApi.updateFamilyMember(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: familyKeys.member(variables.id) });
      queryClient.invalidateQueries({ queryKey: familyKeys.members() });
    },
  });
};

/**
 * Delete family member
 */
export const useDeleteFamilyMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: familyApi.deleteFamilyMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.members() });
    },
  });
};

/**
 * Fetch family events
 */
export const useFamilyEvents = (params?: { startDate?: string; endDate?: string }) => {
  return useQuery({
    queryKey: familyKeys.events(params),
    queryFn: () => familyApi.getFamilyEvents(params),
  });
};

/**
 * Create family event
 */
export const useCreateFamilyEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: familyApi.createFamilyEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.events() });
    },
  });
};

/**
 * Update family event
 */
export const useUpdateFamilyEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FamilyEvent> }) =>
      familyApi.updateFamilyEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.events() });
    },
  });
};

/**
 * Delete family event
 */
export const useDeleteFamilyEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: familyApi.deleteFamilyEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.events() });
    },
  });
};

export default {
  useFamilyMembers,
  useFamilyMember,
  useAddFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
  useFamilyEvents,
  useCreateFamilyEvent,
  useUpdateFamilyEvent,
  useDeleteFamilyEvent,
};
