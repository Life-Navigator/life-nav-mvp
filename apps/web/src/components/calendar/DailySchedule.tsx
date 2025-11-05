'use client';

import React, { useState, useEffect } from 'react';
import { format, isToday, parseISO, isFuture, isAfter, isBefore } from 'date-fns';
import Link from 'next/link';
import { CalendarEvent } from '@/types/calendar';

interface DailyScheduleProps {
  events: CalendarEvent[];
  date?: Date;
  maxEvents?: number;
}

export default function DailySchedule({ events, date = new Date(), maxEvents = 5 }: DailyScheduleProps) {
  // Filter events for the selected date
  const getTodayEvents = () => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return events
      .filter(event => {
        const eventStart = parseISO(event.start);
        const eventEnd = parseISO(event.end);
        
        // Check if event occurs today (starts, ends, or overlaps)
        return (
          // Event starts today
          (isAfter(eventStart, startOfDay) && isBefore(eventStart, endOfDay)) ||
          // Event ends today
          (isAfter(eventEnd, startOfDay) && isBefore(eventEnd, endOfDay)) ||
          // Event spans over today (starts before and ends after)
          (isBefore(eventStart, startOfDay) && isAfter(eventEnd, endOfDay))
        );
      })
      .sort((a, b) => {
        // Sort by start time
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      })
      .slice(0, maxEvents); // Limit number of events
  };

  const todayEvents = getTodayEvents();
  const hasEvents = todayEvents.length > 0;
  
  // Group events by status
  const upcomingEvents = todayEvents.filter(event => isFuture(parseISO(event.start)));
  const inProgressEvents = todayEvents.filter(event => {
    const now = new Date();
    const eventStart = parseISO(event.start);
    const eventEnd = parseISO(event.end);
    return isAfter(now, eventStart) && isBefore(now, eventEnd);
  });
  const pastEvents = todayEvents.filter(event => {
    const now = new Date();
    const eventEnd = parseISO(event.end);
    return isBefore(eventEnd, now);
  });
  
  // Format event time for display
  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) {
      return 'All day';
    }
    
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    
    return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-400 h-2" />
      
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {isToday(date) ? 'Today\'s Schedule' : format(date, 'MMMM d, yyyy')}
          </h3>
          <Link 
            href="/dashboard/calendar"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            View calendar
          </Link>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {hasEvents ? (
          <>
            {/* In Progress Events */}
            {inProgressEvents.length > 0 && (
              <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Happening Now</h4>
                <div className="space-y-3">
                  {inProgressEvents.map(event => (
                    <div key={event.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatEventTime(event)}
                          {event.location && <span> • {event.location}</span>}
                        </p>
                      </div>
                      <div className="inline-flex px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                        Now
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <div className="px-4 py-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Coming Up</h4>
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div key={event.id} className="flex items-start space-x-3">
                      <div 
                        className="flex-shrink-0 h-3 w-3 rounded-full mt-0.5" 
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatEventTime(event)}
                          {event.location && <span> • {event.location}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Past Events */}
            {pastEvents.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Completed</h4>
                <div className="space-y-3">
                  {pastEvents.map(event => (
                    <div key={event.id} className="flex items-start space-x-3">
                      <div 
                        className="flex-shrink-0 h-3 w-3 rounded-full mt-0.5 opacity-50" 
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatEventTime(event)}
                          {event.location && <span> • {event.location}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No events scheduled for today</p>
            <Link 
              href="/dashboard/calendar"
              className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              <span>Add an event</span>
              <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}