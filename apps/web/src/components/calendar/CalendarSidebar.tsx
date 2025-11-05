'use client';

import React from 'react';
import { CalendarSource } from '@/types/calendar';

interface CalendarSidebarProps {
  calendarSources: CalendarSource[];
  onToggleCalendar: (id: string) => void;
}

export default function CalendarSidebar({ calendarSources, onToggleCalendar }: CalendarSidebarProps) {
  return (
    <div>
      <h3 className="text-md font-semibold mb-3">My Calendars</h3>
      
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
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-md font-semibold mb-3">Upcoming Events</h3>
        
        {/* This would typically be populated with actual upcoming events */}
        <div className="mt-2 space-y-2">
          <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-800">
            <div className="text-sm font-medium">Team Weekly Sync</div>
            <div className="text-xs text-gray-500">Tomorrow, 10:00 AM</div>
          </div>
          
          <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-800">
            <div className="text-sm font-medium">Doctor Appointment</div>
            <div className="text-xs text-gray-500">Wednesday, 2:30 PM</div>
          </div>
          
          <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-800">
            <div className="text-sm font-medium">Budget Review</div>
            <div className="text-xs text-gray-500">Friday, 1:00 PM</div>
          </div>
        </div>
      </div>
    </div>
  );
}