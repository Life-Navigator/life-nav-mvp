'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import CalendarMonthView from '@/components/calendar/CalendarMonthView';
import CalendarWeekView from '@/components/calendar/CalendarWeekView';
import CalendarDayView from '@/components/calendar/CalendarDayView';
import CalendarSidebar from '@/components/calendar/CalendarSidebar';
import EventModal from '@/components/calendar/EventModal';
import { CalendarEvent, CalendarSource } from '@/types/calendar';
import { addDays, format, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';

// ViewType type definition
type ViewType = 'month' | 'week' | 'day';

// Calendar provider options
const CALENDAR_PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: '📅' },
  { id: 'outlook', name: 'Outlook Calendar', icon: '📆' },
  { id: 'apple', name: 'Apple Calendar', icon: '🗓️' },
];

export default function CalendarPage() {
  const [viewType, setViewType] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch calendar sources and events from API
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setIsLoading(true);

        // Fetch calendar sources
        const sourcesResponse = await fetch('/api/calendar/sources');
        if (!sourcesResponse.ok) {
          throw new Error('Failed to fetch calendar sources');
        }
        const sourcesData = await sourcesResponse.json();
        setCalendarSources(sourcesData || []);

        // Fetch calendar events
        const eventsResponse = await fetch('/api/calendar/events');
        if (!eventsResponse.ok) {
          throw new Error('Failed to fetch calendar events');
        }
        const eventsData = await eventsResponse.json();
        setEvents(eventsData || []);

        setError(null);
      } catch (err) {
        console.error('Error fetching calendar data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch calendar data'));
        setCalendarSources([]);
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCalendarData();
  }, []);

  // Filter events based on enabled calendar sources
  const filteredEvents = events.filter(event => {
    const source = calendarSources.find(source => source.id === event.calendarId);
    return source && source.isEnabled;
  });

  // Helper function to format the date range for the header based on view type
  const getDateRangeText = () => {
    if (viewType === 'day') {
      return format(currentDate, 'MMMM d, yyyy');
    } else if (viewType === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (viewType === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewType === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewType === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewType === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Sidebar handlers
  const handleToggleCalendar = (id: string) => {
    setCalendarSources(sources =>
      sources.map(source =>
        source.id === id ? { ...source, isEnabled: !source.isEnabled } : source
      )
    );
  };

  // Event handlers
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
    setShowEventModal(false);
  };

  const handleCreateEvent = () => {
    // Create a new empty event starting at the current hour
    const now = new Date();
    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);

    const endTime = new Date(now);
    endTime.setHours(now.getHours() + 1);

    const defaultCalendar = calendarSources[0] || { id: 'default', color: '#3B82F6' };

    const newEvent: CalendarEvent = {
      id: `event-new-${Date.now()}`,
      title: '',
      start: now.toISOString(),
      end: endTime.toISOString(),
      allDay: false,
      calendarId: defaultCalendar.id,
      color: defaultCalendar.color,
      description: '',
      location: ''
    };

    setSelectedEvent(newEvent);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (updatedEvent: CalendarEvent) => {
    try {
      const isNewEvent = !events.find(e => e.id === updatedEvent.id);

      if (isNewEvent) {
        // Create new event
        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedEvent),
        });

        if (!response.ok) throw new Error('Failed to create event');
        const savedEvent = await response.json();
        setEvents([...events, savedEvent]);
      } else {
        // Update existing event
        const response = await fetch('/api/calendar/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedEvent),
        });

        if (!response.ok) throw new Error('Failed to update event');
        setEvents(events.map(event =>
          event.id === updatedEvent.id ? updatedEvent : event
        ));
      }

      handleCloseModal();
    } catch (err) {
      console.error('Error saving event:', err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/events?id=${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete event');
      setEvents(events.filter(event => event.id !== eventId));
      handleCloseModal();
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const handleConnectCalendar = () => {
    setShowConnectModal(true);
  };

  const handleSelectProvider = async (providerId: string) => {
    // Redirect to OAuth flow
    window.location.href = `/api/integrations/oauth/init?provider=${providerId}&service=calendar`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-80px)]">
        <div className="w-64 p-4 border-r border-gray-200 dark:border-gray-700">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center">
        <Card className="p-6 max-w-md text-center">
          <p className="text-red-500 mb-4">Unable to load calendar</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className="w-64 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="mb-4">
          <Button
            variant="default"
            className="w-full mb-4"
            onClick={handleCreateEvent}
            disabled={calendarSources.length === 0}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Event
          </Button>

          <CalendarSidebar
            calendarSources={calendarSources}
            upcomingEvents={filteredEvents}
            onToggleCalendar={handleToggleCalendar}
            onConnectCalendar={handleConnectCalendar}
          />
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold">{getDateRangeText()}</h1>
            <div className="ml-4">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
            </div>
          </div>

          <div className="flex space-x-2">
            <div className="flex rounded-md shadow-sm">
              <Button variant="outline" onClick={handlePrevious}>
                &larr;
              </Button>
              <Button variant="outline" onClick={handleNext}>
                &rarr;
              </Button>
            </div>

            <div className="flex rounded-md shadow-sm">
              <Button
                variant={viewType === 'month' ? 'default' : 'outline'}
                onClick={() => setViewType('month')}
              >
                Month
              </Button>
              <Button
                variant={viewType === 'week' ? 'default' : 'outline'}
                onClick={() => setViewType('week')}
              >
                Week
              </Button>
              <Button
                variant={viewType === 'day' ? 'default' : 'outline'}
                onClick={() => setViewType('day')}
              >
                Day
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {calendarSources.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Card className="p-8 max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No Calendars Connected</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Connect your calendar accounts to see all your events in one place.
                </p>
                <Button onClick={handleConnectCalendar}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Connect Calendar
                </Button>
              </Card>
            </div>
          ) : (
            <>
              {viewType === 'month' && (
                <CalendarMonthView
                  events={filteredEvents}
                  currentDate={currentDate}
                  onEventClick={handleEventClick}
                />
              )}

              {viewType === 'week' && (
                <CalendarWeekView
                  events={filteredEvents}
                  currentDate={currentDate}
                  onEventClick={handleEventClick}
                />
              )}

              {viewType === 'day' && (
                <CalendarDayView
                  events={filteredEvents}
                  currentDate={currentDate}
                  onEventClick={handleEventClick}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && selectedEvent && (
        <EventModal
          event={selectedEvent}
          calendarSources={calendarSources}
          onClose={handleCloseModal}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Connect Calendar Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Connect Calendar</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Choose a calendar provider to connect your events.
            </p>

            <div className="space-y-3">
              {CALENDAR_PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleSelectProvider(provider.id)}
                  className="w-full p-4 flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-2xl">{provider.icon}</span>
                  <span className="font-medium">{provider.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowConnectModal(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
