/**
 * Life Navigator - Universal Search Screen
 *
 * Elite-level universal search across all modules
 * Advanced filtering, recent searches, AI-powered suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Card } from '../../components/common/Card';

// Types
interface SearchResult {
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

interface SearchFilter {
  types: string[];
  domains: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: string;
}

interface SuggestedSearch {
  id: string;
  query: string;
  category: string;
  icon: string;
}

export function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<SearchFilter>({
    types: [],
    domains: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results
  const { data: searchResults, isLoading } = useQuery<SearchResult[]>({
    queryKey: ['search', debouncedQuery, activeFilters],
    queryFn: async () => {
      if (!debouncedQuery) return [];
      // TODO: Replace with actual API call
      return mockSearchResults.filter((result) => {
        const matchesQuery = result.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          result.description.toLowerCase().includes(debouncedQuery.toLowerCase());
        const matchesType = activeFilters.types.length === 0 || activeFilters.types.includes(result.type);
        const matchesDomain = activeFilters.domains.length === 0 || activeFilters.domains.includes(result.domain);
        return matchesQuery && matchesType && matchesDomain;
      });
    },
    enabled: debouncedQuery.length > 0,
  });

  // Fetch recent searches
  const { data: recentSearches } = useQuery<RecentSearch[]>({
    queryKey: ['recent-searches'],
    queryFn: async () => {
      return mockRecentSearches;
    },
  });

  // Fetch suggested searches
  const { data: suggestedSearches } = useQuery<SuggestedSearch[]>({
    queryKey: ['suggested-searches'],
    queryFn: async () => {
      return mockSuggestedSearches;
    },
  });

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      // TODO: Save to recent searches
      console.log('Searching for:', searchQuery);
    }
  };

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
    setDebouncedQuery(query);
  };

  const handleFilterToggle = (filterType: 'types' | 'domains', value: string) => {
    setActiveFilters((prev) => {
      const currentValues = prev[filterType];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [filterType]: newValues };
    });
  };

  const clearFilters = () => {
    setActiveFilters({ types: [], domains: [] });
  };

  const getResultIcon = (type: string) => {
    const icons: Record<string, string> = {
      medication: '💊',
      appointment: '📅',
      goal: '🎯',
      transaction: '💰',
      document: '📄',
      contact: '👤',
      course: '📚',
      job: '💼',
    };
    return icons[type] || '📌';
  };

  const getDomainColor = (domain: string) => {
    const domainColors: Record<string, string> = {
      healthcare: colors.error,
      finance: colors.success,
      career: colors.info,
      education: colors.warning,
      family: colors.primary,
      goals: colors.secondary,
    };
    return domainColors[domain] || colors.gray[500];
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      onPress={() => console.log('Navigate to:', item.type, item.id)}
    >
      <Card style={styles.resultCard} shadow="sm">
        <View style={styles.resultHeader}>
          <Text style={styles.resultIcon}>{getResultIcon(item.type)}</Text>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.title}</Text>
            {item.subtitle && (
              <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
            )}
          </View>
          <View style={[styles.domainBadge, { backgroundColor: getDomainColor(item.domain) + '20' }]}>
            <Text style={[styles.domainText, { color: getDomainColor(item.domain) }]}>
              {item.domain}
            </Text>
          </View>
        </View>

        <Text style={styles.resultDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {item.metadata && (
          <View style={styles.resultMeta}>
            {item.metadata.date && (
              <Text style={styles.metaText}>📅 {item.metadata.date}</Text>
            )}
            {item.metadata.amount && (
              <Text style={styles.metaText}>💰 {item.metadata.amount}</Text>
            )}
            {item.metadata.status && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.metadata.status}</Text>
              </View>
            )}
          </View>
        )}

        {item.metadata?.tags && item.metadata.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {item.metadata.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  const renderRecentSearch = (search: RecentSearch) => (
    <TouchableOpacity
      key={search.id}
      style={styles.recentItem}
      onPress={() => handleRecentSearchClick(search.query)}
    >
      <Text style={styles.recentIcon}>🕐</Text>
      <Text style={styles.recentText}>{search.query}</Text>
      <Text style={styles.recentTime}>{formatTimestamp(search.timestamp)}</Text>
    </TouchableOpacity>
  );

  const renderSuggestedSearch = (suggestion: SuggestedSearch) => (
    <TouchableOpacity
      key={suggestion.id}
      style={styles.suggestionChip}
      onPress={() => handleRecentSearchClick(suggestion.query)}
    >
      <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
      <Text style={styles.suggestionText}>{suggestion.query}</Text>
    </TouchableOpacity>
  );

  const activeFilterCount = activeFilters.types.length + activeFilters.domains.length;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search across all modules..."
            placeholderTextColor={colors.gray[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Advanced Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterSectionTitle}>Type</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={styles.clearFiltersText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['medication', 'appointment', 'goal', 'transaction', 'document', 'contact', 'course', 'job'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    activeFilters.types.includes(type) && styles.filterChipActive,
                  ]}
                  onPress={() => handleFilterToggle('types', type)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeFilters.types.includes(type) && styles.filterChipTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Domain</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['healthcare', 'finance', 'career', 'education', 'family', 'goals'].map((domain) => (
                <TouchableOpacity
                  key={domain}
                  style={[
                    styles.filterChip,
                    activeFilters.domains.includes(domain) && styles.filterChipActive,
                  ]}
                  onPress={() => handleFilterToggle('domains', domain)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeFilters.domains.includes(domain) && styles.filterChipTextActive,
                    ]}
                  >
                    {domain}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content}>
        {searchQuery.length === 0 ? (
          <View>
            {/* Suggested Searches */}
            {suggestedSearches && suggestedSearches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Suggested Searches</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {suggestedSearches.map(renderSuggestedSearch)}
                </ScrollView>
              </View>
            )}

            {/* Recent Searches */}
            {recentSearches && recentSearches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                {recentSearches.map(renderRecentSearch)}
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickAction}>
                  <Text style={styles.quickActionIcon}>💊</Text>
                  <Text style={styles.quickActionText}>Medications</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction}>
                  <Text style={styles.quickActionIcon}>📅</Text>
                  <Text style={styles.quickActionText}>Appointments</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction}>
                  <Text style={styles.quickActionIcon}>🎯</Text>
                  <Text style={styles.quickActionText}>Goals</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction}>
                  <Text style={styles.quickActionIcon}>💰</Text>
                  <Text style={styles.quickActionText}>Transactions</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : searchResults && searchResults.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {searchResults.length} {searchResults.length === 1 ? 'Result' : 'Results'}
            </Text>
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyDescription}>
              Try adjusting your search terms or filters
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Helper function
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

// Mock data
const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    type: 'medication',
    title: 'Lisinopril 10mg',
    subtitle: 'Blood pressure medication',
    description: 'Take 1 tablet daily in the morning',
    domain: 'healthcare',
    metadata: {
      status: 'Active',
      tags: ['prescription', 'daily'],
    },
    score: 0.95,
  },
  {
    id: '2',
    type: 'appointment',
    title: 'Annual Physical',
    subtitle: 'Dr. Sarah Smith',
    description: 'Yearly checkup and health screening',
    domain: 'healthcare',
    metadata: {
      date: 'Nov 15, 2025 2:00 PM',
      status: 'Upcoming',
    },
    score: 0.88,
  },
  {
    id: '3',
    type: 'goal',
    title: 'Emergency Fund',
    subtitle: 'Save $10,000',
    description: 'Build emergency savings for 6 months expenses',
    domain: 'finance',
    metadata: {
      status: '45% Complete',
      tags: ['savings', 'financial security'],
    },
    score: 0.82,
  },
  {
    id: '4',
    type: 'transaction',
    title: 'Grocery Store',
    description: 'Weekly grocery shopping',
    domain: 'finance',
    metadata: {
      date: 'Nov 5, 2025',
      amount: '$127.45',
      tags: ['groceries', 'food'],
    },
    score: 0.76,
  },
  {
    id: '5',
    type: 'document',
    title: 'Insurance Policy.pdf',
    description: 'Health insurance coverage document',
    domain: 'healthcare',
    metadata: {
      date: 'Oct 1, 2025',
      tags: ['insurance', 'important'],
    },
    score: 0.71,
  },
];

const mockRecentSearches: RecentSearch[] = [
  {
    id: 'r1',
    query: 'blood pressure medication',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'r2',
    query: 'upcoming appointments',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'r3',
    query: 'savings goals',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockSuggestedSearches: SuggestedSearch[] = [
  { id: 's1', query: 'medications due today', category: 'healthcare', icon: '💊' },
  { id: 's2', query: 'this month spending', category: 'finance', icon: '💰' },
  { id: 's3', query: 'active goals', category: 'goals', icon: '🎯' },
  { id: 's4', query: 'upcoming appointments', category: 'healthcare', icon: '📅' },
  { id: 's5', query: 'recent documents', category: 'documents', icon: '📄' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  searchBar: {
    flexDirection: 'row',
    padding: spacing[4],
    paddingTop: spacing[6],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    gap: spacing[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    ...textStyles.body,
    color: colors.gray[900],
    paddingVertical: spacing[2],
  },
  clearIcon: {
    fontSize: 18,
    color: colors.gray[500],
    padding: spacing[1],
  },
  filterButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterIcon: {
    fontSize: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    ...textStyles.caption,
    color: colors.light.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  filtersContainer: {
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    paddingVertical: spacing[2],
  },
  filterSection: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  filterSectionTitle: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  clearFiltersText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    ...textStyles.body,
    color: colors.gray[700],
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: colors.light.primary,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  loadingText: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  section: {
    padding: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
    ...shadows.sm,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: spacing[2],
  },
  suggestionText: {
    ...textStyles.body,
    color: colors.gray[700],
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  recentIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  recentText: {
    flex: 1,
    ...textStyles.body,
    color: colors.gray[900],
  },
  recentTime: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  quickAction: {
    width: '47%',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  quickActionText: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
  },
  resultCard: {
    marginBottom: spacing[3],
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  resultIcon: {
    fontSize: 24,
    marginRight: spacing[2],
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  resultSubtitle: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginTop: spacing[1],
  },
  domainBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  domainText: {
    ...textStyles.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  resultDescription: {
    ...textStyles.body,
    color: colors.gray[700],
    marginBottom: spacing[2],
    lineHeight: 22,
  },
  resultMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  metaText: {
    ...textStyles.caption,
    color: colors.gray[600],
  },
  statusBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...textStyles.caption,
    color: colors.success,
    fontWeight: '600',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
  },
  tag: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  tagText: {
    ...textStyles.caption,
    color: colors.gray[700],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyDescription: {
    ...textStyles.body,
    color: colors.gray[600],
    textAlign: 'center',
  },
  bottomPadding: {
    height: spacing[8],
  },
});
