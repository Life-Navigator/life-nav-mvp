'use client';

import React from 'react';
import { Event } from '@/types/career';
import { useSaveEvent, useUnsaveEvent, useRsvpToEvent } from '@/hooks/useCareer';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const saveEventMutation = useSaveEvent();
  const unsaveEventMutation = useUnsaveEvent();
  const rsvpMutation = useRsvpToEvent();

  const handleSaveToggle = () => {
    if (event.isSaved) {
      unsaveEventMutation.mutate(event.id);
    } else {
      saveEventMutation.mutate(event.id);
    }
  };

  const handleRsvp = (response: 'attending' | 'interested' | 'not_attending') => {
    rsvpMutation.mutate({ eventId: event.id, response });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const platformColors = {
    eventbrite: 'bg-orange-100 text-orange-800',
    meetup: 'bg-red-100 text-red-800',
    chamber: 'bg-blue-100 text-blue-800',
    local: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {event.imageUrl && (
        <div className="w-full h-48 bg-gray-200">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 text-xs font-medium rounded ${platformColors[event.platform]}`}>
                {event.platform.toUpperCase()}
              </span>
              {event.isFree && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                  FREE
                </span>
              )}
              {event.isVirtual && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                  VIRTUAL
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{event.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{event.organizer.name}</p>
          </div>

          <button
            onClick={handleSaveToggle}
            className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={saveEventMutation.isPending || unsaveEventMutation.isPending}
          >
            <svg
              className={`w-6 h-6 ${event.isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`}
              fill={event.isSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(event.startDate)}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{event.location.city}, {event.location.state || event.location.country}</span>
          </div>

          {event.attendees && (
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{event.attendees} attendees</span>
            </div>
          )}

          {!event.isFree && event.price && (
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>${event.price}</span>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-700 mb-4 line-clamp-2">{event.description}</p>

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {event.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRsvp('attending')}
            disabled={rsvpMutation.isPending}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${
              event.rsvpStatus === 'attending'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            Attend
          </button>
          <button
            onClick={() => handleRsvp('interested')}
            disabled={rsvpMutation.isPending}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${
              event.rsvpStatus === 'interested'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          >
            Interested
          </button>
          {event.registrationUrl && (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
