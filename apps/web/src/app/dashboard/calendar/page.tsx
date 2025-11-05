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
import { addDays, format, parse, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';

// Calendar sources will be fetched from API - empty for now
const emptyCalendarSources: CalendarSource[] = [];

// ViewType type definition
type ViewType = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const [viewType, setViewType] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>(emptyCalendarSources);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Fetch events from API on component mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // TODO: Implement API endpoint for fetching calendar events
        // const response = await fetch('/api/calendar/events');
        // const data = await response.json();
        // setEvents(data);

        // For now, set empty array - will be populated when users create events
        setEvents([]);
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        setEvents([]);
      }
    };

    fetchEvents();
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
    
    const newEvent: CalendarEvent = {
      id: `event-new-${Date.now()}`,
      title: '',
      start: now.toISOString(),
      end: endTime.toISOString(),
      allDay: false,
      calendarId: calendarSources[0].id, // Default to first calendar
      color: calendarSources[0].color,
      description: '',
      location: ''
    };
    
    setSelectedEvent(newEvent);
    setShowEventModal(true);
  };
  
  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className="w-64 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="mb-4">
          <Button 
            variant="default" 
            className="w-full mb-4"
            onClick={handleCreateEvent}
          >
            Create Event
          </Button>
          
          <CalendarSidebar 
            calendarSources={calendarSources}
            onToggleCalendar={handleToggleCalendar}
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
        </div>
      </div>
      
      {/* Event Modal */}
      {showEventModal && selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          calendarSources={calendarSources}
          onClose={handleCloseModal}
          onSave={(updatedEvent) => {
            // For new events
            if (!events.find(e => e.id === updatedEvent.id)) {
              setEvents([...events, updatedEvent]);
            } else {
              // For existing events
              setEvents(events.map(event => 
                event.id === updatedEvent.id ? updatedEvent : event
              ));
            }
            handleCloseModal();
          }}
          onDelete={(eventId) => {
            setEvents(events.filter(event => event.id !== eventId));
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
}