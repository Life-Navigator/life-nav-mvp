/**
 * Life Navigator - Events Screen
 *
 * Comprehensive event discovery with multiple sources and filters
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  Share,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Event, EventCategory, EventPlatform } from '../../types/career';
import EventDiscoveryService from '../../services/career/EventDiscoveryService';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

type TabType = 'nearby' | 'professional' | 'chamber' | 'industry' | 'saved';

export function EventsScreen() {
  const [selectedTab, setSelectedTab] = useState<TabType>('nearby');
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<EventPlatform[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isFreeOnly, setIsFreeOnly] = useState(false);
  const [isVirtualOnly, setIsVirtualOnly] = useState(false);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'nearby', label: 'Nearby Events' },
    { key: 'professional', label: 'Professional' },
    { key: 'chamber', label: 'Chamber' },
    { key: 'industry', label: 'Industry' },
    { key: 'saved', label: 'Saved' },
  ];

  const platforms: EventPlatform[] = ['eventbrite', 'meetup', 'chamber', 'local', 'linkedin'];

  useEffect(() => {
    loadEvents();
  }, [selectedTab]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      let loadedEvents: Event[] = [];

      switch (selectedTab) {
        case 'nearby':
          loadedEvents = await EventDiscoveryService.getNearbyEvents(25);
          break;
        case 'professional':
          loadedEvents = await EventDiscoveryService.getEventsByCategory('networking');
          const conferences = await EventDiscoveryService.getEventsByCategory('conference');
          loadedEvents = [...loadedEvents, ...conferences];
          break;
        case 'chamber':
          loadedEvents = await EventDiscoveryService.getEventsByCategory('chamber');
          break;
        case 'industry':
          loadedEvents = await EventDiscoveryService.getEventsByCategory('industry');
          break;
        case 'saved':
          const savedEvents = await EventDiscoveryService.getSavedEventsList();
          loadedEvents = savedEvents.map((se) => se.event);
          break;
      }

      setEvents(loadedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'Failed to load events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvents();
    setIsRefreshing(false);
  };

  const handleSaveEvent = async (event: Event) => {
    try {
      if (event.isSaved) {
        await EventDiscoveryService.unsaveEventFromList(event.id);
        Alert.alert('Success', 'Event removed from saved list');
      } else {
        await EventDiscoveryService.saveEventToList(event.id);
        Alert.alert('Success', 'Event saved!');
      }
      await loadEvents();
    } catch (error) {
      Alert.alert('Error', 'Failed to save event');
    }
  };

  const handleRSVP = async (event: Event) => {
    try {
      await EventDiscoveryService.rsvpToEvent(event.id, 'going');
      Alert.alert('Success', "You've RSVP'd to this event!");
      await loadEvents();
    } catch (error) {
      Alert.alert('Error', 'Failed to RSVP');
    }
  };

  const handleAddToCalendar = async (event: Event) => {
    try {
      await EventDiscoveryService.addEventToCalendar(event);
      Alert.alert('Success', 'Event added to your calendar!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add event to calendar');
    }
  };

  const handleShareEvent = async (event: Event) => {
    try {
      await Share.share({
        message: `Check out this event: ${event.title}\n${event.externalUrl}`,
        title: event.title,
      });
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  const togglePlatformFilter = (platform: EventPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const getFilteredEvents = () => {
    return EventDiscoveryService.filterEvents(events, {
      platform: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
      isFreeOnly,
      isVirtualOnly,
      searchQuery: searchQuery.trim() || undefined,
    });
  };

  const getPlatformColor = (platform: EventPlatform): string => {
    const colors_map: Record<EventPlatform, string> = {
      eventbrite: colors.charts.blue,
      meetup: colors.charts.red,
      chamber: colors.charts.purple,
      local: colors.charts.green,
      linkedin: '#0077B5',
    };
    return colors_map[platform] || colors.gray[500];
  };

  const getPlatformIcon = (platform: EventPlatform): string => {
    const icons: Record<EventPlatform, string> = {
      eventbrite: 'EB',
      meetup: 'MU',
      chamber: 'CC',
      local: 'LO',
      linkedin: 'LI',
    };
    return icons[platform];
  };

  const filteredEvents = getFilteredEvents();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.career} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Event Discovery</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowMap(!showMap)}
          >
            <Text style={styles.headerButtonText}>{showMap ? 'List' : 'Map'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.headerButtonText}>Filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.text.light.tertiary}
        />
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Platform Filters */}
          <Text style={styles.filterLabel}>Platforms:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformFilters}>
            {platforms.map((platform) => (
              <TouchableOpacity
                key={platform}
                style={[
                  styles.platformChip,
                  selectedPlatforms.includes(platform) && {
                    backgroundColor: getPlatformColor(platform),
                  },
                ]}
                onPress={() => togglePlatformFilter(platform)}
              >
                <Text
                  style={[
                    styles.platformChipText,
                    selectedPlatforms.includes(platform) && styles.platformChipTextActive,
                  ]}
                >
                  {platform}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Other Filters */}
          <View style={styles.otherFilters}>
            <TouchableOpacity
              style={[styles.filterToggle, isFreeOnly && styles.filterToggleActive]}
              onPress={() => setIsFreeOnly(!isFreeOnly)}
            >
              <Text
                style={[
                  styles.filterToggleText,
                  isFreeOnly && styles.filterToggleTextActive,
                ]}
              >
                Free Only
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterToggle, isVirtualOnly && styles.filterToggleActive]}
              onPress={() => setIsVirtualOnly(!isVirtualOnly)}
            >
              <Text
                style={[
                  styles.filterToggleText,
                  isVirtualOnly && styles.filterToggleTextActive,
                ]}
              >
                Virtual Only
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selectedTab === tab.key && styles.tabActive]}
            onPress={() => setSelectedTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map View */}
      {showMap ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 37.78825,
            longitude: -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {filteredEvents
            .filter((e) => e.location.latitude && e.location.longitude)
            .map((event) => (
              <Marker
                key={event.id}
                coordinate={{
                  latitude: event.location.latitude!,
                  longitude: event.location.longitude!,
                }}
                title={event.title}
                description={event.location.address}
              />
            ))}
        </MapView>
      ) : (
        /* Events List */
        <ScrollView
          style={styles.eventsList}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your filters or search query
              </Text>
            </View>
          ) : (
            filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onSave={() => handleSaveEvent(event)}
                onRSVP={() => handleRSVP(event)}
                onAddToCalendar={() => handleAddToCalendar(event)}
                onShare={() => handleShareEvent(event)}
                getPlatformColor={getPlatformColor}
                getPlatformIcon={getPlatformIcon}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

interface EventCardProps {
  event: Event;
  onSave: () => void;
  onRSVP: () => void;
  onAddToCalendar: () => void;
  onShare: () => void;
  getPlatformColor: (platform: EventPlatform) => string;
  getPlatformIcon: (platform: EventPlatform) => string;
}

function EventCard({
  event,
  onSave,
  onRSVP,
  onAddToCalendar,
  onShare,
  getPlatformColor,
  getPlatformIcon,
}: EventCardProps) {
  return (
    <View style={styles.eventCard}>
      {/* Event Image */}
      {event.imageUrl && (
        <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
      )}

      <View style={styles.eventContent}>
        {/* Platform Badge */}
        <View
          style={[
            styles.platformBadge,
            { backgroundColor: getPlatformColor(event.platform) },
          ]}
        >
          <Text style={styles.platformBadgeText}>{getPlatformIcon(event.platform)}</Text>
        </View>

        {/* Event Title */}
        <Text style={styles.eventTitle} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Date and Location */}
        <View style={styles.eventMeta}>
          <Text style={styles.eventDate}>{formatDate(event.date)}</Text>
          <Text style={styles.eventLocation} numberOfLines={1}>
            {event.location.isVirtual ? 'Virtual' : event.location.city}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.eventDescription} numberOfLines={3}>
          {event.description}
        </Text>

        {/* Organizer */}
        <Text style={styles.eventOrganizer}>By {event.organizer.name}</Text>

        {/* Attendees and Price */}
        <View style={styles.eventStats}>
          <Text style={styles.eventStat}>
            {event.attendees.registered} attending
          </Text>
          <Text style={[styles.eventPrice, event.pricing.isFree && styles.eventPriceFree]}>
            {event.pricing.isFree
              ? 'FREE'
              : `$${event.pricing.price} ${event.pricing.currency}`}
          </Text>
        </View>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <View style={styles.eventTags}>
            {event.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.eventTag}>
                <Text style={styles.eventTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={onSave}
          >
            <Text style={styles.actionButtonText}>
              {event.isSaved ? 'Unsave' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rsvpButton]}
            onPress={onRSVP}
          >
            <Text style={styles.actionButtonTextPrimary}>RSVP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onAddToCalendar}
          >
            <Text style={styles.iconButtonText}>+Cal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onShare}>
            <Text style={styles.iconButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  headerActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  headerButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.tertiary,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  headerButtonText: {
    ...textStyles.label,
    color: colors.text.light.primary,
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
  filtersPanel: {
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  filterLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  platformFilters: {
    marginBottom: spacing[3],
  },
  platformChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  platformChipText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    textTransform: 'capitalize',
  },
  platformChipTextActive: {
    color: colors.text.light.inverse,
  },
  otherFilters: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  filterToggle: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  filterToggleActive: {
    backgroundColor: colors.domains.career,
    borderColor: colors.domains.career,
  },
  filterToggleText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  filterToggleTextActive: {
    color: colors.text.light.inverse,
  },
  tabsContainer: {
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  tabActive: {
    backgroundColor: colors.domains.career,
  },
  tabText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  tabTextActive: {
    color: colors.text.light.inverse,
  },
  map: {
    flex: 1,
  },
  eventsList: {
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
  eventCard: {
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    overflow: 'hidden',
    ...shadows.md,
  },
  eventImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  eventContent: {
    padding: spacing[4],
  },
  platformBadge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  platformBadgeText: {
    ...textStyles.labelSmall,
    color: colors.text.light.inverse,
    fontWeight: 'bold',
  },
  eventTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
    paddingRight: spacing[8],
  },
  eventMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  eventDate: {
    ...textStyles.caption,
    color: colors.domains.career,
    fontWeight: '600',
  },
  eventLocation: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
    flex: 1,
    textAlign: 'right',
  },
  eventDescription: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  eventOrganizer: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginBottom: spacing[2],
  },
  eventStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  eventStat: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  eventPrice: {
    ...textStyles.label,
    color: colors.text.light.primary,
    fontWeight: '600',
  },
  eventPriceFree: {
    color: colors.semantic.success,
  },
  eventTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginBottom: spacing[3],
  },
  eventTag: {
    backgroundColor: colors.light.tertiary,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  eventTagText: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  eventActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  rsvpButton: {
    backgroundColor: colors.domains.career,
  },
  actionButtonText: {
    ...textStyles.label,
    color: colors.text.light.primary,
  },
  actionButtonTextPrimary: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  iconButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  iconButtonText: {
    ...textStyles.labelSmall,
    color: colors.text.light.primary,
  },
});

export default EventsScreen;
