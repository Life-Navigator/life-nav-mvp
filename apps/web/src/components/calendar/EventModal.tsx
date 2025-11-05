'use client';

import React, { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { CalendarEvent, CalendarSource } from '@/types/calendar';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/forms/Input';
import { Select } from '@/components/ui/forms/Select';

interface EventModalProps {
  event: CalendarEvent;
  calendarSources: CalendarSource[];
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

export default function EventModal({ event, calendarSources, onClose, onSave, onDelete }: EventModalProps) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [location, setLocation] = useState(event.location || '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(event.allDay);
  const [calendarId, setCalendarId] = useState(event.calendarId);
  
  // Initialize date and time fields on component mount
  useEffect(() => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    setStartDate(format(start, 'yyyy-MM-dd'));
    setStartTime(format(start, 'HH:mm'));
    setEndDate(format(end, 'yyyy-MM-dd'));
    setEndTime(format(end, 'HH:mm'));
  }, [event]);
  
  // Handler for saving the event
  const handleSave = () => {
    // Create date objects from form values
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    
    // Validate form
    if (!title.trim()) {
      alert('Event title is required');
      return;
    }
    
    if (endDateTime <= startDateTime) {
      alert('End time must be after start time');
      return;
    }
    
    // Find selected calendar source for color
    const calendar = calendarSources.find(source => source.id === calendarId);
    if (!calendar) {
      alert('Please select a valid calendar');
      return;
    }
    
    // Create updated event object
    const updatedEvent: CalendarEvent = {
      ...event,
      title,
      description,
      location,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      allDay,
      calendarId,
      color: calendar.color,
    };
    
    onSave(updatedEvent);
  };
  
  // Handler for toggling all-day status
  const handleAllDayToggle = () => {
    setAllDay(!allDay);
    
    // If switching to all-day, set times appropriately
    if (!allDay) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      
      setStartTime('00:00');
      setEndTime('23:59');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {event.id.startsWith('event-new') ? 'Create Event' : 'Edit Event'}
          </h2>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Event Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Event Title *
            </label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Add title"
              className="w-full"
            />
          </div>
          
          {/* Calendar Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Calendar
            </label>
            <Select 
              value={calendarId} 
              onChange={(e) => setCalendarId(e.target.value)}
              className="w-full"
            >
              {calendarSources.map(source => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
          </div>
          
          {/* All Day Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={handleAllDayToggle}
              className="rounded text-blue-500 focus:ring-blue-500 mr-2"
            />
            <label htmlFor="allDay" className="text-sm font-medium">
              All Day
            </label>
          </div>
          
          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            
            {!allDay && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            
            {!allDay && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  End Time
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Location
            </label>
            <Input 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              placeholder="Add location"
              className="w-full"
            />
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <div>
            {!event.id.startsWith('event-new') && (
              <Button 
                variant="destructive" 
                onClick={() => onDelete(event.id)}
              >
                Delete
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}