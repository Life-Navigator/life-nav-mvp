'use client';

import React from 'react';
import { format, isSameDay, getHours, getMinutes, isToday } from 'date-fns';
import { CalendarEvent } from '@/types/calendar';

interface CalendarDayViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarDayView({ events, currentDate, onEventClick }: CalendarDayViewProps) {
  // Get time slots in 15-minute intervals
  const getTimeSlots = () => {
    const slots = [];
    
    // 24 hours * 4 intervals (15 minutes each)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({
          hour,
          minute
        });
      }
    }
    
    return slots;
  };
  
  const timeSlots = getTimeSlots();
  
  // Get events for the current day
  const getDayEvents = () => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Event starts or ends on the current day, or spans across it
      return (
        isSameDay(currentDate, eventStart) || 
        isSameDay(currentDate, eventEnd) ||
        (eventStart < currentDate && eventEnd > currentDate)
      );
    });
  };
  
  // Get all-day events
  const getAllDayEvents = () => {
    return getDayEvents().filter(event => event.allDay);
  };
  
  // Get timed events (non-all-day)
  const getTimedEvents = () => {
    return getDayEvents().filter(event => !event.allDay);
  };
  
  // Check if an event occurs during a specific timeslot
  const getEventsForTimeSlot = (hour: number, minute: number) => {
    return getTimedEvents().filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Creating a Date object for the time slot
      const slotStart = new Date(currentDate);
      slotStart.setHours(hour);
      slotStart.setMinutes(minute);
      slotStart.setSeconds(0);
      slotStart.setMilliseconds(0);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 15);
      
      // Check if the event overlaps with this time slot
      return (
        (eventStart <= slotEnd && eventEnd >= slotStart)
      );
    });
  };
  
  // Calculate the height of an event in the grid based on its duration
  const calculateEventHeight = (event: CalendarEvent) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    // Calculate duration in minutes
    const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
    
    // Each 15-minute slot is approximately 3rem in height
    return (durationMinutes / 15) * 3;
  };
  
  // Format a time slot for display
  const formatTimeSlot = (hour: number, minute: number) => {
    const time = new Date();
    time.setHours(hour);
    time.setMinutes(minute);
    return format(time, 'h:mm a');
  };
  
  // Determine if a new time slot hour is starting
  const isHourStart = (minute: number) => minute === 0;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-auto">
      {/* Date header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h2>
      </div>
      
      {/* All-day events section */}
      {getAllDayEvents().length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-500 mb-2">All-day</div>
          <div className="space-y-1">
            {getAllDayEvents().map(event => (
              <div 
                key={event.id}
                className="text-sm rounded px-2 py-1 cursor-pointer"
                style={{ backgroundColor: `${event.color}20`, color: event.color }}
                onClick={() => onEventClick(event)}
              >
                {event.title}
                {event.location && (
                  <div className="text-xs opacity-70 mt-0.5">📍 {event.location}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Time grid */}
      <div className="grid grid-cols-[80px_1fr] gap-0">
        {/* Time labels */}
        <div>
          {timeSlots.map((slot, index) => (
            <div 
              key={index} 
              className={`h-12 px-3 text-sm text-gray-500 text-right ${
                isHourStart(slot.minute) ? 'border-t border-gray-200 dark:border-gray-700' : ''
              }`}
            >
              {isHourStart(slot.minute) && (
                <div className="relative -top-2">
                  {formatTimeSlot(slot.hour, slot.minute)}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Event columns */}
        <div className="relative">
          {/* Time slots background */}
          {timeSlots.map((slot, index) => (
            <div 
              key={index} 
              className={`h-12 ${
                isHourStart(slot.minute) ? 'border-t border-gray-200 dark:border-gray-700' : ''
              }`}
            >
              {/* Current time indicator */}
              {isToday(currentDate) && 
               getHours(new Date()) === slot.hour && 
               Math.floor(getMinutes(new Date()) / 15) * 15 === slot.minute && (
                <div className="absolute left-0 right-0 border-t-2 border-red-500 z-20"></div>
              )}
            </div>
          ))}
          
          {/* Events */}
          {getTimedEvents().map(event => {
            const eventStart = new Date(event.start);
            
            // Calculate position from top based on event start time
            const hourOffset = getHours(eventStart) * (12 * 4); // 12rem per hour (4 slots)
            const minuteOffset = (getMinutes(eventStart) / 15) * 12; // 12rem per hour / 4 = 3rem per 15 min
            const topPosition = hourOffset + minuteOffset;
            
            const height = calculateEventHeight(event);
            
            return (
              <div
                key={event.id}
                className="absolute z-10 rounded left-0 right-0 mx-2 px-3 py-1 cursor-pointer overflow-hidden"
                style={{ 
                  backgroundColor: `${event.color}20`,
                  color: event.color,
                  borderLeft: `3px solid ${event.color}`,
                  top: `${topPosition}px`,
                  height: `${height}rem`,
                  maxWidth: 'calc(100% - 16px)'
                }}
                onClick={() => onEventClick(event)}
              >
                <div className="font-medium">{event.title}</div>
                <div className="text-xs">
                  {format(eventStart, 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}
                </div>
                {event.location && (
                  <div className="text-xs mt-1">📍 {event.location}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}