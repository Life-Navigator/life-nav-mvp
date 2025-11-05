'use client';

import React from 'react';
import { addDays, format, getDate, getMonth, getYear, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subWeeks, addWeeks, endOfMonth, endOfWeek } from 'date-fns';
import { CalendarEvent, DayCell } from '@/types/calendar';
import { Card } from '@/components/ui/cards/Card';

interface CalendarMonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarMonthView({ events, currentDate, onEventClick }: CalendarMonthViewProps) {
  // Generate the days for the month view (includes days from previous/next months to fill the grid)
  const getDays = (): DayCell[] => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days: DayCell[] = [];
    let day = startDate;
    
    while (day <= endDate) {
      const currentDay = new Date(day);
      days.push({
        date: currentDay,
        isCurrentMonth: isSameMonth(currentDay, currentDate),
        isToday: isToday(currentDay),
        events: events.filter(event => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          return isSameDay(currentDay, eventStart) || 
                (event.allDay && (
                  currentDay >= eventStart && currentDay <= eventEnd
                ));
        }).sort((a, b) => {
          const aStart = new Date(a.start);
          const bStart = new Date(b.start);
          return aStart.getTime() - bStart.getTime();
        })
      });
      day = addDays(day, 1);
    }
    
    return days;
  };
  
  // Group days into weeks
  const getWeeks = () => {
    const days = getDays();
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };
  
  const weeks = getWeeks();
  
  // Function to limit events displayed per day
  const getDisplayEvents = (events: CalendarEvent[]) => {
    if (events.length <= 3) return events;
    return events.slice(0, 2);
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm text-gray-500 font-medium">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px auto-rows-fr">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => (
            <div 
              key={`${weekIndex}-${dayIndex}`}
              className={`min-h-[120px] p-2 border ${
                day.isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
              } ${
                day.isToday ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className={`text-right text-sm font-medium ${
                day.isToday ? 'text-blue-500' : 
                day.isCurrentMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {getDate(day.date)}
              </div>
              
              <div className="mt-1 space-y-1 max-h-[90px] overflow-y-auto scrollbar-thin">
                {getDisplayEvents(day.events).map(event => (
                  <div
                    key={event.id}
                    className="text-xs truncate rounded px-1 py-0.5 cursor-pointer"
                    style={{ backgroundColor: `${event.color}20`, color: event.color }}
                    onClick={() => onEventClick(event)}
                  >
                    {!event.allDay && format(new Date(event.start), 'h:mm a')} {event.title}
                  </div>
                ))}
                
                {day.events.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    + {day.events.length - 2} more
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}