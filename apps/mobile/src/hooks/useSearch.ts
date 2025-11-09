/**
 * Life Navigator - Search Hooks
 *
 * React Query hooks for universal search functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface SearchResult {
  id: string;
  type: 'medication' | 'appointment' | 'goal' | 'transaction' | 'document' | 'contact' | 'course' | 'job';
  title: string;
  subtitle?: string;
  description: string;
  domain: string;
  metadata?: {
    date?: string;
    amount?: string;
    status?: string;
    tags?: string[];
  };
  score: number;
}

export interface SearchFilter {
  types: string[];
  domains: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
}

export interface RecentSearch {
  id: string;
  query: string;
  timestamp: string;
}

export interface SuggestedSearch {
  id: string;
  query: string;
  category: string;
  icon: string;
}

/**
 * Query Keys for cache management
 */
export const searchKeys = {
  all: ['search'] as const,
  results: (query: string, filters?: SearchFilter) => [...searchKeys.all, 'results', query, filters] as const,
  recent: () => [...searchKeys.all, 'recent'] as const,
  suggested: () => [...searchKeys.all, 'suggested'] as const,
};

/**
 * Search across all modules
 */
export const useSearch = (query: string, filters?: SearchFilter) => {
  return useQuery<SearchResult[]>({
    queryKey: searchKeys.results(query, filters),
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // TODO: Replace with actual API call
      const params = new URLSearchParams({ q: query });

      if (filters?.types.length) {
        params.append('types', filters.types.join(','));
      }
      if (filters?.domains.length) {
        params.append('domains', filters.domains.join(','));
      }
      if (filters?.dateRange) {
        params.append('start_date', filters.dateRange.start);
        params.append('end_date', filters.dateRange.end);
      }
      if (filters?.tags?.length) {
        params.append('tags', filters.tags.join(','));
      }

      const response = await fetch(`/api/v1/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: query.length >= 2,
  });
};

/**
 * Fetch recent searches
 */
export const useRecentSearches = () => {
  return useQuery<RecentSearch[]>({
    queryKey: searchKeys.recent(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/search/recent');
      if (!response.ok) throw new Error('Failed to fetch recent searches');
      return response.json();
    },
  });
};

/**
 * Fetch AI-suggested searches
 */
export const useSuggestedSearches = () => {
  return useQuery<SuggestedSearch[]>({
    queryKey: searchKeys.suggested(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/search/suggested');
      if (!response.ok) throw new Error('Failed to fetch suggested searches');
      return response.json();
    },
  });
};

/**
 * Save search to history
 */
export const useSaveSearch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (query: string) => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/search/recent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error('Failed to save search');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchKeys.recent() });
    },
  });
};

/**
 * Clear recent searches
 */
export const useClearRecentSearches = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/search/recent', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear recent searches');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchKeys.recent() });
    },
  });
};

/**
 * Delete specific recent search
 */
export const useDeleteRecentSearch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (searchId: string) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/search/recent/${searchId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete search');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchKeys.recent() });
    },
  });
};

/**
 * Advanced search with voice input
 */
export const useVoiceSearch = () => {
  return useMutation({
    mutationFn: async (audioData: Blob) => {
      // TODO: Replace with actual API call to speech-to-text service
      const formData = new FormData();
      formData.append('audio', audioData);

      const response = await fetch('/api/v1/search/voice', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Voice search failed');
      return response.json();
    },
  });
};

export default {
  useSearch,
  useRecentSearches,
  useSuggestedSearches,
  useSaveSearch,
  useClearRecentSearches,
  useDeleteRecentSearch,
  useVoiceSearch,
};
