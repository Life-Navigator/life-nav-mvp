/**
 * Life Navigator - Networking Screen
 *
 * Professional networking CRM with social integration, events, and analytics
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useNetworkContacts, useCreateNetworkContact, useUpdateNetworkContact } from '../../hooks/useCareer';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { NetworkContact } from '../../types';
import SocialConnectionsScreen from './SocialConnectionsScreen';
import EventsScreen from './EventsScreen';
import NetworkAnalyticsScreen from './NetworkAnalyticsScreen';

type TabType = 'contacts' | 'social' | 'events' | 'analytics';

export function NetworkingScreen() {
  const { data: contacts, isLoading, error } = useNetworkContacts();
  const createContact = useCreateNetworkContact();
  const updateContact = useUpdateNetworkContact();

  const [selectedTab, setSelectedTab] = useState<TabType>('contacts');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Mentor', 'Colleague', 'Recruiter', 'Client', 'Other'];

  const filteredContacts = contacts?.filter((contact) => {
    const matchesCategory = selectedCategory === 'All' || contact.category === selectedCategory.toLowerCase();
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryColor = (category: string) => {
    const colors_map: Record<string, string> = {
      mentor: colors.charts.purple,
      colleague: colors.charts.blue,
      recruiter: colors.charts.green,
      client: colors.charts.yellow,
      other: colors.gray[500],
    };
    return colors_map[category.toLowerCase()] || colors.gray[500];
  };

  const needsFollowUp = (contact: NetworkContact) => {
    if (!contact.nextFollowUp) return false;
    return new Date(contact.nextFollowUp) <= new Date();
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'contacts', label: 'Contacts', icon: '👥' },
    { key: 'social', label: 'Social', icon: '🔗' },
    { key: 'events', label: 'Events', icon: '📅' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'social':
        return <SocialConnectionsScreen />;
      case 'events':
        return <EventsScreen />;
      case 'analytics':
        return <NetworkAnalyticsScreen />;
      case 'contacts':
      default:
        return renderContactsTab();
    }
  };

  const renderContactsTab = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.domains.career} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load contacts</Text>
        </View>
      );
    }

    return (
      <>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.text.light.tertiary}
          />
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{contacts?.length || 0}</Text>
            <Text style={styles.statLabel}>Total Contacts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.semantic.warning }]}>
              {contacts?.filter(needsFollowUp).length || 0}
            </Text>
            <Text style={styles.statLabel}>Follow-ups Due</Text>
          </View>
        </View>

        {/* Contacts List */}
        <ScrollView style={styles.contactsList}>
          {filteredContacts?.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No contacts found</Text>
              <Text style={styles.emptySubtext}>
                Add contacts to build your professional network
              </Text>
            </View>
          ) : (
            filteredContacts?.map((contact) => (
              <TouchableOpacity key={contact.id} style={styles.contactCard}>
                {/* Contact Avatar/Initials */}
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: getCategoryColor(contact.category) },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {contact.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>

                <View style={styles.contactInfo}>
                  {/* Name and Category */}
                  <View style={styles.contactHeader}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: getCategoryColor(contact.category) },
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>
                        {contact.category}
                      </Text>
                    </View>
                  </View>

                  {/* Company and Position */}
                  {(contact.company || contact.position) && (
                    <Text style={styles.companyText}>
                      {contact.position}
                      {contact.position && contact.company ? ' at ' : ''}
                      {contact.company}
                    </Text>
                  )}

                  {/* Last Contact */}
                  {contact.lastContact && (
                    <Text style={styles.lastContactText}>
                      Last contact: {formatRelativeTime(contact.lastContact)}
                    </Text>
                  )}

                  {/* Follow-up Alert */}
                  {needsFollowUp(contact) && (
                    <View style={styles.followUpAlert}>
                      <Text style={styles.followUpText}>Follow-up due!</Text>
                    </View>
                  )}

                  {/* Tags */}
                  {contact.tags && contact.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {contact.tags.slice(0, 3).map((tag, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                      {contact.tags.length > 3 && (
                        <Text style={styles.moreTagsText}>
                          +{contact.tags.length - 3} more
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Meeting History Count */}
                  {contact.meetingHistory && contact.meetingHistory.length > 0 && (
                    <Text style={styles.meetingCount}>
                      {contact.meetingHistory.length} meeting
                      {contact.meetingHistory.length !== 1 ? 's' : ''} recorded
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Tabs */}
      <View style={styles.header}>
        <Text style={styles.title}>Professional Network</Text>
        {selectedTab === 'contacts' && (
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, selectedTab === tab.key && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                selectedTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>{renderTabContent()}</View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    padding: spacing[6],
  },
  errorText: {
    ...textStyles.body,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  addButton: {
    backgroundColor: colors.domains.career,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.domains.career,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: spacing[1],
  },
  tabLabel: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  tabLabelActive: {
    color: colors.domains.career,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  searchContainer: {
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  searchInput: {
    ...textStyles.body,
    backgroundColor: colors.light.tertiary,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  categoryFilter: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  categoryChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  categoryChipActive: {
    backgroundColor: colors.domains.career,
    borderColor: colors.domains.career,
  },
  categoryChipText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  categoryChipTextActive: {
    color: colors.text.light.inverse,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...textStyles.h2,
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  contactsList: {
    flex: 1,
    padding: spacing[4],
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyText: {
    ...textStyles.h4,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  emptySubtext: {
    ...textStyles.body,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    ...textStyles.h4,
    color: colors.text.light.inverse,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[1],
  },
  contactName: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  categoryBadgeText: {
    ...textStyles.labelSmall,
    color: colors.text.light.inverse,
    textTransform: 'capitalize',
  },
  companyText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  lastContactText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginBottom: spacing[2],
  },
  followUpAlert: {
    backgroundColor: colors.semantic.warning,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  followUpText: {
    ...textStyles.labelSmall,
    color: colors.text.light.inverse,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  tag: {
    backgroundColor: colors.light.tertiary,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  tagText: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  moreTagsText: {
    ...textStyles.labelSmall,
    color: colors.text.light.tertiary,
    alignSelf: 'center',
  },
  meetingCount: {
    ...textStyles.caption,
    color: colors.domains.career,
  },
});

export default NetworkingScreen;
