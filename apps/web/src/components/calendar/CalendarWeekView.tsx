'use client';

import React from 'react';
import { addDays, format, isSameDay, startOfWeek, getHours, getMinutes, isToday } from 'date-fns';
import { CalendarEvent, TimeSlot } from '@/types/calendar';

interface CalendarWeekViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarWeekView({ events, currentDate, onEventClick }: CalendarWeekViewProps) {
  // Get week days starting from current date's week
  const getWeekDays = () => {
    const startDay = startOfWeek(currentDate);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDay, i));
    }
    
    return days;
  };
  
  const weekDays = getWeekDays();
  
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
  
  // Check if an event occurs during a specific timeslot for a specific day
  const getEventsForTimeSlot = (day: Date, hour: number, minute: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Skip all-day events (they'll be displayed separately)
      if (event.allDay) return false;
      
      // Check if this day matches the event date
      if (!isSameDay(day, eventStart) && !isSameDay(day, eventEnd)) {
        // If the event spans multiple days, check if this day is between start and end
        if (day > eventStart && day < eventEnd) {
          return true;
        }
        return false;
      }
      
      // Creating a Date object for the time slot
      const slotStart = new Date(day);
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
  
  // Get all-day events for a specific day
  const getAllDayEvents = (day: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      return event.allDay && isSameDay(day, eventStart);
    });
  };
  
  // Calculate the height of an event in the grid based on its duration
  const calculateEventHeight = (event: CalendarEvent) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    // If the event spans multiple days, only show to the end of the current day
    if (!isSameDay(eventStart, eventEnd)) {
      eventEnd.setHours(23);
      eventEnd.setMinutes(59);
    }
    
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
      {/* All-day events section */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-2 pb-2">
        <div className="grid grid-cols-8 gap-2">
          <div className="px-2 py-1 text-sm font-medium text-gray-500">All-day</div>
          
          {weekDays.map((day, index) => (
            <div key={index} className="min-h-[2rem]">
              {getAllDayEvents(day).map(event => (
                <div 
                  key={event.id}
                  className="text-xs truncate rounded px-1 py-0.5 mb-1 cursor-pointer"
                  style={{ backgroundColor: `${event.color}20`, color: event.color }}
                  onClick={() => onEventClick(event)}
                >
                  {event.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Time grid */}
      <div className="grid grid-cols-8 gap-0 relative">
        {/* Time labels */}
        <div className="border-r border-gray-200 dark:border-gray-700">
          {timeSlots.map((slot, index) => (
            <div 
              key={index} 
              className={`h-12 px-2 text-xs text-gray-500 text-right ${
                isHourStart(slot.minute) ? 'border-t border-gray-200 dark:border-gray-700' : ''
              }`}
            >
              {isHourStart(slot.minute) && formatTimeSlot(slot.hour, slot.minute)}
            </div>
          ))}
        </div>
        
        {/* Day columns */}
        {weekDays.map((day, dayIndex) => (
          <div 
            key={dayIndex} 
            className={`relative ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
          >
            {/* Day header */}
            <div className="h-8 sticky top-0 bg-white dark:bg-gray-800 z-10 border-b border-gray-200 dark:border-gray-700 text-center">
              <div className="text-sm font-medium">
                {format(day, 'EEE')}
              </div>
              <div className={`text-xs ${isToday(day) ? 'text-blue-500' : 'text-gray-500'}`}>
                {format(day, 'MMM d')}
              </div>
            </div>
            
            {/* Time slots */}
            <div>
              {timeSlots.map((slot, slotIndex) => {
                const slotEvents = getEventsForTimeSlot(day, slot.hour, slot.minute);
                
                return (
                  <div 
                    key={slotIndex} 
                    className={`h-12 border-r border-gray-200 dark:border-gray-700 ${
                      isHourStart(slot.minute) ? 'border-t border-gray-200 dark:border-gray-700' : ''
                    }`}
                  >
                    {slotEvents.map(event => {
                      const eventStart = new Date(event.start);
                      
                      // Only render event in its starting time slot
                      if (
                        getHours(eventStart) === slot.hour && 
                        Math.floor(getMinutes(eventStart) / 15) * 15 === slot.minute
                      ) {
                        const height = `${calculateEventHeight(event)}rem`;
                        
                        return (
                          <div
                            key={event.id}
                            className="absolute z-10 rounded left-0 right-0 mx-1 px-2 py-1 truncate overflow-hidden cursor-pointer text-xs"
                            style={{ 
                              backgroundColor: `${event.color}20`, 
                              color: event.color,
                              borderLeft: `3px solid ${event.color}`,
                              height,
                              maxWidth: 'calc(100% - 8px)'
                            }}
                            onClick={() => onEventClick(event)}
                          >
                            <div className="font-medium">{event.title}</div>
                            <div>{format(eventStart, 'h:mm a')}</div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}