/**
 * Life Navigator - Event Discovery Service
 *
 * Aggregates events from multiple sources and provides unified access
 */

import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import {
  Event,
  EventSearchParams,
  EventsResponse,
  EventPlatform,
  EventCategory,
  EventFilters,
  SavedEvent,
  EventRSVP,
} from '../../types/career';
import {
  getEventbriteEvents,
  getMeetupEvents,
  getChamberEvents,
  getLocalBusinessEvents,
  searchAllEvents,
  saveEvent,
  unsaveEvent,
  getSavedEvents,
  rsvpEvent,
  getRSVPEvents,
  getEventDetails,
} from '../../api/career';

class EventDiscoveryService {
  /**
   * Get user's current location
   */
  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  /**
   * Search events from all sources
   */
  async searchEvents(params: EventSearchParams): Promise<EventsResponse> {
    try {
      // If no location provided, try to get current location
      if (!params.location && !params.city) {
        const currentLocation = await this.getCurrentLocation();
        if (currentLocation) {
          params.location = currentLocation;
        }
      }

      const response = await searchAllEvents(params);
      return response;
    } catch (error) {
      console.error('Error searching events:', error);
      throw error;
    }
  }

  /**
   * Get events by platform
   */
  async getEventsByPlatform(
    platform: EventPlatform,
    params: EventSearchParams
  ): Promise<EventsResponse> {
    try {
      switch (platform) {
        case 'eventbrite':
          return await getEventbriteEvents(params);
        case 'meetup':
          return await getMeetupEvents(params);
        case 'chamber':
          return await getChamberEvents(params);
        case 'local':
          return await getLocalBusinessEvents(params);
        default:
          return await searchAllEvents(params);
      }
    } catch (error) {
      console.error(`Error getting ${platform} events:`, error);
      throw error;
    }
  }

  /**
   * Get nearby events (within radius)
   */
  async getNearbyEvents(radius: number = 25): Promise<Event[]> {
    try {
      const location = await this.getCurrentLocation();
      if (!location) {
        throw new Error('Location permission required for nearby events');
      }

      const response = await searchAllEvents({
        location,
        radius,
        limit: 50,
      });

      return response.events;
    } catch (error) {
      console.error('Error getting nearby events:', error);
      throw error;
    }
  }

  /**
   * Get events by category
   */
  async getEventsByCategory(
    category: EventCategory,
    params?: Partial<EventSearchParams>
  ): Promise<Event[]> {
    try {
      const location = await this.getCurrentLocation();
      const response = await searchAllEvents({
        ...params,
        location: params?.location || location || undefined,
        category,
        limit: params?.limit || 30,
      });

      return response.events;
    } catch (error) {
      console.error(`Error getting ${category} events:`, error);
      throw error;
    }
  }

  /**
   * Filter events locally
   */
  filterEvents(events: Event[], filters: EventFilters): Event[] {
    let filtered = [...events];

    // Filter by platform
    if (filters.platform && filters.platform.length > 0) {
      filtered = filtered.filter((event) => filters.platform!.includes(event.platform));
    }

    // Filter by category
    if (filters.category && filters.category.length > 0) {
      filtered = filtered.filter((event) => filters.category!.includes(event.category));
    }

    // Filter by date range
    if (filters.dateRange) {
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      filtered = filtered.filter((event) => {
        const eventDate = new Date(event.date);
        return eventDate >= start && eventDate <= end;
      });
    }

    // Filter by free only
    if (filters.isFreeOnly) {
      filtered = filtered.filter((event) => event.pricing.isFree);
    }

    // Filter by virtual only
    if (filters.isVirtualOnly) {
      filtered = filtered.filter((event) => event.location.isVirtual);
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.organizer.name.toLowerCase().includes(query) ||
          event.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }

  /**
   * Sort events
   */
  sortEvents(
    events: Event[],
    sortBy: 'date' | 'popularity' | 'distance' | 'price' = 'date',
    order: 'asc' | 'desc' = 'asc'
  ): Event[] {
    const sorted = [...events].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'popularity':
          comparison = a.attendees.registered - b.attendees.registered;
          break;
        case 'price':
          const priceA = a.pricing.price || 0;
          const priceB = b.pricing.price || 0;
          comparison = priceA - priceB;
          break;
        default:
          comparison = 0;
      }

      return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Save event to user's list
   */
  async saveEventToList(eventId: string, notes?: string): Promise<SavedEvent> {
    try {
      return await saveEvent(eventId, notes);
    } catch (error) {
      console.error('Error saving event:', error);
      throw error;
    }
  }

  /**
   * Unsave event
   */
  async unsaveEventFromList(eventId: string): Promise<void> {
    try {
      await unsaveEvent(eventId);
    } catch (error) {
      console.error('Error unsaving event:', error);
      throw error;
    }
  }

  /**
   * Get saved events
   */
  async getSavedEventsList(): Promise<SavedEvent[]> {
    try {
      return await getSavedEvents();
    } catch (error) {
      console.error('Error getting saved events:', error);
      throw error;
    }
  }

  /**
   * RSVP to event
   */
  async rsvpToEvent(
    eventId: string,
    status: 'going' | 'maybe' | 'not_going',
    notes?: string
  ): Promise<EventRSVP> {
    try {
      return await rsvpEvent(eventId, status, notes);
    } catch (error) {
      console.error('Error RSVPing to event:', error);
      throw error;
    }
  }

  /**
   * Get RSVP'd events
   */
  async getRSVPdEvents(): Promise<EventRSVP[]> {
    try {
      return await getRSVPEvents();
    } catch (error) {
      console.error('Error getting RSVP events:', error);
      throw error;
    }
  }

  /**
   * Add event to device calendar
   */
  async addEventToCalendar(event: Event): Promise<string | null> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Calendar permission required');
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find((cal) => cal.isPrimary) || calendars[0];

      if (!defaultCalendar) {
        throw new Error('No calendar found');
      }

      const eventDetails = {
        title: event.title,
        startDate: new Date(event.date),
        endDate: event.endDate ? new Date(event.endDate) : new Date(event.date),
        location: event.location.isVirtual
          ? event.location.virtualUrl || 'Virtual Event'
          : event.location.address,
        notes: `${event.description}\n\nOrganizer: ${event.organizer.name}\nSource: ${event.platform}\n${event.externalUrl}`,
        timeZone: 'UTC',
      };

      const calendarEventId = await Calendar.createEventAsync(defaultCalendar.id, eventDetails);
      return calendarEventId;
    } catch (error) {
      console.error('Error adding event to calendar:', error);
      throw error;
    }
  }

  /**
   * Get event details
   */
  async getEvent(eventId: string): Promise<Event> {
    try {
      return await getEventDetails(eventId);
    } catch (error) {
      console.error('Error getting event details:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events (next 30 days)
   */
  async getUpcomingEvents(days: number = 30): Promise<Event[]> {
    try {
      const location = await this.getCurrentLocation();
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const response = await searchAllEvents({
        location: location || undefined,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
      });

      return this.sortEvents(response.events, 'date', 'asc');
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export default new EventDiscoveryService();
