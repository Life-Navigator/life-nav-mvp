'use client';

import React from 'react';
import { CalendarSource, CalendarEvent } from '@/types/calendar';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';

interface CalendarSidebarProps {
  calendarSources: CalendarSource[];
  upcomingEvents: CalendarEvent[];
  onToggleCalendar: (id: string) => void;
  onConnectCalendar?: () => void;
}

export default function CalendarSidebar({
  calendarSources,
  upcomingEvents,
  onToggleCalendar,
  onConnectCalendar
}: CalendarSidebarProps) {
  // Format event date for display
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);

    if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`;
    }

    if (isTomorrow(date)) {
      return `Tomorrow, ${format(date, 'h:mm a')}`;
    }

    if (isThisWeek(date)) {
      return format(date, 'EEEE, h:mm a');
    }

    return format(date, 'MMM d, h:mm a');
  };

  // Get upcoming events (next 5)
  const displayEvents = upcomingEvents
    .filter(event => new Date(event.start) >= new Date())
    .slice(0, 5);

  return (
    <div>
      <h3 className="text-md font-semibold mb-3">My Calendars</h3>

      {calendarSources.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <CalendarIcon className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No calendars connected
          </p>
          {onConnectCalendar && (
            <button
              onClick={onConnectCalendar}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Connect Calendar
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {calendarSources.map(calendar => (
            <div
              key={calendar.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => onToggleCalendar(calendar.id)}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={calendar.isEnabled}
                  onChange={() => onToggleCalendar(calendar.id)}
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
              </div>

              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: calendar.color }}
              />

              <span className={calendar.isEnabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                {calendar.name}
              </span>
            </div>
          ))}

          {onConnectCalendar && (
            <button
              onClick={onConnectCalendar}
              className="flex items-center gap-2 p-2 w-full rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm">Add Calendar</span>
            </button>
          )}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-md font-semibold mb-3">Upcoming Events</h3>

        {displayEvents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No upcoming events
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {displayEvents.map(event => (
              <div key={event.id} className="p-2 rounded-md bg-gray-50 dark:bg-gray-800">
                <div className="flex items-start gap-2">
                  <div
                    className="w-1 h-full min-h-[2rem] rounded-full mt-0.5"
                    style={{ backgroundColor: event.color || '#3B82F6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{event.title}</div>
                    <div className="text-xs text-gray-500">{formatEventDate(event.start)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
